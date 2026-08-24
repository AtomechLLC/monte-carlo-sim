import { ALL_CARDS } from '@poker-apprentice/types';
import type { Card } from '@poker-apprentice/types';

/** The full 52-card deck, in the exact `Card` union format the evaluator expects. */
export const FULL_DECK: readonly Card[] = ALL_CARDS;

/** Fixed number of anonymous opponents at the table. */
export const OPPONENT_COUNT = 3;

/** Unknown cards drawn per Monte Carlo trial: 5 board + 2 per opponent x 3 opponents. */
export const CARDS_PER_TRIAL = 11;

/** Returns `FULL_DECK` with every card in `excluded` removed. */
export function deckWithout(excluded: readonly Card[]): Card[] {
  const excludedSet = new Set(excluded);
  return FULL_DECK.filter((card) => !excludedSet.has(card));
}
