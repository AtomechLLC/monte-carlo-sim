import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getRank, getSuit } from '@poker-apprentice/types';
import { HandCategoryIcon } from './HandCategoryIcon';
import { HAND_CATEGORY_EXAMPLES } from './handCategoryExamples';
import { CATEGORY_LABELS, CATEGORY_LABELS_TWO_DECK } from './categoryLabels';
import { FIVE_OF_A_KIND_INDEX } from '../worker/protocol';

function iconText(categoryIndex: number): string {
  const { container } = render(<HandCategoryIcon categoryIndex={categoryIndex} />);
  return container.querySelector('svg')?.textContent ?? '';
}

function ranksAndSuits(categoryIndex: number) {
  const example = HAND_CATEGORY_EXAMPLES[categoryIndex];
  return {
    ranks: example.map((e) => getRank(e.card)),
    suits: example.map((e) => getSuit(e.card)),
  };
}

describe('HandCategoryIcon — one example hand per category', () => {
  it('covers every 2-deck category label, in order, with exactly five cards each', () => {
    expect(HAND_CATEGORY_EXAMPLES).toHaveLength(CATEGORY_LABELS_TWO_DECK.length);
    for (const example of HAND_CATEGORY_EXAMPLES) {
      expect(example).toHaveLength(5);
    }
  });

  it('renders five card faces for every category', () => {
    for (let i = 0; i < CATEGORY_LABELS_TWO_DECK.length; i += 1) {
      const { container } = render(<HandCategoryIcon categoryIndex={i} />);
      expect(container.querySelectorAll('rect.hand-icon__stock')).toHaveLength(5);
    }
  });

  it('renders nothing for an index with no illustration', () => {
    const { container } = render(<HandCategoryIcon categoryIndex={99} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('is decorative: the SVG is aria-hidden so the row label is the only accessible name', () => {
    const { container } = render(<HandCategoryIcon categoryIndex={0} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });
});

describe('HandCategoryIcon — the illustrations state the rule they illustrate', () => {
  it('draws Royal Flush as 10 J Q K A of a single suit', () => {
    const royal = CATEGORY_LABELS.indexOf('Royal Flush');
    const { ranks, suits } = ranksAndSuits(royal);
    expect(ranks).toEqual(['T', 'J', 'Q', 'K', 'A']);
    expect(new Set(suits).size).toBe(1);
    // "T" must reach the screen as "10" — the vendored deck's spelling, and what a reader expects.
    expect(iconText(royal)).toContain('10');
    expect(iconText(royal)).not.toContain('T');
  });

  it('draws Straight mixed-suit and Straight Flush single-suit over the SAME run', () => {
    const straight = CATEGORY_LABELS.indexOf('Straight');
    const straightFlush = CATEGORY_LABELS.indexOf('Straight Flush');
    const plain = ranksAndSuits(straight);
    const flushed = ranksAndSuits(straightFlush);

    expect(plain.ranks).toEqual(flushed.ranks); // same five ranks...
    expect(new Set(plain.suits).size).toBeGreaterThan(1); // ...differing only in suit
    expect(new Set(flushed.suits).size).toBe(1);
  });

  it('draws Flush as one suit that is deliberately NOT a run', () => {
    const flush = CATEGORY_LABELS.indexOf('Flush');
    const { ranks, suits } = ranksAndSuits(flush);
    expect(new Set(suits).size).toBe(1);
    const order = '23456789TJQKA';
    const positions = ranks.map((r) => order.indexOf(r)).sort((a, b) => a - b);
    const isRun = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
    expect(isRun).toBe(false);
  });

  it('splits the two double-group categories into a played group and a second group', () => {
    for (const label of ['Two Pair', 'Full House'] as const) {
      const example = HAND_CATEGORY_EXAMPLES[CATEGORY_LABELS.indexOf(label)];
      expect(example.filter((e) => e.role === 'second').length).toBe(2);
      expect(example.filter((e) => e.role === 'plays').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('marks the cards that do not play as kickers', () => {
    const onePair = HAND_CATEGORY_EXAMPLES[CATEGORY_LABELS.indexOf('One Pair')];
    expect(onePair.filter((e) => e.role === 'plays')).toHaveLength(2);
    expect(onePair.filter((e) => e.role === 'kicker')).toHaveLength(3);

    const quads = HAND_CATEGORY_EXAMPLES[CATEGORY_LABELS.indexOf('Four of a Kind')];
    expect(quads.filter((e) => e.role === 'plays')).toHaveLength(4);
    expect(quads.filter((e) => e.role === 'kicker')).toHaveLength(1);
  });

  it('shows Five of a Kind with a REPEATED physical card — the hand only exists at two decks', () => {
    const example = HAND_CATEGORY_EXAMPLES[FIVE_OF_A_KIND_INDEX];
    expect(example.map((e) => getRank(e.card))).toEqual(['A', 'A', 'A', 'A', 'A']);
    // Five aces need six suits unless one card appears twice, which is exactly the point.
    expect(new Set(example.map((e) => e.card)).size).toBeLessThan(5);
  });
});
