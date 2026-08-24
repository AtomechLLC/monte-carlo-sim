/**
 * The blackjack Monte Carlo trial loop (BJ-03, BJ-04): one shared per-trial draw services
 * ALL four displayed statistics — the dealer's 7-bucket outcome distribution, bust-if-hit,
 * and the Stand/Hit win-push-lose tallies — from disjoint cursor prefixes of a single
 * without-replacement sample. Pure and node-testable: no worker, no DOM, no evaluator
 * involvement anywhere (D-08).
 */
import type { Card } from '@poker-apprentice/types';
import type { DeckCount } from './shoe';
import { BUCKET_INDEX, DEALER_BUCKET_COUNT } from '../worker/blackjackProtocol';
import { handTotal, playDealerHand, classifyDealerOutcome, compareToDealer } from './blackjackHandValue';

/**
 * The known/unknown card partition a blackjack trial batch is conditioned on. ALWAYS
 * derived from the user's current visibility state (`deriveBlackjackConditionedState` in
 * `blackjackConditioning.ts`) — never from the stored predetermined round directly (D-02).
 */
export interface BlackjackConditionedState {
  /** The player's current hand — 2 cards at the first decision point, more after real hits. */
  playerHand: Card[];
  /** The dealer's face-up card — always known from deal time. */
  dealerUpcard: Card;
  /**
   * Present iff the hole has been revealed — the dealer's ACTUAL hole card (D-02,
   * 06-REVIEW CR-01). When present, every trial uses it as the dealer's hole instead of
   * resampling a hypothetical one from `remainingDeck`: pool exclusion alone would
   * condition every statistic on "the hole is some card OTHER than the one face-up on
   * the table" — the contradiction of what was revealed. Set exclusively by
   * `deriveBlackjackConditionedState` (the sole reader); when present the card is also
   * excluded from `remainingDeck`.
   */
  knownDealerHole?: Card;
  /**
   * Every physical card not visible/known: the full shoe minus the player's hand, the
   * upcard, the revealed hole (if revealed) and any live-drawn cards. While the hole is
   * hidden its physical card deliberately REMAINS in this pool (D-02).
   */
  remainingDeck: Card[];
  /**
   * Physical decks the shoe was built from. REQUIRED — deliberately unlike poker's
   * optional `deckCount?`: blackjack has no legacy callers, so a forgotten deck-toggle
   * wire-through must fail to compile rather than silently simulate one deck.
   */
  deckCount: DeckCount;
}

/**
 * Fixed per-trial card budget: 1 hypothetical dealer hole + up to 10 dealer hits + 1
 * disjoint player hit card. Deliberately generous rather than exact — the number of
 * dealer hits is data-dependent, so no fixed formula can express it, and a dealer hand
 * needing more than ~8-9 cards is bounded away by how few copies of each low rank the
 * shoe physically holds. Reserving unused slots is nearly free (`createDrawer`'s partial
 * Fisher-Yates costs O(budget) swaps regardless of pool size), and any prefix of a
 * uniform without-replacement sample is itself a valid without-replacement sample, so
 * consuming a cursor-based prefix introduces no bias. When `knownDealerHole` is present
 * (post-reveal, 06-REVIEW CR-01) each trial consumes one FEWER slot — the hole is not
 * drawn — so the same fixed budget remains sufficient in both modes.
 */
export const BLACKJACK_TRIAL_CARD_BUDGET = 12;

/**
 * Number of cards `drawUnknown()` must supply per trial. Deliberately independent of
 * `state` (the fixed generous budget above, not a rule-derived count) — the parameter
 * stays so the runner config plugs this in exactly like `equity.ts`'s
 * `unknownCardsPerTrial(state)`, and the `void` read keeps the deliberately-unused
 * parameter lint-clean without an inline disable.
 */
export function unknownCardsPerTrial(state: BlackjackConditionedState): number {
  void state;
  return BLACKJACK_TRIAL_CARD_BUDGET;
}

/** Win/push/lose integer tallies for one decision path (Stand or Hit). */
export interface BlackjackOutcomeCounts {
  win: number;
  push: number;
  lose: number;
}

/** Tallies produced by a single call to `runBlackjackTrials` — integers only; percentages and EV are derived at display time. */
export interface BlackjackTrialBatchResult {
  /** Length `DEALER_BUCKET_COUNT`, indexed by `DEALER_BUCKET_ORDER` (fixed order). */
  dealerOutcomeCounts: number[];
  /** Trials whose hypothetical hit card busted the player — see the tally note in `runBlackjackTrials`. */
  bustIfHitCount: number;
  standOutcomes: BlackjackOutcomeCounts;
  hitOutcomes: BlackjackOutcomeCounts;
  trialsCompleted: number;
}

