import type { Card } from '@poker-apprentice/types';
import { evaluateHand } from '../engine/evaluator';
import { evaluateHandTwoDeck, type ExtendedStrength } from '../engine/evaluatorTwoDeck';
import type { DeckCount } from '../engine/shoe';

/** Fewer than 5 total cards (hole + board) means no 5-card hand can be evaluated yet — most
 * notably pre-flop, even holding a pocket pair, where only 2 cards exist. */
const MIN_EVALUABLE_CARDS = 5;

/**
 * Derives the hero's current made-hand category (as an `ExtendedStrength`) from VISIBLE
 * cards only, for the odds table's "locked in" indicator (Tier 1b).
 *
 * Structurally leak-proof (D-02): this function can only ever see the cards its caller
 * passes in. It never reads a runout, a deck, or anything hidden — the caller is required to
 * pass `deriveConditionedState`'s visible-only `heroHole`/`knownBoard` output, never a raw
 * `runout.board` slice. A hidden turn/river card can therefore never influence the mark.
 *
 * Deck-count routing (07-RESEARCH Pitfall 3): this is the ONLY production evaluator call
 * site outside the worker trial loop, and it runs on the MAIN THREAD over the cards the
 * user can currently see. At two decks those cards can legitimately contain a duplicate —
 * a hero pocket pair of identical cards, or a board card duplicating a hero card — which is
 * exactly the input that makes the stock evaluator return a malformed result or throw, and
 * here there is no worker to contain it. At `deckCount === 2` the evaluation therefore
 * routes through `evaluateHandTwoDeck` (the duplicate-aware wrapper); the wrapper's
 * extended return of 10 is what makes the odds table's locked-in tick work on the appended
 * index-10 row with no further change. The `deckCount` default of 1 is deliberate — every
 * shipped caller and the existing 1-deck test suite stay untouched (the `conditioning.ts`
 * default-parameter convention). This file stays free of any direct library import in both
 * branches: it reaches the evaluator only through the two engine wrappers.
 *
 * Returns `null` when there are not yet enough known cards to evaluate a hand (pre-flop), or
 * when there is no hero hole (no hand dealt).
 */
export function lockedInCategory(
  heroHole: readonly [Card, Card] | null,
  knownBoard: readonly Card[],
  deckCount: DeckCount = 1,
): ExtendedStrength | null {
  if (heroHole === null) return null;
  if (heroHole.length + knownBoard.length < MIN_EVALUABLE_CARDS) return null;
  return deckCount === 2
    ? evaluateHandTwoDeck([heroHole[0], heroHole[1]], [...knownBoard]).strength
    : evaluateHand([heroHole[0], heroHole[1]], [...knownBoard]).strength;
}
