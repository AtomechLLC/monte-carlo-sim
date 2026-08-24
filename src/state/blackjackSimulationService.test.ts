import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConditionedState } from '../engine/equity';
import type { BlackjackConditionedState } from '../engine/blackjackEquity';
import type { BlackjackProgressSnapshot } from '../worker/blackjackProtocol';

// The regression detector for T-06-49: the shared worker transport must be side-effect-free
// on import (LAZY construction inside getApi()/getWorker()). At wave 4,
// App -> BlackjackGame -> blackjackSimulationService -> workerClient becomes a SECOND import
// path into the singleton that the five frozen v1 jsdom suites do NOT mock — a module-scope
// `new SimWorker()` would instantiate a real Worker at import time and crash all five.
// The zero-workers-after-import and one-worker-after-first-call tests below pin that.
//
// jsdom (this file's default environment) is required because this test dispatches real
// `ErrorEvent`/`MessageEvent` instances onto an `EventTarget`-based fake worker — same
// rationale as `simulationService.test.ts`; do not opt this file into the node environment.
const { workers, pokerRunSimulation, pokerCancel, bjRunSimulation, bjCancel } = vi.hoisted(
  () => ({
    // `terminated` tracking added with the 06-REVIEW WR-02 crash-then-restart case below
    // (additive observability — no prior assertion changed).
    workers: [] as Array<EventTarget & { terminated: boolean }>,
    pokerRunSimulation: vi.fn(),
    pokerCancel: vi.fn(),
    bjRunSimulation: vi.fn(),
    bjCancel: vi.fn(),
  }),
);

vi.mock('../worker/simulation.worker?worker', () => {
  class FakeWorker extends EventTarget {
    terminated = false;
    postMessage() {}
    terminate() {
      this.terminated = true;
    }
    constructor() {
      super();
      workers.push(this);
    }
  }
  return { default: FakeWorker };
});

// The real `Comlink.wrap` would try to speak its message protocol to the fake worker and
// hang forever — replace it with a passthrough exposing the NAMESPACED { poker, blackjack }
// surface the transport now wraps.
vi.mock('comlink', () => ({
  wrap: () => ({
    poker: { runSimulation: pokerRunSimulation, cancel: pokerCancel },
    blackjack: { runSimulation: bjRunSimulation, cancel: bjCancel },
  }),
  proxy: <T,>(cb: T) => cb,
}));

// Import ALL THREE transport modules up front — the first test asserts that none of these
// imports constructed a Worker.
const { startBlackjackSimulation, cancelBlackjackSimulation } = await import(
  './blackjackSimulationService'
);
const { startSimulation, cancelSimulation } = await import('./simulationService');
await import('./workerClient');
const { FULL_DECK, deckWithout } = await import('../engine/cards');
const { shoeWithout } = await import('../engine/shoe');

const blackjackFixture: BlackjackConditionedState = {
  playerHand: [FULL_DECK[0], FULL_DECK[1]],
  dealerUpcard: FULL_DECK[2],
  remainingDeck: shoeWithout(1, [FULL_DECK[0], FULL_DECK[1], FULL_DECK[2]]),
  deckCount: 1,
};

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [
  FULL_DECK[0],
  FULL_DECK[1],
];
const pokerFixture: ConditionedState = {
  heroHole,
  knownBoard: [],
  knownOpponentHoles: [null, null, null],
  remainingDeck: deckWithout(heroHole),
};

function makeSnapshot(requestId: number): BlackjackProgressSnapshot {
  return {
    requestId,
    dealerOutcomeCounts: [0, 0, 0, 0, 0, 0, 0],
    bustIfHitCount: 0,
    standOutcomes: { win: 0, push: 0, lose: 0 },
    hitOutcomes: { win: 0, push: 0, lose: 0 },
    trialsCompleted: 0,
    done: false,
  };
}

