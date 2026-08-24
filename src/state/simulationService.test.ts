import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConditionedState } from '../engine/equity';

// WR-02 regression guard (02-REVIEW.md): a hard worker death (script-load failure or an
// undeserializable postMessage payload) must route through the caller's `onError`, exactly
// like an in-band call rejection already does — instead of leaving the Comlink promise
// hanging forever with a silently frozen odds panel.
//
// jsdom (this file's default environment) is required because this test dispatches real
// `ErrorEvent`/`MessageEvent` instances onto an `EventTarget`-based fake worker, and asserts
// against `Worker`-shaped listener wiring. Do not opt this file into the node environment
// (some sibling test files under src/engine and src/worker do, via a docblock directive) —
// that environment has no `ErrorEvent`/`window`, which this test needs.
const { workers, runSimulation, cancel } = vi.hoisted(() => ({
  workers: [] as EventTarget[],
  runSimulation: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../worker/simulation.worker?worker', () => {
  class FakeWorker extends EventTarget {
    postMessage() {}
    terminate() {}
    constructor() {
      super();
      workers.push(this);
    }
  }
  return { default: FakeWorker };
});

// The real `Comlink.wrap` would try to speak its message protocol to the fake worker and
// hang forever waiting for a handshake reply — replace it with a trivial passthrough that
// exposes the same `runSimulation`/`cancel` surface `simulationService` calls.
vi.mock('comlink', () => ({
  wrap: () => ({ runSimulation, cancel }),
  proxy: <T,>(cb: T) => cb,
}));

const { startSimulation } = await import('./simulationService');
const { FULL_DECK, deckWithout } = await import('../engine/cards');

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [FULL_DECK[0], FULL_DECK[1]];
const remainingDeck = deckWithout(heroHole);

const preflopFixture: ConditionedState = {
  heroHole,
  knownBoard: [],
  knownOpponentHoles: [null, null, null],
  remainingDeck,
};

describe('simulationService — hard worker crash routing (WR-02)', () => {
  // Clears mock.calls/results (NOT `workers` — the fake worker is a module-scope singleton
  // constructed once at import time, so it must persist across tests) between tests. Without
  // this, `runSimulation`'s call count from a prior test would already be non-zero, so the
  // `vi.waitFor` below would resolve on its very first (already-satisfied) check — racing
  // ahead of the `await cancelSimulation()` tick that assigns `currentOnError` for THIS test.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes a worker "error" event into onError exactly once', async () => {
    cancel.mockResolvedValue(undefined);
    runSimulation.mockImplementation(() => new Promise(() => {}));

    const onError = vi.fn();
    void startSimulation(preflopFixture, vi.fn(), onError);
    await vi.waitFor(() => expect(runSimulation).toHaveBeenCalled());

    workers[0].dispatchEvent(new ErrorEvent('error', { message: 'Failed to load worker script' }));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain('Failed to load worker script');
  });

  it('routes a worker "messageerror" event into onError exactly once', async () => {
    cancel.mockResolvedValue(undefined);
    runSimulation.mockImplementation(() => new Promise(() => {}));

    const onError = vi.fn();
    void startSimulation(preflopFixture, vi.fn(), onError);
    await vi.waitFor(() => expect(runSimulation).toHaveBeenCalled());

    workers[0].dispatchEvent(new MessageEvent('messageerror'));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/could not be read/i);
  });

  it('does not invoke a finished run\'s onError after it has already resolved (stale-closure guard)', async () => {
    cancel.mockResolvedValue(undefined);
    runSimulation.mockResolvedValue(undefined);

    const onError = vi.fn();
    await startSimulation(preflopFixture, vi.fn(), onError);

    workers[0].dispatchEvent(new ErrorEvent('error', { message: 'late crash, run already done' }));

    expect(onError).not.toHaveBeenCalled();
  });
});
