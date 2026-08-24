import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableScene } from './TableScene';
import { useGameStore } from '../state/gameStore';
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

describe('TableScene', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders a table-scene root carrying the felt class', () => {
    render(<TableScene />);
    expect(screen.getByTestId('table-scene')).toHaveClass('felt');
  });

  it('opponents always has exactly 3 children and hero-hole always has exactly 2, before a deal', () => {
    render(<TableScene />);
    expect(screen.getByTestId('opponents').children).toHaveLength(3);
    expect(screen.getByTestId('hero-hole').children).toHaveLength(2);
  });

  it('opponents still has exactly 3 children and hero-hole still has exactly 2, after a deal', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT });
    render(<TableScene />);
    expect(screen.getByTestId('opponents').children).toHaveLength(3);
    expect(screen.getByTestId('hero-hole').children).toHaveLength(2);
  });

  it('deck-origin is aria-hidden, carries no visible text, and contains only card backs', () => {
    render(<TableScene />);
    const deckOrigin = screen.getByTestId('deck-origin');
    expect(deckOrigin).toHaveAttribute('aria-hidden', 'true');
    expect(deckOrigin.textContent).toBe('');
    const images = deckOrigin.querySelectorAll('img');
    expect(images).toHaveLength(3);
    for (const img of Array.from(images)) {
      expect(img.getAttribute('src')).toBe('/cards/back.svg');
    }
  });

  it('a revealed opponent carries the exact revealed aria-label and is disabled', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT, revealedMask: 0b1 });
    render(<TableScene />);
    const seat = screen.getByTestId('opponent-seat-0');
    expect(seat).toBeDisabled();
    expect(seat).toHaveAttribute('aria-label', 'Opponent 1 hole cards: 7c 8c (revealed)');
  });

  it('seat-label-opponent-0 is aria-hidden while seat-label-hero is not', () => {
    render(<TableScene />);
    expect(screen.getByTestId('seat-label-opponent-0')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('seat-label-hero')).not.toHaveAttribute('aria-hidden');
  });

  it('at the flop, board-cards has 3 children and the community area holds 2 dashed placeholders', () => {
    useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'flop' });
    const { container } = render(<TableScene />);
    expect(screen.getByTestId('board-cards').children).toHaveLength(3);
    const placeholders = container.querySelectorAll('.community-area > .card-placeholder');
    expect(placeholders).toHaveLength(2);
  });

  it('before any deal, the community area holds 5 dashed placeholders alongside board-empty-state', () => {
    const { container } = render(<TableScene />);
    expect(screen.getByTestId('board-empty-state')).toBeInTheDocument();
    const placeholders = container.querySelectorAll('.community-area > .card-placeholder');
    expect(placeholders).toHaveLength(5);
  });
});
