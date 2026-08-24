import type { Card } from '@poker-apprentice/types';
import {
  runBlackjackTrials,
  unknownCardsPerTrial,
  makeEmptyBlackjackTotals,
  BLACKJACK_TRIAL_CARD_BUDGET,
  type BlackjackConditionedState,
  type BlackjackTrialBatchResult,
} from '../engine/blackjackEquity';
import { cardCounts } from '../engine/shoe';
import { createStreamingRunner } from './streamingRunner';
import { DEALER_BUCKET_COUNT } from './blackjackProtocol';
import type { BlackjackProgressSnapshot, BlackjackSimulationApi } from './blackjackProtocol';
import type { SimulationOptions } from './protocol';

/**
 * Entry-point validation, defence in depth (T-06-12, T-06-13): malformed internal calls
 * would otherwise silently produce wrong probabilities rather than failing loudly. Wired in
 * below as the generic runner's `validate` hook, so it runs before the run-token
 * supersession machinery ever sees this request.
 */
function validateBlackjackConditionedState(conditioned: BlackjackConditionedState): void {
  const { playerHand, dealerUpcard, remainingDeck } = conditioned;

  if (playerHand.length < 2) {
    throw new Error(
      `runSimulation: playerHand must have at least 2 cards, got ${playerHand.length}`,
    );
  }
  if (!dealerUpcard) {
    throw new Error(`runSimulation: dealerUpcard must be present, got ${String(dealerUpcard)}`);
  }

  // D-09 / WR-02: deckCount SHAPE validation — value-based, not type-based. `DeckCount = 1 | 2`
  // is a compile-time union and provides no protection at a Comlink boundary, where payloads
  // arrive as deserialized runtime data (the same defence-in-depth framing as this function's
  // header comment). Unlike poker's optional absent-means-1 field, blackjack's `deckCount` is
  // REQUIRED — absent is rejected too, so a forgotten deck-toggle wire-through fails loudly.
  // Placed BEFORE the overlap arithmetic below consumes the value as a copy budget.
  const deckCount = conditioned.deckCount;
  if (deckCount !== 1 && deckCount !== 2) {
    throw new Error(
      `runSimulation: deckCount must be 1 or 2, got ${String(conditioned.deckCount)}`,
    );
  }

  // T-06-13 / 06-RESEARCH Pitfall D: `createDrawer`'s partial Fisher-Yates calls
  // `uniformInt(rng, i, working.length - 1)`, which is invalid once `i >= working.length` —
  // an under-sized pool corrupts or throws deep inside the hot loop instead of failing at
  // this boundary. Defensive, not an expected condition: reachable only in extreme
  // deep-round edge cases (many real hits already taken at deckCount=1).
  if (remainingDeck.length < BLACKJACK_TRIAL_CARD_BUDGET) {
    throw new Error(
      `runSimulation: remainingDeck must have at least ${BLACKJACK_TRIAL_CARD_BUDGET} cards, got ${remainingDeck.length}`,
    );
  }

  // Overlap check (T-06-12, adapted from simulationApi.ts): remainingDeck must never hold
  // more copies of a card VALUE than the shoe physically contains once its known-card copies
  // are spent — a per-value copy BUDGET (knownCount + seenSoFar <= deckCount), not a
  // zero-overlap assertion. At deckCount=2 a value the player holds once may legitimately
  // still have its sibling physical copy sitting in remainingDeck. A present
  // `knownDealerHole` (post-reveal, 06-REVIEW CR-01) is a known card like any other: its
  // copy must already be spent from the pool, so it joins the budget here.
  const knownCards: Card[] = [
    ...playerHand,
    dealerUpcard,
    ...(conditioned.knownDealerHole ? [conditioned.knownDealerHole] : []),
  ];
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
 * Creates a pure, Comlink-free blackjack simulation API. Node-testable directly (no Worker,
 * no Comlink) — `simulation.worker.ts` is the only place this gets wrapped with
 * `Comlink.expose`. A CONFIG on the shared `createStreamingRunner`, never a forked runner
 * (D-08): the runner owns the WR-01 object-identity supersession fix, and a divergent copy
 * would not inherit it.
 */
export function createBlackjackSimulationApi(
  options: SimulationOptions = {},
): BlackjackSimulationApi {
  return createStreamingRunner<
    BlackjackConditionedState,
    BlackjackTrialBatchResult,
    BlackjackProgressSnapshot
  >({
    validate: validateBlackjackConditionedState,
    getRemainingDeck: (conditioned) => conditioned.remainingDeck,
    unknownCardsPerTrial,
    makeEmptyTotals: makeEmptyBlackjackTotals,
    runBatch: runBlackjackTrials,
    mergeBatch: (totals, batch) => {
      totals.trialsCompleted += batch.trialsCompleted;
      for (let i = 0; i < DEALER_BUCKET_COUNT; i++) {
        totals.dealerOutcomeCounts[i] += batch.dealerOutcomeCounts[i];
      }
      totals.bustIfHitCount += batch.bustIfHitCount;
      totals.standOutcomes.win += batch.standOutcomes.win;
      totals.standOutcomes.push += batch.standOutcomes.push;
      totals.standOutcomes.lose += batch.standOutcomes.lose;
      totals.hitOutcomes.win += batch.hitOutcomes.win;
      totals.hitOutcomes.push += batch.hitOutcomes.push;
      totals.hitOutcomes.lose += batch.hitOutcomes.lose;
    },
    toSnapshot: (totals, meta) => ({
      requestId: meta.requestId,
      // Defensive copies — never hand the caller the mutable running arrays/objects.
      // `streamingRunner.ts`'s toSnapshot contract makes this a hard rule: handing back the
      // running accumulator would let a consumer mutate the worker's live totals.
      dealerOutcomeCounts: [...totals.dealerOutcomeCounts],
      bustIfHitCount: totals.bustIfHitCount,
      standOutcomes: { ...totals.standOutcomes },
      hitOutcomes: { ...totals.hitOutcomes },
      trialsCompleted: meta.trialsCompleted,
      done: meta.done,
    }),
    options,
  });
}