export function makeEmptyBlackjackTotals(): BlackjackTrialBatchResult {
  return {
    dealerOutcomeCounts: new Array<number>(DEALER_BUCKET_COUNT).fill(0),
    bustIfHitCount: 0,
    standOutcomes: { win: 0, push: 0, lose: 0 },
    hitOutcomes: { win: 0, push: 0, lose: 0 },
    trialsCompleted: 0,
  };
}

/**
 * Runs `trialCount` Monte Carlo trials for the current decision point.
 *
 * Option A (06-RESEARCH design fork, locked by plan 06-01): hypothetical dealer holes are
 * sampled uniformly from the conditioned pool and may form a hypothetical dealer natural;
 * the loop deliberately does NOT reject-sample those away, so the numbers stay directly
 * comparable to the published upcard tables this phase's verification anchors come from.
 * Option B (rejection sampling, conditioning on "the round reached a decision point") is
 * a deferred rigor enhancement requiring its own decision record — never an ad-hoc
 * mid-implementation fix.
 */
export function runBlackjackTrials(
  state: BlackjackConditionedState,
  trialCount: number,
  drawUnknown: () => Card[],
): BlackjackTrialBatchResult {
  const totals = makeEmptyBlackjackTotals();
  // The player's current-hand total is invariant across trials — computed once. Stand is
  // only reachable on a valid (non-bust) hand.
  const playerNow = handTotal(state.playerHand);

  for (let t = 0; t < trialCount; t++) {
    // The ONLY per-trial draw: one 12-card without-replacement sample, consumed as
    // disjoint cursor prefixes by the roles below. Drawing twice in one trial would give
    // the dealer and the hit hypothetical two independent samples that can collide on
    // the same physical card.
    const drawn = drawUnknown();
    let cursor = 0;

    // 1. Dealer hole. REVEALED (BJ-06, 06-REVIEW CR-01): the known card IS the hole in
    //    every trial — the trial consumes one FEWER drawn slot, so the fixed 12-card
    //    budget stays sufficient (worst case drops from 11 to 10 consumed). HIDDEN: one
    //    hypothetical draw shared by the Stand-path and Hit-path comparisons. That
    //    sharing is common random numbers, a variance-reduction technique, not a bias:
    //    dealer play under a fixed rule is independent of the player's choice, so
    //    reusing one valid dealer sample to answer both counterfactual questions only
    //    reduces variance in their difference.
    const dealerHole = state.knownDealerHole ?? drawn[cursor++];

    // 2. Dealer playout — MUST be Task 1's playDealerHand with a drawNext closure over
    //    the same cursor, never an inline hit-loop copy. An inline copy would be a second
    //    implementation of the S17 rule that the exact-value vectors in
    //    blackjackHandValue.test.ts do not cover, so a demotion-loop or off-by-one bug
    //    there would pass every other test and surface only as a small, unexplained skew
    //    in the displayed distribution. One implementation, one set of vectors (D-04).
    const dealer = playDealerHand(state.dealerUpcard, dealerHole, () => drawn[cursor++]);
    const dealerBucket = classifyDealerOutcome(dealer.cards, dealer.result);
    totals.dealerOutcomeCounts[BUCKET_INDEX[dealerBucket]]++;

    const dealerForCompare = {
      total: dealer.result.total,
      bust: dealer.result.bust,
      bucket: dealerBucket,
    };

    // 3. STAND path: the player's CURRENT (already-decided) hand vs. the shared dealer outcome.
    totals.standOutcomes[compareToDealer(playerNow, dealerForCompare)]++;

    // 4. HIT path: a DISTINCT, not-yet-consumed slot from the SAME trial's draw — the
    //    cursor has advanced past every card the dealer playout consumed, so the hit
    //    hypothetical can never reuse one of the dealer's physical cards.
    const hitCard = drawn[cursor++];
    const playerAfterHit = handTotal([...state.playerHand, hitCard]);
    if (playerAfterHit.bust) {
      // bustIfHitCount is its OWN tally, deliberately not derived from hitOutcomes.lose:
      // a hit can lose WITHOUT busting (post-hit total below the dealer's), so
      // "bust-if-hit %" and "P(lose | hit)" are two different displayed numbers that only
      // overlap for the hands that actually bust.
      totals.bustIfHitCount++;
      totals.hitOutcomes.lose++;
    } else {
      totals.hitOutcomes[compareToDealer(playerAfterHit, dealerForCompare)]++;
    }
  }

  totals.trialsCompleted = trialCount;
  return totals;
}
