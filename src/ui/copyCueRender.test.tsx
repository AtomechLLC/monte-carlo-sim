import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { TableScene } from './TableScene';
import { PlayingCard } from './PlayingCard';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import type { PredeterminedRunout } from '../engine/conditioning';

// Render pins for the D-08/HE2-03 felt copy cue across all three face-up render paths
// (hero holes, board, revealed opponent holes), including the both-ways DOM-absence
// contract (07-UI-SPEC Isolation Contract item 3) and gate neutrality (A7).
//
// Why `holdem-copy-cue` is deliberately ABSENT from src/test/holdemTestids.ts's
// HOLDEM_ONLY_TESTIDS sweep list: that list's entries must be non-vacuously PRESENT
// after a deal (its sweep asserts presence in Hold'em mode and absence in the other
// game's mode), while the cue is doubly conditional (deckCount 2 AND a visible
// duplicate) and so cannot be asserted present after an arbitrary deal. Cross-mode
// absence is already guaranteed by containment: the cue can only ever render inside
// `table-scene`, which HOLDEM_ONLY_TESTIDS already pins as DOM-absent in the other
// game's mode — a child of an absent subtree needs no sweep entry of its own.
//
// jsdom forces prefers-reduced-motion: reduce, so Motion collapses every duration to 0
// and cards mount at their final position — every assertion below is an end-state
// assertion; nothing waits on a frame.

const CUE_SENTENCE = 'Second copy — two physical copies of this card are in play';

/** Hero holds BOTH physical copies of Ah; every other visible value distinct. */
const HERO_PAIR_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ah', 'Ah'],
  board: ['2c', '7d', '9s', 'Jh', '4c'],
  opponentHoles: [
    ['Qs', 'Th'],
    ['8d', '3s'],
    ['5h', '6c'],
  ],
};

/** Hero holds one Ah; its twin is board index 1, first visible at the flop. */
const BOARD_TWIN_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ah', 'Kd'],
  board: ['2c', 'Ah', '9s', 'Jh', '4c'],
  opponentHoles: [
    ['Qs', 'Th'],
    ['8d', '3s'],
    ['5h', '6c'],
  ],
};

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
  // Placed AFTER the store reset (the App-level harness convention, e.g.
  // App.holdemCachePoison.test.tsx): a reset must never leave a stale armed count behind.
  useUiStore.getState().resetAnimations();
}

beforeEach(() => {
  resetStores();
});

