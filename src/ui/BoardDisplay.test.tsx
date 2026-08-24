import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardDisplay, communityDealIndex } from './BoardDisplay';
import { useGameStore } from '../state/gameStore';
import { STREET_BOARD_COUNT } from '../engine/streets';
import { dealOriginOffset } from './tableGeometry';
import type { PredeterminedRunout } from '../engine/conditioning';

const FABRICATED_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ah', 'Kh'],
  board: ['2c', '3c', '4c', '5c', '6c'],
  opponentHoles: [
    ['7c', '8c'],
    ['9c', 'Tc'],
    ['Jc', 'Qc'],
  ],
};

function resetStore() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
}

describe('BoardDisplay — street-advance enter (only newly visible cards animate)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('board-cards holds 3 children at the flop, 4 at the turn, 5 at the river', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'flop' });
    const { rerender } = render(<BoardDisplay />);
    expect(screen.getByTestId('board-cards').children).toHaveLength(3);

    useGameStore.setState({ street: 'turn' });
    rerender(<BoardDisplay />);
    expect(screen.getByTestId('board-cards').children).toHaveLength(4);

    useGameStore.setState({ street: 'river' });
    rerender(<BoardDisplay />);
    expect(screen.getByTestId('board-cards').children).toHaveLength(5);
  });

  it('reuses the same DOM node for board index 0 across a flop-to-turn advance (already-visible cards are not remounted)', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'flop' });
    const { rerender } = render(<BoardDisplay />);
    const flopFirstCard = screen.getByTestId('board-cards').children[0];

    useGameStore.setState({ street: 'turn' });
    rerender(<BoardDisplay />);
    const turnFirstCard = screen.getByTestId('board-cards').children[0];

    expect(turnFirstCard).toBe(flopFirstCard);
  });

  it('a re-deal (new dealNonce) mounts a different DOM node at board index 0', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'flop', dealNonce: 1 });
    const { rerender } = render(<BoardDisplay />);
    const firstDealFirstCard = screen.getByTestId('board-cards').children[0];

    useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'flop', dealNonce: 2 });
    rerender(<BoardDisplay />);
    const secondDealFirstCard = screen.getByTestId('board-cards').children[0];

    expect(secondDealFirstCard).not.toBe(firstDealFirstCard);
  });

  it('each community card enters from its own slot-specific deck-origin offset, not a shared offset', () => {
    // dealOriginOffset('community-0') and dealOriginOffset('community-4') are different points
    // on the felt (see tableGeometry.ts POSITIONS) — this is the contract BoardDisplay relies on
    // when it calls dealOriginOffset per-index rather than passing one shared offset to every
    // community AnimatedCard.
    const offset0 = dealOriginOffset('community-0');
    const offset4 = dealOriginOffset('community-4');
    expect(offset0).not.toEqual(offset4);
  });

  it('the stagger index (dealIndex) computation: at the turn, the newly visible card gets 0', () => {
    // Turn's newly visible card is board index 3; 3 cards were already visible at the flop.
    expect(communityDealIndex(3, STREET_BOARD_COUNT.flop)).toBe(0);
  });

  it('the stagger index computation: at the flop, the three simultaneous new cards get 0, 1, 2', () => {
    expect(communityDealIndex(0, STREET_BOARD_COUNT.preflop)).toBe(0);
    expect(communityDealIndex(1, STREET_BOARD_COUNT.preflop)).toBe(1);
    expect(communityDealIndex(2, STREET_BOARD_COUNT.preflop)).toBe(2);
  });

  it('the stagger index computation: at the river, the newly visible card gets 0', () => {
    expect(communityDealIndex(4, STREET_BOARD_COUNT.turn)).toBe(0);
  });
});
