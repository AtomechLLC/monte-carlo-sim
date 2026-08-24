// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSimulationApi } from './simulationApi';
import { FULL_DECK, deckWithout, OPPONENT_COUNT } from '../engine/cards';
import type { ProgressSnapshot } from './protocol';
import type { ConditionedState } from '../engine/equity';
import { deriveConditionedState } from '../engine/conditioning';
import type { PredeterminedRunout } from '../engine/conditioning';

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [FULL_DECK[0], FULL_DECK[1]];
const remainingDeck = deckWithout(heroHole);

const preflopState: ConditionedState = {
  heroHole,
  knownBoard: [],
  knownOpponentHoles: [null, null, null],
  remainingDeck,
};

// Fixed fixture for the flop-conditioned happy-path test — 13 disjoint slices of FULL_DECK.
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

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

describe('createSimulationApi — pure, Comlink-free streaming pipeline', () => {
  it('deckWithout produces a 50-card remaining deck for a 2-card hero hand (sanity check on test fixtures)', () => {
    expect(remainingDeck).toHaveLength(50);
  });

  it('streams at least 2 snapshots with non-decreasing trialsCompleted, ending done at maxTrials', async () => {
    const api = createSimulationApi({ maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];

    await api.runSimulation(preflopState, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].trialsCompleted).toBeGreaterThanOrEqual(snapshots[i - 1].trialsCompleted);
    }
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.trialsCompleted).toBe(20000);
  });

  it('tags every emitted snapshot with the requestId passed to runSimulation', async () => {
    const api = createSimulationApi({ maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    const requestId = 42;

    await api.runSimulation(preflopState, requestId, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
    for (const s of snapshots) {
      expect(s.requestId).toBe(requestId);
    }
  });

  it('stops emitting snapshots after cancel() and settles the runSimulation promise', async () => {
    const api = createSimulationApi({ maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    const requestId = 1;

    const runPromise = api.runSimulation(preflopState, requestId, (s) => {
      snapshots.push(s);
    });

    await waitUntil(() => snapshots.length > 0);
    api.cancel(requestId);

    await runPromise;
    const countAtCancel = snapshots.length;

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots.length).toBe(countAtCancel);
  });

  it('stops run 1 from emitting once run 2 supersedes it with a newer requestId', async () => {
    const api = createSimulationApi({ maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 });
    const snapshots1: ProgressSnapshot[] = [];
    const snapshots2: ProgressSnapshot[] = [];

    const run1 = api.runSimulation(preflopState, 1, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    const run2 = api.runSimulation(preflopState, 2, (s) => {
      snapshots2.push(s);
    });

    await run1;
    await waitUntil(() => snapshots2.length > 0);

    const countAtSupersede = snapshots1.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots1.length).toBe(countAtSupersede);

    api.cancel(2);
    await run2;
  });

  it('stops run 1 from emitting once run 2 supersedes it with the SAME requestId (WR-01 regression guard)', async () => {
    const api = createSimulationApi({ maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 });
    const snapshots1: ProgressSnapshot[] = [];
    const snapshots2: ProgressSnapshot[] = [];
    const requestId = 7;

    const run1 = api.runSimulation(preflopState, requestId, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    // Re-entry with the SAME requestId — supersession must be decided by run-token identity,
    // not requestId equality, or run 1 would never notice it has been superseded.
    const run2 = api.runSimulation(preflopState, requestId, (s) => {
      snapshots2.push(s);
    });

    await run1;
    await waitUntil(() => snapshots2.length > 0);

    const countAtSupersede = snapshots1.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots1.length).toBe(countAtSupersede);

    api.cancel(requestId);
    await run2;
  });

  it('accepts a flop-conditioned state (47-card remainingDeck, 3 known board cards) without throwing (Pitfall 2 regression guard)', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const flopState = deriveConditionedState(runout, 'flop', 0);
    expect(flopState.remainingDeck).toHaveLength(47);

    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(flopState, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
  });

  describe('entry-point validation', () => {
    it('rejects heroHole with a length other than 2', async () => {
      const api = createSimulationApi();
      const badState = {
        ...preflopState,
        heroHole: [FULL_DECK[0]] as unknown as [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]],
      };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        'runSimulation: heroHole must have exactly 2 cards, got 1',
      );
    });

    it('rejects knownBoard whose length is not 0, 3, 4, or 5', async () => {
      const api = createSimulationApi();
      const badState: ConditionedState = { ...preflopState, knownBoard: [FULL_DECK[2], FULL_DECK[3]] };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        'runSimulation: knownBoard must have 0, 3, 4, or 5 cards, got 2',
      );
    });

    it('rejects knownOpponentHoles whose length is not OPPONENT_COUNT', async () => {
      const api = createSimulationApi();
      const badState: ConditionedState = { ...preflopState, knownOpponentHoles: [null, null] };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: knownOpponentHoles must have exactly ${OPPONENT_COUNT} entries, got 2`,
      );
    });

    it('rejects a remainingDeck whose length does not match the computed expected length', async () => {
      const api = createSimulationApi();
      const badState: ConditionedState = {
        ...preflopState,
        remainingDeck: preflopState.remainingDeck.slice(1),
      };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        'runSimulation: remainingDeck must have exactly 50 cards, got 49',
      );
    });

    it('rejects a remainingDeck that overlaps a known hero-hole card, naming the overlapping card', async () => {
      const api = createSimulationApi();
      const badState: ConditionedState = {
        ...preflopState,
        remainingDeck: [...preflopState.remainingDeck.slice(1), heroHole[0]],
      };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck overlaps known cards: ${heroHole[0]}`,
      );
    });

    it('rejects a remainingDeck that overlaps a known board card, naming the overlapping card', async () => {
      const api = createSimulationApi();
      const flopState = deriveConditionedState(runout, 'flop', 0);
      const badState: ConditionedState = {
        ...flopState,
        remainingDeck: [...flopState.remainingDeck.slice(1), flopState.knownBoard[0]],
      };

      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck overlaps known cards: ${flopState.knownBoard[0]}`,
      );
    });
  });
});
