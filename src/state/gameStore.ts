import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { FULL_DECK } from '../engine/cards';
import { createRng, drawN } from '../engine/rng';

interface GameState {
  /** The hero's two hole cards, or `null` before the first deal. */
  heroHole: [Card, Card] | null;
  /**
   * Increments on every `deal()`. Doubles as the simulation `requestId` in later plans —
   * deliberately a single counter, not two.
   */
  dealNonce: number;
  /** Draws a fresh random hero hand and increments `dealNonce`. */
  deal: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  heroHole: null,
  dealNonce: 0,
  deal: () => {
    const rng = createRng();
    const [c1, c2] = drawN(rng, FULL_DECK, 2);
    set({ heroHole: [c1, c2], dealNonce: get().dealNonce + 1 });
  },
}));
