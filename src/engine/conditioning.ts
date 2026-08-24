import type { Card } from '@poker-apprentice/types';
import { FULL_DECK } from './cards';
import type { Street } from './streets';
import { STREET_BOARD_COUNT } from './streets';

/**
 * The full hand, predetermined at deal time (D-01): hero hole, all 5 board cards, and all
 * 3 opponents' hole cards. Not all of this is necessarily visible to the user yet — that
 * depends on the current street and which opponents have been revealed.
 */
export interface PredeterminedRunout {
  heroHole: [Card, Card];
  board: readonly [Card, Card, Card, Card, Card];
  opponentHoles: readonly [readonly [Card, Card], readonly [Card, Card], readonly [Card, Card]];
}

/** True when opponent `index` has been revealed under `revealedMask` (bit `index` set). */
export function isOpponentRevealed(revealedMask: number, index: number): boolean {
  return (revealedMask & (1 << index)) !== 0;
}

/**
 * Derives the simulation's known/unknown card partition from the user's CURRENT visibility
 * state (`street`, `revealedMask`) — never from the raw predetermined `runout` directly.
 *
 * This is the ONLY function in the codebase permitted to read `runout.board` or
 * `runout.opponentHoles` for simulation input (D-02, RESEARCH Pitfall 1). Every other module
 * that needs conditioned odds input must call this function rather than slicing the raw
 * runout itself — that is what keeps hidden board cards and hidden opponent holes out of the
 * odds computation. Hidden cards remain in `remainingDeck` (the unknown pool), never dropped.
 */
export function deriveConditionedState(runout: PredeterminedRunout, street: Street, revealedMask: number) {
  const knownBoard: Card[] = runout.board.slice(0, STREET_BOARD_COUNT[street]);
  const knownOpponentHoles: (readonly [Card, Card] | null)[] = runout.opponentHoles.map((hole, index) =>
    isOpponentRevealed(revealedMask, index) ? hole : null,
  );

  const knownCards = new Set<Card>([runout.heroHole[0], runout.heroHole[1], ...knownBoard]);
  for (const hole of knownOpponentHoles) {
    if (hole !== null) {
      knownCards.add(hole[0]);
      knownCards.add(hole[1]);
    }
  }
  const remainingDeck = FULL_DECK.filter((card) => !knownCards.has(card));

  return {
    heroHole: runout.heroHole,
    knownBoard,
    knownOpponentHoles,
    remainingDeck,
  };
}
