import type { Card } from '@poker-apprentice/types';
import { runTrials } from '../engine/equity';
import { createRng, createDrawer } from '../engine/rng';
import { FULL_DECK, CARDS_PER_TRIAL } from '../engine/cards';
import {
  CATEGORY_COUNT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_PROGRESS_INTERVAL_MS,
  DEFAULT_MAX_TRIALS,
} from './protocol';
import type { ProgressSnapshot, SimulationApi, SimulationOptions } from './protocol';

/**
 * Creates a pure, Comlink-free simulation API. Node-testable directly (no Worker, no Comlink) —
 * `simulation.worker.ts` is the only place this gets wrapped with `Comlink.expose`.
 */
export function createSimulationApi(options: SimulationOptions = {}): SimulationApi {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const progressIntervalMs = options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS;
  const maxTrials = options.maxTrials ?? DEFAULT_MAX_TRIALS;

  let currentRequestId = -1;

  return {
    cancel(requestId: number): void {
      if (requestId === currentRequestId) {
        currentRequestId = -1;
      }
    },

    async runSimulation(
      heroHole: [Card, Card],
      remainingDeck: Card[],
      requestId: number,
      onProgress: (snapshot: ProgressSnapshot) => void | Promise<void>,
    ): Promise<void> {
      // Entry-point validation, defence in depth (T-02-02): malformed internal calls would
      // otherwise silently produce wrong probabilities rather than failing loudly.
      if (heroHole.length !== 2) {
        throw new Error(`runSimulation: heroHole must have exactly 2 cards, got ${heroHole.length}`);
      }
      if (remainingDeck.length !== FULL_DECK.length - 2) {
        throw new Error(
          `runSimulation: remainingDeck must have exactly ${FULL_DECK.length - 2} cards, got ${remainingDeck.length}`,
        );
      }

      currentRequestId = requestId;

      const rng = createRng(options.seed);
      const draw11 = createDrawer(rng, remainingDeck, CARDS_PER_TRIAL);

      const totals = {
        categoryCounts: new Array(CATEGORY_COUNT).fill(0) as number[],
        outcomes: { win: 0, tie: 0, lose: 0 },
        trialsCompleted: 0,
      };

      let lastEmitAt: number | null = null;

      while (requestId === currentRequestId) {
        const trialsThisBatch = Math.min(batchSize, maxTrials - totals.trialsCompleted);
        const batch = runTrials({ heroHole, remainingDeck }, trialsThisBatch, draw11);

        totals.trialsCompleted += batch.trialsCompleted;
        for (let i = 0; i < CATEGORY_COUNT; i++) {
          totals.categoryCounts[i] += batch.categoryCounts[i];
        }
        totals.outcomes.win += batch.outcomes.win;
        totals.outcomes.tie += batch.outcomes.tie;
        totals.outcomes.lose += batch.outcomes.lose;

        // Supersession/cancellation check — bail without emitting a stale snapshot.
        if (requestId !== currentRequestId) {
          return;
        }

        const done = totals.trialsCompleted >= maxTrials;
        const now = Date.now();
        const shouldEmit = lastEmitAt === null || done || now - lastEmitAt >= progressIntervalMs;

        if (shouldEmit) {
          lastEmitAt = now;
          // Defensive copies — never hand the caller the mutable running arrays/objects.
          await onProgress({
            requestId,
            categoryCounts: [...totals.categoryCounts],
            outcomes: { ...totals.outcomes },
            trialsCompleted: totals.trialsCompleted,
            done,
          });
        }

        if (done) {
          return;
        }

        // Yield so pending cancel()/newer runSimulation() calls can be processed.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  };
}
