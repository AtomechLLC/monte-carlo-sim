// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSimulationApi } from './simulationApi';
import { FULL_DECK, deckWithout } from '../engine/cards';
import type { ProgressSnapshot } from './protocol';

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [FULL_DECK[0], FULL_DECK[1]];
const remainingDeck = deckWithout(heroHole);

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

    await api.runSimulation(heroHole, remainingDeck, 1, (s) => {
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

    await api.runSimulation(heroHole, remainingDeck, requestId, (s) => {
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

    const runPromise = api.runSimulation(heroHole, remainingDeck, requestId, (s) => {
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

    const run1 = api.runSimulation(heroHole, remainingDeck, 1, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    const run2 = api.runSimulation(heroHole, remainingDeck, 2, (s) => {
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
});
