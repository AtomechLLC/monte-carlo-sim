import type { Card } from '@poker-apprentice/types';
import { evaluateHand, HandStrength } from '../engine/evaluator';

/** Fewer than 5 total cards (hole + board) means no 5-card hand can be evaluated yet — most
 * notably pre-flop, even holding a pocket pair, where only 2 cards exist. */
const MIN_EVALUABLE_CARDS = 5;

/**
 * Derives the hero's current made-hand category (as a `HandStrength`) from VISIBLE cards
 * only, for the odds table's "locked in" indicator (Tier 1b).
 *
 * Structurally leak-proof (D-02): this function can only ever see the cards its caller
 * passes in. It never reads a runout, a deck, or anything hidden — the caller is required to
 * pass `deriveConditionedState`'s visible-only `heroHole`/`knownBoard` output, never a raw
 * `runout.board` slice. A hidden turn/river card can therefore never influence the mark.
 *
 * Returns `null` when there are not yet enough known cards to evaluate a hand (pre-flop), or
 * when there is no hero hole (no hand dealt).
 */
export function lockedInCategory(
  heroHole: readonly [Card, Card] | null,
  knownBoard: readonly Card[],
): HandStrength | null {
  if (heroHole === null) return null;
  if (heroHole.length + knownBoard.length < MIN_EVALUABLE_CARDS) return null;
  return evaluateHand([heroHole[0], heroHole[1]], [...knownBoard]).strength;
}
