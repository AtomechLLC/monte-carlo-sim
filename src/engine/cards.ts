import { ALL_CARDS } from '@poker-apprentice/types';
import type { Card } from '@poker-apprentice/types';

/** The full 52-card deck, in the exact `Card` union format the evaluator expects. */
export const FULL_DECK: readonly Card[] = ALL_CARDS;

/** Fixed number of anonymous opponents at the table. */
export const OPPONENT_COUNT = 3;

/** Number of community board cards in a complete Hold'em board. */
export const BOARD_SIZE = 5;

/** Number of hole cards dealt to each player (hero or opponent). */
export const HOLE_CARDS_PER_PLAYER = 2;

/** Total cards in a fully-dealt hand: hero + all opponents' hole cards, plus the full board. */
export const CARDS_PER_DEAL = HOLE_CARDS_PER_PLAYER * (1 + OPPONENT_COUNT) + BOARD_SIZE;

/** Returns `FULL_DECK` with every card in `excluded` removed. */
export function deckWithout(excluded: readonly Card[]): Card[] {
  const excludedSet = new Set(excluded);
  return FULL_DECK.filter((card) => !excludedSet.has(card));
}
