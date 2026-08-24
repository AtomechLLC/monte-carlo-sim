// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { createStreamingRunner, type StreamingRunnerConfig } from './streamingRunner';

/**
 * Proves `createStreamingRunner` (D-06) is genuinely game-agnostic: this fake config's
 * shapes (`FakeConditioned`/`FakeBatch`/`FakeSnapshot`) have nothing to do with Hold'em —
 * no hero hole, no hand categories, no opponents. Only `Card` survives from the poker
 * domain because it is the runner's fixed sampling-pool element type (DECK-03), not a
 * Hold'em concept.
 */
interface FakeConditioned {
  pool: Card[];
  per: number;
}
interface FakeBatch {
  n: number;
  history: number[];
}
interface FakeSnapshot {
  requestId: number;
  n: number;
  history: number[];
  trialsCompleted: number;
  done: boolean;
}

const POOL: Card[] = ['2c', '2d', '2h', '2s', '3c', '3d', '3h', '3s', '4c', '4d'];

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

/** Builds a fresh fake config plus call-tracking arrays for assertions. */
function makeFakeConfig(overrides: Partial<StreamingRunnerConfig<FakeConditioned, FakeBatch, FakeSnapshot>> = {}) {
  const runBatchCalls: number[] = [];
  const drawnCalls: Card[][] = [];

  const config: StreamingRunnerConfig<FakeConditioned, FakeBatch, FakeSnapshot> = {
    getRemainingDeck: (c) => c.pool,
    unknownCardsPerTrial: (c) => c.per,
    makeEmptyTotals: () => ({ n: 0, history: [] }),
    runBatch: (_conditioned, trialCount, drawUnknown) => {
      runBatchCalls.push(trialCount);
      for (let i = 0; i < trialCount; i++) {
        drawnCalls.push(drawUnknown());
      }
      return { n: trialCount, history: [trialCount] };
    },
    mergeBatch: (totals, batch) => {
      totals.n += batch.n;
      totals.history.push(...batch.history);
    },
    toSnapshot: (totals, meta) => ({
      requestId: meta.requestId,
      n: totals.n,
      history: [...totals.history],
      trialsCompleted: meta.trialsCompleted,
      done: meta.done,
    }),
    ...overrides,
  };

  return { config, runBatchCalls, drawnCalls };
}

const conditioned: FakeConditioned = { pool: POOL, per: 2 };

describe('createStreamingRunner — generic streaming Monte Carlo machinery (D-06)', () => {
  it('streams at least 2 snapshots with non-decreasing trialsCompleted, ending done at maxTrials', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];

    await api.runSimulation(conditioned, 1, (s) => {
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
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];
    const requestId = 42;

    await api.runSimulation(conditioned, requestId, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
    for (const s of snapshots) {
      expect(s.requestId).toBe(requestId);
    }
  });

  it('stops emitting snapshots after cancel() and settles the runSimulation promise', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];
    const requestId = 1;

    const runPromise = api.runSimulation(conditioned, requestId, (s) => {
      snapshots.push(s);
    });

    await waitUntil(() => snapshots.length > 0);
    api.cancel(requestId);

    await runPromise;
    const countAtCancel = snapshots.length;

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots.length).toBe(countAtCancel);
  });

  it('cancel() for a requestId that is NOT the in-flight one does not stop the running loop', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];
    const requestId = 9;

    const runPromise = api.runSimulation(conditioned, requestId, (s) => {
      snapshots.push(s);
    });

    // Wrong id — must be a no-op, letting the run reach completion undisturbed.
    api.cancel(requestId + 1);

    await runPromise;
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.trialsCompleted).toBe(20000);
  });

  it('stops run 1 from emitting once run 2 supersedes it with a newer requestId', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 },
    });
    const snapshots1: FakeSnapshot[] = [];
    const snapshots2: FakeSnapshot[] = [];

    const run1 = api.runSimulation(conditioned, 1, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    const run2 = api.runSimulation(conditioned, 2, (s) => {
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
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 50_000_000, batchSize: 2000, progressIntervalMs: 0 },
    });
    const snapshots1: FakeSnapshot[] = [];
    const snapshots2: FakeSnapshot[] = [];
    const requestId = 7;

    const run1 = api.runSimulation(conditioned, requestId, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    // Re-entry with the SAME requestId — supersession must be decided by run-token identity,
    // not requestId equality, or run 1 would never notice it has been superseded.
    const run2 = api.runSimulation(conditioned, requestId, (s) => {
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

  it('a validate hook that throws causes runSimulation to reject, with no snapshot emitted and no batch run', async () => {
    const { config, runBatchCalls } = makeFakeConfig({
      validate: () => {
        throw new Error('fake validation failure');
      },
    });
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];

    await expect(
      api.runSimulation(conditioned, 1, (s) => {
        snapshots.push(s);
      }),
    ).rejects.toThrow('fake validation failure');

    expect(snapshots.length).toBe(0);
    expect(runBatchCalls.length).toBe(0);
  });

  it('when validate is omitted entirely, the run proceeds normally', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 100, batchSize: 100, progressIntervalMs: 0 },
    });
    const snapshots: FakeSnapshot[] = [];

    await api.runSimulation(conditioned, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('with a large progressIntervalMs and several batches, exactly 2 snapshots are emitted: first batch and final done batch', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 15000, batchSize: 5000, progressIntervalMs: 100000 },
    });
    const snapshots: FakeSnapshot[] = [];

    await api.runSimulation(conditioned, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBe(2);
    expect(snapshots[0].trialsCompleted).toBe(5000);
    expect(snapshots[1].trialsCompleted).toBe(15000);
    expect(snapshots[1].done).toBe(true);
  });

  it('drawUnknown supplies exactly unknownCardsPerTrial(conditioned) cards per call, drawn from getRemainingDeck(conditioned) without replacement', async () => {
    const pool: Card[] = ['5c', '5d', '5h', '5s', '6c', '6d', '6h', '6s'];
    const per = 3;
    const { config, drawnCalls } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 20, batchSize: 20, progressIntervalMs: 0 },
    });

    await api.runSimulation({ pool, per }, 1, () => {});

    expect(drawnCalls.length).toBe(20);
    for (const draw of drawnCalls) {
      expect(draw.length).toBe(per);
      expect(new Set(draw).size).toBe(per);
      for (const card of draw) {
        expect(pool).toContain(card);
      }
    }
  });

  it('mutating an array field on a received snapshot does not corrupt any later snapshot', async () => {
    const { config } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 300, batchSize: 100, progressIntervalMs: 0 },
    });
    const received: FakeSnapshot[] = [];

    await api.runSimulation(conditioned, 1, (s) => {
      received.push(s);
    });

    expect(received.length).toBe(3);
    // Mutate the first received snapshot's array field after the fact — a shared-reference
    // bug would mean every snapshot's `history` is the SAME array, so this mutation would
    // leak into the later snapshots too.
    received[0].history.push(-1);
    expect(received[1].history).toEqual([100, 100]);
    expect(received[2].history).toEqual([100, 100, 100]);
  });

  it('runBatch is never called with a trialCount that would push the total past maxTrials (final batch clamped)', async () => {
    const { config, runBatchCalls } = makeFakeConfig();
    const api = createStreamingRunner({
      ...config,
      options: { maxTrials: 1200, batchSize: 500, progressIntervalMs: 0 },
    });

    await api.runSimulation(conditioned, 1, () => {});

    expect(runBatchCalls).toEqual([500, 500, 200]);
    expect(runBatchCalls.reduce((sum, n) => sum + n, 0)).toBe(1200);
  });
});
