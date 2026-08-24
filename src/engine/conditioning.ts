import type { Card } from '@poker-apprentice/types';
import type { Street } from './streets';
import { STREET_BOARD_COUNT } from './streets';
import { shoeWithout, type DeckCount } from './shoe';

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
 * `remainingDeck` is derived by count-aware subtraction over a `deckCount`-sized shoe (D-04):
 * at 2 decks a value the hero (or any known card) holds legitimately remains in the unknown
 * pool once, since only one physical copy — not both — has been removed.
 */
export function deriveConditionedState(
  runout: PredeterminedRunout,
  street: Street,
  revealedMask: number,
  deckCount: DeckCount = 1,
) {
  const knownBoard: Card[] = runout.board.slice(0, STREET_BOARD_COUNT[street]);
  const knownOpponentHoles: (readonly [Card, Card] | null)[] = runout.opponentHoles.map((hole, index) =>
    isOpponentRevealed(revealedMask, index) ? hole : null,
  );

  const knownCards: Card[] = [runout.heroHole[0], runout.heroHole[1], ...knownBoard];
  for (const hole of knownOpponentHoles) {
    if (hole !== null) {
      knownCards.push(hole[0], hole[1]);
    }
  }
  const remainingDeck = shoeWithout(deckCount, knownCards);

  return {
    heroHole: runout.heroHole,
    knownBoard,
    knownOpponentHoles,
    remainingDeck,
    deckCount,
  };
}
