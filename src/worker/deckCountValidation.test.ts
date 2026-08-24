// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSimulationApi } from './simulationApi';
import { FULL_DECK, deckWithout } from '../engine/cards';
import { shoeWithout, type DeckCount } from '../engine/shoe';
import type { ConditionedState } from '../engine/equity';
import type { ProgressSnapshot } from './protocol';

// WR-02 / D-09: deckCount SHAPE validation at the worker boundary, for BOTH game APIs.
// `DeckCount = 1 | 2` is a compile-time union and provides no protection at a Comlink
// boundary — payloads arrive as deserialized runtime data, so the check must be VALUE-based,
// not type-based. This file is a new sibling of `simulationApi.test.ts` (a frozen contract
// that must not be edited); both game APIs' deckCount rejections are pinned here in one
// place. The absent-means-1 acceptance below is what keeps the byte-frozen golden fixtures
// (which omit `deckCount`) valid.

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [
  FULL_DECK[0],
  FULL_DECK[1],
];

/** A valid poker conditioned state; `deckCount` injected by callers (possibly invalid). */
function pokerState(deckCount?: unknown): ConditionedState {
  const state: ConditionedState = {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
  if (deckCount !== undefined) {
    state.deckCount = deckCount as DeckCount;
  }
  return state;
}

function waitUntil(predicate: () => boolean, timeoutMs = 2000, intervalMs = 5): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('waitUntil: timed out waiting for predicate'));
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

describe('poker API — deckCount shape validation (WR-02, D-09)', () => {
  // Asserting on the EXACT deckCount message also pins placement: if the check ran after
  // `shoeSize(deckCount)` consumed the value, these states would instead trip the
  // remainingDeck-length error (e.g. shoeSize(0) - 2 = -2 !== 50) with a different message.
  it.each([[0], [3], [1.5]])(
    'rejects present-but-invalid deckCount %s with a clear boundary error',
    async (bad) => {
      const api = createSimulationApi();
      await expect(api.runSimulation(pokerState(bad), 1, () => {})).rejects.toThrow(
        `runSimulation: deckCount must be 1 or 2, got ${String(bad)}`,
      );
    },
  );

  it("rejects the string '2' — the shape a Comlink-deserialized payload can carry", async () => {
    const api = createSimulationApi();
    await expect(api.runSimulation(pokerState('2'), 1, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got 2',
    );
  });

  it('an ABSENT deckCount still means 1 deck and does not throw (golden-fixture compatibility)', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(pokerState(), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('accepts an explicit deckCount of 1', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(pokerState(1), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('accepts an explicit deckCount of 2 (102-card remaining shoe)', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const twoDeckState: ConditionedState = {
      ...pokerState(2),
      remainingDeck: shoeWithout(2, heroHole),
    };
    expect(twoDeckState.remainingDeck).toHaveLength(102);
    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(twoDeckState, 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('a rejected invalid request never supersedes a healthy in-flight run', async () => {
    // Pins `createStreamingRunner`'s validate-before-assign ordering: `validate` throws
    // BEFORE currentRequestId/currentRunToken are assigned, so a rejected request is
    // harmless — the healthy in-flight run must keep emitting all the way to done.
    const api = createSimulationApi({ maxTrials: 40000, batchSize: 2000, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    const run = api.runSimulation(pokerState(), 1, (s) => {
      snapshots.push(s);
    });

    await waitUntil(() => snapshots.length > 0);

    await expect(api.runSimulation(pokerState(0), 2, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got 0',
    );

    await run;
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.trialsCompleted).toBe(40000);
  });
});
