import type { Card } from '@poker-apprentice/types';
import {
  runTrials,
  unknownCardsPerTrial,
  type ConditionedState,
  type TrialBatchResult,
} from '../engine/equity';
import { OPPONENT_COUNT } from '../engine/cards';
import { shoeSize, cardCounts } from '../engine/shoe';
import { createStreamingRunner } from './streamingRunner';
import { CATEGORY_COUNT } from './protocol';
import type { ProgressSnapshot, SimulationApi, SimulationOptions } from './protocol';

const VALID_BOARD_LENGTHS = new Set([0, 3, 4, 5]);

/**
 * Entry-point validation, defence in depth (T-02-01): malformed internal calls would
 * otherwise silently produce wrong probabilities rather than failing loudly. Wired in
 * below as the generic runner's `validate` hook, so it runs before the run-token
 * supersession machinery ever sees this request.
 */
function validateConditionedState(conditioned: ConditionedState): void {
  const { heroHole, knownBoard, knownOpponentHoles, remainingDeck } = conditioned;

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

  // D-04/DECK-03: `deckCount` is OPTIONAL on `ConditionedState` — absent means 1, so this
  // check is arithmetically identical to the original hardcoded-52-card-deck formula at
  // deckCount=1, and correctly validates a 2-deck request instead of rejecting it.
  const deckCount = conditioned.deckCount ?? 1;
  const revealedCount = knownOpponentHoles.filter((hole) => hole !== null).length;
  const expectedRemainingDeckLength = shoeSize(deckCount) - 2 - knownBoard.length - 2 * revealedCount;
  if (remainingDeck.length !== expectedRemainingDeckLength) {
    throw new Error(
      `runSimulation: remainingDeck must have exactly ${expectedRemainingDeckLength} cards, got ${remainingDeck.length}`,
    );
  }

  // Overlap check (T-02-01, review IN-06, D-04): remainingDeck must never hold more copies of
  // a card VALUE than the shoe physically contains once its known-card copies are spent — a
  // per-value copy BUDGET (knownCount + seenSoFar <= deckCount), not a zero-overlap assertion.
  // At deckCount=1 this collapses to the original rule (a card value may never appear both
  // known AND remaining); at deckCount=2 a value held once by a known hand may legitimately
  // still have its sibling physical copy sitting in remainingDeck. A stale/malformed caller
  // could otherwise silently double-count a card into a trial.
  const knownCards: Card[] = [heroHole[0], heroHole[1], ...knownBoard];
  for (const hole of knownOpponentHoles) {
    if (hole !== null) {
      knownCards.push(hole[0], hole[1]);
    }
  }
  const knownCounts = cardCounts(knownCards);

  const seenCounts = new Map<Card, number>();
  const overBudget: Card[] = [];
  for (const card of remainingDeck) {
    const seenSoFar = (seenCounts.get(card) ?? 0) + 1;
    seenCounts.set(card, seenSoFar);
    const knownCount = knownCounts.get(card) ?? 0;
    if (knownCount + seenSoFar > deckCount) {
      overBudget.push(card);
    }
  }
  if (overBudget.length > 0) {
    throw new Error(`runSimulation: remainingDeck overlaps known cards: ${overBudget.join(', ')}`);
  }
}

/**
 * Creates a pure, Comlink-free simulation API. Node-testable directly (no Worker, no Comlink) —
 * `simulation.worker.ts` is the only place this gets wrapped with `Comlink.expose`.
 */
export function createSimulationApi(options: SimulationOptions = {}): SimulationApi {
  return createStreamingRunner<ConditionedState, TrialBatchResult, ProgressSnapshot>({
    validate: validateConditionedState,
    getRemainingDeck: (conditioned) => conditioned.remainingDeck,
    unknownCardsPerTrial,
    makeEmptyTotals: () => ({
      categoryCounts: new Array(CATEGORY_COUNT).fill(0) as number[],
      outcomes: { win: 0, tie: 0, lose: 0 },
      trialsCompleted: 0,
    }),
    runBatch: runTrials,
    mergeBatch: (totals, batch) => {
      totals.trialsCompleted += batch.trialsCompleted;
      for (let i = 0; i < CATEGORY_COUNT; i++) {
        totals.categoryCounts[i] += batch.categoryCounts[i];
      }
      totals.outcomes.win += batch.outcomes.win;
      totals.outcomes.tie += batch.outcomes.tie;
      totals.outcomes.lose += batch.outcomes.lose;
    },
    toSnapshot: (totals, meta) => ({
      requestId: meta.requestId,
      // Defensive copies — never hand the caller the mutable running arrays/objects.
      categoryCounts: [...totals.categoryCounts],
      outcomes: { ...totals.outcomes },
      trialsCompleted: meta.trialsCompleted,
      done: meta.done,
    }),
    options,
  });
}
