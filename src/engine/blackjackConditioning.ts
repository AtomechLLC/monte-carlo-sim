/**
 * The dual-exclusion-set rule (06-RESEARCH Pattern 1) — the phase's central new
 * architectural principle. A Blackjack round needs TWO structurally different
 * "known cards" exclusion sets derived from the SAME predetermined round:
 *
 * 1. The ODDS-CONDITIONING set (`deriveBlackjackConditionedState`): the hidden hole card
 *    deliberately stays OUT of this set until revealed, so Monte Carlo trials keep
 *    resampling it as unknown (D-02).
 * 2. The LIVE SHOE LEDGER (`liveShoeLedger`): the hole card is ALWAYS in this set,
 *    hidden or not, because it is a real physical card already removed from the shoe
 *    (D-01, D-11).
 *
 * The two failure modes if these are conflated (06-RESEARCH Pattern 1, verbatim):
 * - Using the live ledger's exclusion set for ODDS conditioning would remove the
 *   predetermined hole card from the Monte Carlo trial pool, silently narrowing the
 *   sample space the trials draw from — a bias, not a crash, so it would not be caught
 *   by a smoke test.
 * - Using the odds-conditioning set for a LIVE draw would leave the predetermined hole
 *   card "in the pool," risking the live draw physically re-dealing the exact same card
 *   that is secretly the hole card — impossible at deckCount=1 (shoe integrity
 *   violation: two copies of one card on the table) and silently wrong at deckCount=2
 *   (the sibling copy gets consumed by the wrong role).
 *
 * Every "what remains in the shoe" read in the blackjack path must go through exactly
 * one of these two functions — never a third ad-hoc exclusion list.
 */
import type { Card } from '@poker-apprentice/types';
import { shoeWithout, type DeckCount } from './shoe';
import { isNatural } from './blackjackHandValue';
import type { BlackjackConditionedState } from './blackjackEquity';

/**
 * The dealer's cards, predetermined at deal time (D-01): the face-up upcard and the
 * face-down hole card. The hole is real and already dealt, but not necessarily visible
 * to the user yet — that depends on `revealedHole`.
 */
export interface PredeterminedBlackjackRound {
  dealerUpcard: Card;
  dealerHole: Card;
}

export type BlackjackOutcome = 'win' | 'push' | 'lose';

/** The deal-time natural check's verdict — see `resolveNaturals`. */
export interface NaturalResolution {
  /** True when EITHER side holds a natural and the round is over before any player turn. */
  resolved: boolean;
  outcome: BlackjackOutcome | null;
  playerNatural: boolean;
  dealerNatural: boolean;
}

/**
 * Derives the simulation's known/unknown card partition from the user's CURRENT
 * visibility state — never from the raw predetermined round directly.
 *
 * This is the ONLY function in the codebase permitted to read `round.dealerHole` for
 * ODDS/simulation-input purposes (D-02, PITFALLS Pitfall 5). Every other module that
 * needs conditioned odds input must call this function rather than slicing the raw round
 * itself — that is what keeps the face-down hole card out of the odds computation. While
 * hidden, the hole card REMAINS in `remainingDeck` (the unknown pool) and is never
 * dropped: dropping it would silently narrow the trial sample space (the first failure
 * mode in the module header). Once REVEALED, the hole's IDENTITY travels to the trial
 * loop as `knownDealerHole` (and its copy leaves `remainingDeck`): pool exclusion alone
 * would condition every statistic on "the hole is anything BUT the revealed card" — the
 * contradiction of what the user can see (BJ-06 reconditioning, 06-REVIEW CR-01). Both
 * halves of that reveal transition live HERE, inside the sole reader — no other module
 * may derive either from the raw round. `remainingDeck` is derived by count-aware
 * subtraction over a `deckCount`-sized shoe, so at 2 decks a sibling copy of any known
 * card legitimately remains in the pool.
 *
 * `deckCount` is REQUIRED — deliberately unlike `deriveConditionedState`'s `= 1`
 * back-compat default, which exists only for Hold'em's legacy callers. Blackjack has
 * none, so a forgotten deck-toggle wire-through fails to compile instead of silently
 * simulating one deck.
 */
export function deriveBlackjackConditionedState(
  round: PredeterminedBlackjackRound,
  playerCardsSoFar: readonly Card[],
  revealedHole: boolean,
  deckCount: DeckCount,
): BlackjackConditionedState {
  const knownCards: Card[] = [
    ...playerCardsSoFar,
    round.dealerUpcard,
    ...(revealedHole ? [round.dealerHole] : []),
  ];
  return {
    playerHand: [...playerCardsSoFar],
    dealerUpcard: round.dealerUpcard,
    // Present ONLY once revealed (06-REVIEW CR-01): the trial loop pins the dealer's
    // hole to this exact card instead of resampling a hypothetical one from the pool.
    ...(revealedHole ? { knownDealerHole: round.dealerHole } : {}),
    remainingDeck: shoeWithout(deckCount, knownCards),
    deckCount,
  };
}

/**
 * The pool a REAL draw (a live Hit, the real dealer playout on Stand) must come from.
 *
 * This is the ONLY function in the codebase permitted to read `round.dealerHole` for
 * LIVE-draw purposes (D-01, D-11, 06-RESEARCH Pattern 1). Every other module that needs
 * the physically-remaining shoe must call this function rather than slicing the raw
 * round itself. The predetermined hole card is ALWAYS excluded here — hidden or not — so
 * a live draw can never physically re-deal it (the second failure mode in the module
 * header). Structurally enforced: this function takes no `revealedHole` parameter at
 * all, making it impossible to condition the hole card's removal on visibility.
 *
 * `deckCount` is REQUIRED — same rationale as `deriveBlackjackConditionedState`.
 */
export function liveShoeLedger(
  round: PredeterminedBlackjackRound,
  playerCardsSoFar: readonly Card[],
  liveDrawnSoFar: readonly Card[],
  deckCount: DeckCount,
): Card[] {
  const known: Card[] = [
    ...playerCardsSoFar,
    round.dealerUpcard,
    round.dealerHole, // ALWAYS spent — a real, already-dealt card (D-01)
    ...liveDrawnSoFar,
  ];
  return shoeWithout(deckCount, known);
}

/**
 * Deal-time natural resolution (D-03, D-03a).
 *
 * This is the ONLY function in the codebase permitted to read `round.dealerHole` for
 * OUTCOME purposes, and only at deal time (06-RESEARCH resolution-order step 2) — it is
 * never a simulation input, and it only ever receives the player's initial 2-card hand
 * (the `isNatural` 2-card guard enforces the natural window regardless).
 *
 * EITHER side's natural resolves the round immediately — including the dealer-only case
 * (dealer natural, player none: immediate loss, D-03a). That is what guarantees the
 * player-turn phase is reachable only when neither side holds a natural — the premise
 * the trial loop's {-1, 0, +1} EV outcome set depends on.
 */
export function resolveNaturals(
  round: PredeterminedBlackjackRound,
  playerHand: readonly Card[],
): NaturalResolution {
  const playerNatural = isNatural(playerHand);
  const dealerNatural = isNatural([round.dealerUpcard, round.dealerHole]);

  if (!playerNatural && !dealerNatural) {
    return { resolved: false, outcome: null, playerNatural, dealerNatural };
  }

  const outcome: BlackjackOutcome =
    playerNatural && dealerNatural
      ? 'push'
      : playerNatural
        ? 'win'
        : // Dealer-only natural: immediate loss (D-03a) — the hole is revealed as part
          // of resolution by the store layer, not here.
          'lose';
  return { resolved: true, outcome, playerNatural, dealerNatural };
}