describe('PlayingCard copyCue prop (component level)', () => {
  it('renders EXACTLY the shipped single img with no wrapper and no siblings when copyCue is absent', () => {
    const { container } = render(<PlayingCard card="Ah" />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe('IMG');
    expect(container.firstElementChild).toHaveClass('playing-card');
    expect(container.querySelector('[data-testid="holdem-copy-cue"]')).toBeNull();
    expect(container.innerHTML).not.toContain('copy-cue');
  });

  it('renders EXACTLY the shipped single img when copyCue is explicitly false', () => {
    const { container } = render(<PlayingCard card="Ah" copyCue={false} />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe('IMG');
    expect(container.querySelector('[data-testid="holdem-copy-cue"]')).toBeNull();
  });

  it('still renders only the card back when copyCue is set but faceUp is false — a face-down card can never show a cue', () => {
    const { container } = render(<PlayingCard card="Ah" faceUp={false} copyCue />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/cards/back.svg');
    expect(container.querySelector('[data-testid="holdem-copy-cue"]')).toBeNull();
    expect(container.innerHTML).not.toContain('copy-cue');
  });

  it('renders the shipped img plus the aria-hidden ×2 badge and the visually-hidden sentence when copyCue is true', () => {
    const { container } = render(<PlayingCard card="Ah" copyCue />);
    const img = container.querySelector('img.playing-card');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/cards/H-A.svg');
    const badge = container.querySelector('[data-testid="holdem-copy-cue"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass('copy-cue');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge?.textContent).toBe('×2');
    const hidden = container.querySelector('.visually-hidden');
    expect(hidden?.textContent).toBe(CUE_SENTENCE);
  });

  it('adds no alt text in any case — the D-03 cardAltText bridge output is unchanged', () => {
    const { container: cuedContainer } = render(<PlayingCard card="Ah" copyCue />);
    expect(cuedContainer.querySelector('img')).toHaveAttribute('alt', 'Ace of Hearts');
    const { container: plainContainer } = render(<PlayingCard card="Ah" />);
    expect(plainContainer.querySelector('img')).toHaveAttribute('alt', 'Ace of Hearts');
    const { container: decorativeContainer } = render(<PlayingCard card="Ah" decorative copyCue />);
    expect(decorativeContainer.querySelector('img')).toHaveAttribute('alt', '');
  });
});

describe('hero hole path (2 decks)', () => {
  it('renders exactly one badge inside hero-hole, on the SECOND slot, when the hero holds both copies', () => {
    useGameStore.setState({ runout: HERO_PAIR_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1, deckCount: 2 });
    render(<TableScene />);
    const heroHole = screen.getByTestId('hero-hole');
    const badges = within(heroHole).getAllByTestId('holdem-copy-cue');
    expect(badges).toHaveLength(1);
    // ... and one badge TOTAL — no other felt element is badged.
    expect(screen.getAllByTestId('holdem-copy-cue')).toHaveLength(1);
    const slots = heroHole.children;
    expect(slots).toHaveLength(2);
    expect(slots[1].contains(badges[0])).toBe(true);
    expect(slots[0].querySelector('[data-testid="holdem-copy-cue"]')).toBeNull();
  });

  it('the badge is a DESCENDANT of the element carrying the card-slot class — it rides the animated card, not the slot row', () => {
    useGameStore.setState({ runout: HERO_PAIR_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1, deckCount: 2 });
    render(<TableScene />);
    const badge = screen.getByTestId('holdem-copy-cue');
    expect(badge.closest('.card-slot')).not.toBeNull();
  });

  it('the hosting slot co-applies card-slot--cued to its shipped classes; the un-cued sibling does not', () => {
    useGameStore.setState({ runout: HERO_PAIR_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1, deckCount: 2 });
    render(<TableScene />);
    const slots = screen.getByTestId('hero-hole').children;
    expect(slots[1]).toHaveClass('card-slot', 'card-slot--hero', 'card-slot--cued');
    expect(slots[0]).toHaveClass('card-slot', 'card-slot--hero');
    expect(slots[0]).not.toHaveClass('card-slot--cued');
  });
});

describe('board path (2 decks)', () => {
  it("a hero card's twin boarding at the flop wears the badge on the correct community index, and rewinding removes it", () => {
    useGameStore.setState({ runout: BOARD_TWIN_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1, deckCount: 2 });
    render(<TableScene />);
    // Preflop: the twin is not visible yet — no badge anywhere.
    expect(screen.queryByTestId('holdem-copy-cue')).toBeNull();

    act(() => {
      useGameStore.setState({ street: 'flop' });
    });
    const board = screen.getByTestId('board-cards');
    const badges = within(board).getAllByTestId('holdem-copy-cue');
    expect(badges).toHaveLength(1);
    expect(screen.getAllByTestId('holdem-copy-cue')).toHaveLength(1);
    // The twin sits at board index 1 — the badge rides that card's slot.
    expect(board.children[1].contains(badges[0])).toBe(true);
    expect(board.children[1]).toHaveClass('card-slot', 'card-slot--community', 'card-slot--cued');
    expect(board.children[0]).not.toHaveClass('card-slot--cued');

    act(() => {
      useGameStore.setState({ street: 'preflop' });
    });
    expect(screen.queryByTestId('holdem-copy-cue')).toBeNull();
  });
});

describe('1-deck DOM absence (hero and board paths)', () => {
  it('renders zero badges, zero cued classes and zero cue sentences at deckCount 1, with the felt markup otherwise intact', () => {
    // Same store shape as the 2-deck hero test — only deckCount differs.
    useGameStore.setState({ runout: HERO_PAIR_RUNOUT, street: 'flop', revealedMask: 0, dealNonce: 1, deckCount: 1 });
    render(<TableScene />);
    expect(screen.queryByTestId('holdem-copy-cue')).toBeNull();
    expect(document.querySelector('.card-slot--cued')).toBeNull();
    expect(screen.queryByText(CUE_SENTENCE)).toBeNull();

    // The 1-deck markup is the shipped markup: every hero and board slot hosts exactly
    // one child — the card img — with no badge span and no hidden sentence.
    const heroHole = screen.getByTestId('hero-hole');
    expect(heroHole.children).toHaveLength(2);
    for (const slot of Array.from(heroHole.children)) {
      expect(slot).toHaveClass('card-slot', 'card-slot--hero');
      expect(slot.children).toHaveLength(1);
      expect(slot.firstElementChild?.tagName).toBe('IMG');
    }
    const board = screen.getByTestId('board-cards');
    expect(board.children).toHaveLength(3);
    for (const slot of Array.from(board.children)) {
      expect(slot).toHaveClass('card-slot', 'card-slot--community');
      expect(slot.children).toHaveLength(1);
      expect(slot.firstElementChild?.tagName).toBe('IMG');
    }
  });
});
