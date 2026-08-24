import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { FULL_DECK, CARDS_PER_DEAL } from '../engine/cards';
import { createRng, drawN } from '../engine/rng';
import type { PredeterminedRunout } from '../engine/conditioning';
import type { Street } from '../engine/streets';
import { nextStreet, previousStreet } from '../engine/streets';

interface GameState {
  /** The full predetermined runout for the current hand, or `null` before the first deal (D-01). */
  runout: PredeterminedRunout | null;
  /** The street currently visible to the user. Navigation moves this pointer; it never redraws cards. */
  street: Street;
  /** Bitmask of revealed opponents (bit `i` set = opponent `i` revealed). Always `0` until plan 02-03 adds `reveal()`. */
  revealedMask: number;
  /**
   * Increments on every `deal()`. Doubles as the simulation `requestId` in later plans —
   * deliberately a single counter, not two.
   */
  dealNonce: number;
  /** Draws a fresh predetermined runout (hero + board + 3 opponents) and resets navigation state. */
  deal: () => void;
  /** Moves the visible street forward one step; no-op at `'river'`. Never redraws cards. */
  advanceStreet: () => void;
  /** Moves the visible street backward one step; no-op at `'preflop'`. Never redraws cards. */
  rewindStreet: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  runout: null,
  street: 'preflop',
  revealedMask: 0,
  dealNonce: 0,
  deal: () => {
    // Single up-front draw over one pool (RESEARCH Pitfall 5) — never several independent
    // draws, which would risk overlapping cards across hero/board/opponents.
    const rng = createRng();
    const cards: Card[] = drawN(rng, FULL_DECK, CARDS_PER_DEAL);

    const runout: PredeterminedRunout = {
      heroHole: [cards[0], cards[1]],
      board: [cards[2], cards[3], cards[4], cards[5], cards[6]],
      opponentHoles: [
        [cards[7], cards[8]],
        [cards[9], cards[10]],
        [cards[11], cards[12]],
      ],
    };

    set({ runout, street: 'preflop', revealedMask: 0, dealNonce: get().dealNonce + 1 });
  },
  advanceStreet: () => {
    set({ street: nextStreet(get().street) });
  },
  rewindStreet: () => {
    set({ street: previousStreet(get().street) });
  },
}));
