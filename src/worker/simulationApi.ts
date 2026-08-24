import type { Card } from '@poker-apprentice/types';
import { runTrials, unknownCardsPerTrial } from '../engine/equity';
import type { ConditionedState } from '../engine/equity';
import { createRng, createDrawer } from '../engine/rng';
import { FULL_DECK, OPPONENT_COUNT } from '../engine/cards';
import {
  CATEGORY_COUNT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_PROGRESS_INTERVAL_MS,
  DEFAULT_MAX_TRIALS,
} from './protocol';
import type { ProgressSnapshot, SimulationApi, SimulationOptions } from './protocol';

const VALID_BOARD_LENGTHS = new Set([0, 3, 4, 5]);

/**
 * Creates a pure, Comlink-free simulation API. Node-testable directly (no Worker, no Comlink) —
 * `simulation.worker.ts` is the only place this gets wrapped with `Comlink.expose`.
 */
export function createSimulationApi(options: SimulationOptions = {}): SimulationApi {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const progressIntervalMs = options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS;
  const maxTrials = options.maxTrials ?? DEFAULT_MAX_TRIALS;

  let currentRequestId = -1;
  // Per-invocation identity token. Supersession is decided by OBJECT IDENTITY, not by
  // requestId equality (WR-01) — a caller that re-enters `runSimulation` with the SAME
  // requestId still gets a fresh token here, so the stale loop's `runToken === currentRunToken`
  // check correctly fails and it stops emitting, even though `requestId` didn't change.
  let currentRunToken: object | null = null;

  return {
    cancel(requestId: number): void {
      if (requestId === currentRequestId) {
        currentRequestId = -1;
        currentRunToken = null;
      }
    },

    async runSimulation(
      conditioned: ConditionedState,
      requestId: number,
      onProgress: (snapshot: ProgressSnapshot) => void | Promise<void>,
    ): Promise<void> {
      const { heroHole, knownBoard, knownOpponentHoles, remainingDeck } = conditioned;

      // Entry-point validation, defence in depth (T-02-01): malformed internal calls would
      // otherwise silently produce wrong probabilities rather than failing loudly.
      if (heroHole.length !== 2) {
        throw new Error(`runSimulation: heroHole must have exactly 2 cards, got ${heroHole.length}`);
      }
      if (!VALID_BOARD_LENGTHS.has(knownBoard.length)) {
        throw new Error(
          `runSimulation: knownBoard must have 0, 3, 4, or 5 cards, got ${knownBoard.length}`,
        );
      }
      if (knownOpponentHoles.length !== OPPONENT_COUNT) {
        throw new Error(
          `runSimulation: knownOpponentHoles must have exactly ${OPPONENT_COUNT} entries, got ${knownOpponentHoles.length}`,
        );
      }

      const revealedCount = knownOpponentHoles.filter((hole) => hole !== null).length;
      const expectedRemainingDeckLength = FULL_DECK.length - 2 - knownBoard.length - 2 * revealedCount;
      if (remainingDeck.length !== expectedRemainingDeckLength) {
        throw new Error(
          `runSimulation: remainingDeck must have exactly ${expectedRemainingDeckLength} cards, got ${remainingDeck.length}`,
        );
      }

      // Overlap check (T-02-01, review IN-06): remainingDeck must not intersect any known card
      // — a stale/malformed caller could otherwise silently double-count a card into a trial.
      const knownCards = new Set<Card>([heroHole[0], heroHole[1], ...knownBoard]);
      for (const hole of knownOpponentHoles) {
        if (hole !== null) {
          knownCards.add(hole[0]);
          knownCards.add(hole[1]);
        }
      }
      const overlapping = remainingDeck.filter((card) => knownCards.has(card));
      if (overlapping.length > 0) {
        throw new Error(`runSimulation: remainingDeck overlaps known cards: ${overlapping.join(', ')}`);
      }

      currentRequestId = requestId;
      const runToken = {};
      currentRunToken = runToken;

      const rng = createRng(options.seed);
      const drawUnknown = createDrawer(rng, remainingDeck, unknownCardsPerTrial(conditioned));

      const totals = {
        categoryCounts: new Array(CATEGORY_COUNT).fill(0) as number[],
        outcomes: { win: 0, tie: 0, lose: 0 },
        trialsCompleted: 0,
      };

      let lastEmitAt: number | null = null;

      while (runToken === currentRunToken) {
        const trialsThisBatch = Math.min(batchSize, maxTrials - totals.trialsCompleted);
        const batch = runTrials(conditioned, trialsThisBatch, drawUnknown);

        totals.trialsCompleted += batch.trialsCompleted;
        for (let i = 0; i < CATEGORY_COUNT; i++) {
          totals.categoryCounts[i] += batch.categoryCounts[i];
        }
        totals.outcomes.win += batch.outcomes.win;
        totals.outcomes.tie += batch.outcomes.tie;
        totals.outcomes.lose += batch.outcomes.lose;

        // Supersession/cancellation check — bail without emitting a stale snapshot.
        if (runToken !== currentRunToken) {
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
