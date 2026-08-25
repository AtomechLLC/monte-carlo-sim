// @vitest-environment node
// Additive sibling of lockedCategory.test.ts (07-PATTERNS section 2 row 10): that file's
// "always returns a valid CATEGORY_LABELS index (0-9)" test is a correct 1-deck statement
// and must not be rewritten — every deckCount-2 / extended-index assertion lives here
// instead. Per D-16, every duplicate-shape case below asserts an exact VALUE, never mere
// non-throwing: the stock evaluator's dominant duplicate failure mode is silent garbage,
// not a crash, so a does-not-throw test would prove nothing.
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '../engine/evaluator';
import { lockedInCategory } from './lockedCategory';
import { CATEGORY_LABELS, CATEGORY_LABELS_TWO_DECK } from './categoryLabels';
import { categoryCountFor, FIVE_OF_A_KIND_INDEX } from '../worker/protocol';

describe('CATEGORY_LABELS_TWO_DECK — the derived 11-row label source (D-05, D-09)', () => {
  it('CATEGORY_LABELS itself still has exactly 10 entries with Royal Flush last', () => {
    // A future widening must fail HERE, loudly, rather than inside the frozen v1 suite
    // that compares the rendered 1-deck rows against the whole constant (07-PATTERNS trap 4).
    expect(CATEGORY_LABELS).toHaveLength(10);
    expect(CATEGORY_LABELS[CATEGORY_LABELS.length - 1]).toBe('Royal Flush');
  });

  it('has exactly 11 entries: the shipped ten in order, then Five of a Kind last', () => {
    expect(CATEGORY_LABELS_TWO_DECK).toHaveLength(11);
    expect(CATEGORY_LABELS_TWO_DECK.slice(0, 10)).toEqual([...CATEGORY_LABELS]);
    expect(CATEGORY_LABELS_TWO_DECK[CATEGORY_LABELS_TWO_DECK.length - 1]).toBe('Five of a Kind');
    // The appended label sits at exactly the index the wrapper's extended return targets,
    // which is what makes the locked-in tick work on the new row for free (D-05).
    expect(CATEGORY_LABELS_TWO_DECK[FIVE_OF_A_KIND_INDEX]).toBe('Five of a Kind');
  });

  it('label-source lengths equal categoryCountFor at each deck count — labels and histogram can never drift', () => {
    expect(CATEGORY_LABELS.length).toBe(categoryCountFor(1));
    expect(CATEGORY_LABELS_TWO_DECK.length).toBe(categoryCountFor(2));
  });
});

describe('lockedInCategory — deckCount routing (07-RESEARCH Pitfall 3)', () => {
  it('returns exactly what it returns today when called with no deckCount or with 1', () => {
    const akHole: [Card, Card] = ['Ac', 'Kd'];
    const aaHole: [Card, Card] = ['Ac', 'Ad'];
    const flop: Card[] = ['Ah', '7c', '2d'];
    // The shipped suite's fixtures, re-asserted through both 1-deck call shapes.
    expect(lockedInCategory(akHole, flop)).toBe(HandStrength.OnePair);
    expect(lockedInCategory(akHole, flop, 1)).toBe(HandStrength.OnePair);
    expect(lockedInCategory(aaHole, flop)).toBe(HandStrength.ThreeOfAKind);
    expect(lockedInCategory(aaHole, flop, 1)).toBe(HandStrength.ThreeOfAKind);
  });

  it('still returns null with fewer than five known cards (preflop) at both deck counts', () => {
    const pocketPair: [Card, Card] = ['Ac', 'Ad'];
    expect(lockedInCategory(pocketPair, [])).toBeNull();
    expect(lockedInCategory(pocketPair, [], 1)).toBeNull();
    expect(lockedInCategory(pocketPair, [], 2)).toBeNull();
    // Even a duplicate pocket pair preflop: the MIN_EVALUABLE_CARDS guard fires before
    // any evaluator is consulted.
    const duplicatePair: [Card, Card] = ['Ah', 'Ah'];
    expect(lockedInCategory(duplicatePair, [], 2)).toBeNull();
  });

  it('still returns null when heroHole is null at both deck counts', () => {
    const fullBoard: Card[] = ['Ah', '7c', '2d', '3s', '4h'];
    expect(lockedInCategory(null, fullBoard)).toBeNull();
    expect(lockedInCategory(null, fullBoard, 1)).toBeNull();
    expect(lockedInCategory(null, fullBoard, 2)).toBeNull();
  });

  it('returns One Pair for a hero holding two identical copies at deckCount 2 (five-card flop window)', () => {
    // The exact shape 07-RESEARCH Pitfall 3 warns about: a legitimate 2-deck pocket pair of
    // IDENTICAL cards reaching the main-thread call site. Exact value per D-16.
    const heroHole: [Card, Card] = ['Ah', 'Ah'];
    const knownBoard: Card[] = ['7c', '2d', '9s'];
    expect(lockedInCategory(heroHole, knownBoard, 2)).toBe(HandStrength.OnePair);
  });

  it('returns One Pair when a board card duplicates a hero card at deckCount 2', () => {
    // The second duplicate shape: the twin of a hero card lands on the board.
    const heroHole: [Card, Card] = ['Ah', 'Kd'];
    const knownBoard: Card[] = ['Ah', '7c', '2d'];
    expect(lockedInCategory(heroHole, knownBoard, 2)).toBe(HandStrength.OnePair);
  });

  it('returns Three of a Kind on a six-card turn window containing a duplicate at deckCount 2', () => {
    const heroHole: [Card, Card] = ['Ah', 'Ah'];
    const knownBoard: Card[] = ['Ac', '7c', '2d', '9s'];
    expect(lockedInCategory(heroHole, knownBoard, 2)).toBe(HandStrength.ThreeOfAKind);
  });

  it('returns 10 for a five-of-a-kind visible on the river at deckCount 2', () => {
    const heroHole: [Card, Card] = ['Ah', 'Ah'];
    const knownBoard: Card[] = ['Ac', 'Ad', 'As', '7c', '2d'];
    const result = lockedInCategory(heroHole, knownBoard, 2);
    expect(result).toBe(10);
    // The extended return equals the appended row's index — the locked-in tick contract.
    expect(result).toBe(FIVE_OF_A_KIND_INDEX);
  });

  it('matches the 1-deck path exactly on duplicate-free visible cards at deckCount 2', () => {
    const akHole: [Card, Card] = ['Ac', 'Kd'];
    const pairFlop: Card[] = ['Ah', '7c', '2d'];
    expect(lockedInCategory(akHole, pairFlop, 2)).toBe(HandStrength.OnePair);
    expect(lockedInCategory(akHole, pairFlop, 2)).toBe(lockedInCategory(akHole, pairFlop, 1));

    const suitedHole: [Card, Card] = ['Ah', 'Kh'];
    const flushFlop: Card[] = ['Qh', 'Jh', '2h'];
    expect(lockedInCategory(suitedHole, flushFlop, 2)).toBe(HandStrength.Flush);
    expect(lockedInCategory(suitedHole, flushFlop, 2)).toBe(lockedInCategory(suitedHole, flushFlop, 1));
  });
});