describe('shared worker transport — lazy singleton (T-06-49) + blackjack service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pokerCancel.mockResolvedValue(undefined);
    bjCancel.mockResolvedValue(undefined);
  });

  // MUST run first in this file: the module-scope cache persists across tests, so worker
  // construction can only be observed as "still zero" before any service call has happened.
  it('constructs ZERO workers at import time — the transport is side-effect-free on import', () => {
    expect(workers).toHaveLength(0);
  });

  it('constructs exactly ONE worker on the first call — including two concurrent first calls (StrictMode shape) — and reuses it across a dozen mixed calls from BOTH services', async () => {
    bjRunSimulation.mockResolvedValue(undefined);
    pokerRunSimulation.mockResolvedValue(undefined);

    // Two synchronous first calls in the same tick: the cache is checked and populated
    // synchronously (no await between check and assignment), so this must construct ONE.
    const first = startBlackjackSimulation(blackjackFixture, vi.fn(), vi.fn());
    const second = startBlackjackSimulation(blackjackFixture, vi.fn(), vi.fn());
    expect(workers).toHaveLength(1);
    await first;
    await second;

    // A dozen mixed calls across BOTH services — still the same single cached instance.
    for (let i = 0; i < 3; i++) {
      await startSimulation(pokerFixture, vi.fn(), vi.fn());
      await cancelSimulation();
      await startBlackjackSimulation(blackjackFixture, vi.fn(), vi.fn());
      await cancelBlackjackSimulation();
    }
    expect(workers).toHaveLength(1);
  });

  it('routes a worker "error" event into BOTH services\' onError, each exactly once; a second event reports nothing further', async () => {
    pokerRunSimulation.mockImplementation(() => new Promise(() => {}));
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    const pokerOnError = vi.fn();
    const bjOnError = vi.fn();
    void startSimulation(pokerFixture, vi.fn(), pokerOnError);
    void startBlackjackSimulation(blackjackFixture, vi.fn(), bjOnError);
    await vi.waitFor(() => expect(pokerRunSimulation).toHaveBeenCalled());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    workers[0].dispatchEvent(new ErrorEvent('error', { message: 'Failed to load worker script' }));

    expect(pokerOnError).toHaveBeenCalledTimes(1);
    expect(pokerOnError.mock.calls[0][0]).toContain('Failed to load worker script');
    expect(bjOnError).toHaveBeenCalledTimes(1);
    expect(bjOnError.mock.calls[0][0]).toContain('Failed to load worker script');

    // Exactly-once discipline per service: each nulled its callbacks and invalidated its
    // generation BEFORE invoking onError, so a second event finds nothing to report to.
    workers[0].dispatchEvent(new ErrorEvent('error', { message: 'second crash' }));
    expect(pokerOnError).toHaveBeenCalledTimes(1);
    expect(bjOnError).toHaveBeenCalledTimes(1);
  });

  it('routes a worker "messageerror" event into BOTH services\' onError with the message-unreadable text', async () => {
    pokerRunSimulation.mockImplementation(() => new Promise(() => {}));
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    const pokerOnError = vi.fn();
    const bjOnError = vi.fn();
    void startSimulation(pokerFixture, vi.fn(), pokerOnError);
    void startBlackjackSimulation(blackjackFixture, vi.fn(), bjOnError);
    await vi.waitFor(() => expect(pokerRunSimulation).toHaveBeenCalled());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    workers[0].dispatchEvent(new MessageEvent('messageerror'));

    expect(pokerOnError).toHaveBeenCalledTimes(1);
    expect(pokerOnError.mock.calls[0][0]).toMatch(/could not be read/i);
    expect(bjOnError).toHaveBeenCalledTimes(1);
    expect(bjOnError.mock.calls[0][0]).toMatch(/could not be read/i);
  });

  it('does not invoke a finished blackjack run\'s onError after it has already resolved (stale-closure guard)', async () => {
    bjRunSimulation.mockResolvedValue(undefined);

    const onError = vi.fn();
    await startBlackjackSimulation(blackjackFixture, vi.fn(), onError);

    workers[0].dispatchEvent(new ErrorEvent('error', { message: 'late crash, run already done' }));

    expect(onError).not.toHaveBeenCalled();
  });

  it('filters snapshots through its OWN module-lifetime proxy on its own current requestId', async () => {
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    const onProgress = vi.fn();
    void startBlackjackSimulation(blackjackFixture, onProgress, vi.fn());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    const [, requestId, proxy] = bjRunSimulation.mock.calls[0] as [
      BlackjackConditionedState,
      number,
      (snapshot: BlackjackProgressSnapshot) => void,
    ];

    const current = makeSnapshot(requestId);
    proxy(current);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(current);

    // A snapshot from a superseded generation must never reach the caller.
    proxy(makeSnapshot(requestId - 999));
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('a hard crash invalidates the cached handle: the dead thread is terminated and the NEXT start call constructs a FRESH worker that streams (06-REVIEW WR-02)', async () => {
    // Extends the lazy-singleton pins above (zero-on-import, one-on-first-call) with the
    // crash-then-restart case: without invalidation, every post-crash start call routes
    // through the same dead proxy — runSimulation posts into a void, its promise never
    // settles, and the banner's "Deal a new round to try again" recovery copy is
    // unfulfillable (only a full page reload recovers).
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    const onErrorFirst = vi.fn();
    void startBlackjackSimulation(blackjackFixture, vi.fn(), onErrorFirst);
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    const workersBefore = workers.length;
    const crashed = workers[workers.length - 1];
    crashed.dispatchEvent(new ErrorEvent('error', { message: 'hard crash' }));
    expect(onErrorFirst).toHaveBeenCalledTimes(1);
    // The dead thread is released, not leaked.
    expect(crashed.terminated).toBe(true);

    // Restart: a fresh worker is constructed (listeners re-attach inside ensureWorker)
    // and the new generation's snapshots flow again.
    const onProgress = vi.fn();
    void startBlackjackSimulation(blackjackFixture, onProgress, vi.fn());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalledTimes(2));
    expect(workers).toHaveLength(workersBefore + 1);

    const [, requestId, proxy] = bjRunSimulation.mock.calls[1] as [
      BlackjackConditionedState,
      number,
      (snapshot: BlackjackProgressSnapshot) => void,
    ];
    proxy(makeSnapshot(requestId));
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('a late crash event from an ALREADY-REPLACED worker never tears down its healthy replacement (06-REVIEW WR-02)', async () => {
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    void startBlackjackSimulation(blackjackFixture, vi.fn(), vi.fn());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    const stale = workers[0]; // crashed and replaced in earlier cases in this file
    const current = workers[workers.length - 1];
    expect(stale).not.toBe(current);

    stale.dispatchEvent(new ErrorEvent('error', { message: 'zombie event from dead worker' }));

    // The current worker survives: no termination, and the next start call reuses the
    // cached handle rather than constructing yet another worker.
    expect(current.terminated).toBe(false);
    const workersBefore = workers.length;
    void startBlackjackSimulation(blackjackFixture, vi.fn(), vi.fn());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalledTimes(2));
    expect(workers).toHaveLength(workersBefore);
  });

  it('cancelBlackjackSimulation invalidates the main-thread generation and calls api.blackjack.cancel(requestId)', async () => {
    bjRunSimulation.mockImplementation(() => new Promise(() => {}));

    const onProgress = vi.fn();
    void startBlackjackSimulation(blackjackFixture, onProgress, vi.fn());
    await vi.waitFor(() => expect(bjRunSimulation).toHaveBeenCalled());

    const [, requestId, proxy] = bjRunSimulation.mock.calls[0] as [
      BlackjackConditionedState,
      number,
      (snapshot: BlackjackProgressSnapshot) => void,
    ];

    await cancelBlackjackSimulation();
    expect(bjCancel).toHaveBeenCalledWith(requestId);

    // Generation invalidated on the main thread too: a late snapshot for the cancelled
    // requestId is filtered out before reaching onProgress.
    proxy(makeSnapshot(requestId));
    expect(onProgress).not.toHaveBeenCalled();
  });
});
