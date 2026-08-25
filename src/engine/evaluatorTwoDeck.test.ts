// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
import { evaluateHand } from './evaluator';
import {
  evaluateHandTwoDeck,
  compareHandsTwoDeck,
  findDuplicatesForTesting,
  setGenerationForTesting,
  FIVE_OF_A_KIND,
  type HandTwoDeck,
} from './evaluatorTwoDeck';

// D-16 discipline for this whole file: every duplicate vector asserts a VALUE (category
// and, where custom-scored, the tiebreak vector) — never mere non-throwing. 07-RESEARCH
// proved the stock evaluator's dominant duplicate failure mode is SILENT GARBAGE (five
// deuces scored High Card; malformed StraightFlush objects), so "did not crash" proves
// nothing.

// Every duplicate co-occurrence shape from 07-RESEARCH's impossibility table, as explicit
// vectors (the GATE_SHAPES table), each with its expected VALUE. Custom-scored shapes pin
// the tiebreak vector too; stock-shaped (proxy-path) results must carry NO tiebreak.
const GATE_SHAPES: {
  shape: string;
  hole: [Card, Card];
  community: Card[];
  strength: number;
  tiebreak?: number[];
}[] = [
  { shape: 'dup pair in hole', hole: ['Ah', 'Ah'], community: ['2c', '5d', '7h', '9s', 'Jc'], strength: HandStrength.OnePair },
  { shape: 'dup split hole/board', hole: ['Ah', '2c'], community: ['Ah', '5d', '7s', '9s', 'Jc'], strength: HandStrength.OnePair },
  { shape: 'dup inside board', hole: ['Ah', '2c'], community: ['Kd', 'Kd', '7s', '9s', 'Jc'], strength: HandStrength.OnePair },
  { shape: 'two distinct dup pairs', hole: ['Ah', 'Ah'], community: ['Kd', 'Kd', '7s', '9s', 'Jc'], strength: HandStrength.TwoPair },
  { shape: 'three dup pairs', hole: ['Ah', 'Ah'], community: ['Kd', 'Kd', 'Qs', 'Qs', 'Jc'], strength: HandStrength.TwoPair },
  { shape: 'rank count 5 (crash zone)', hole: ['As', 'Ah'], community: ['Ad', 'Ac', 'As', '7d', '9c'], strength: FIVE_OF_A_KIND, tiebreak: [12] },
  { shape: 'rank count 6', hole: ['As', 'As'], community: ['Ah', 'Ah', 'Ad', 'Ad', '9c'], strength: FIVE_OF_A_KIND, tiebreak: [12] },
  { shape: 'rank count 7', hole: ['As', 'As'], community: ['Ah', 'Ah', 'Ad', 'Ad', 'Ac'], strength: FIVE_OF_A_KIND, tiebreak: [12] },
  { shape: 'dup completing a flush', hole: ['Ah', 'Ah'], community: ['2h', '3h', '4h', '9c', '9d'], strength: HandStrength.Flush, tiebreak: [12, 12, 2, 1, 0] },
  { shape: 'dup irrelevant to best-5', hole: ['2c', '2c'], community: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'], strength: HandStrength.RoyalFlush },
];

describe('findDuplicatesForTesting — the value-equality duplicate gate (D-04)', () => {
  it.each(GATE_SHAPES)('(a) flags "$shape" and scores it to its exact value', ({ hole, community, strength, tiebreak }) => {
    expect(findDuplicatesForTesting([...hole, ...community])).toBe(true);

    const result = evaluateHandTwoDeck(hole, community);
    expect(result.strength).toBe(strength);
    if (tiebreak !== undefined) {
      expect(result.tiebreak).toEqual(tiebreak);
    } else {
      // Proxy-path results are stock-shaped: no tiebreak field ever.
      expect(result.tiebreak).toBeUndefined();
    }
  });

  it('(b) passes clean 5-, 6- and 7-card windows', () => {
    expect(findDuplicatesForTesting(['Ah', 'Kd', 'Qs', 'Jc', '9h'])).toBe(false);
    expect(findDuplicatesForTesting(['Ah', 'Kd', 'Qs', 'Jc', '9h', '7d'])).toBe(false);
    expect(findDuplicatesForTesting(['Ah', 'Kd', 'Qs', 'Jc', '9h', '7d', '2s'])).toBe(false);
  });

  it('(c) classifies correctly across the generation-counter wrap at 0x7fffffff', () => {
    // Leave stale stamps behind at a normal generation first.
    expect(findDuplicatesForTesting(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9c', '8d'])).toBe(false);

    setGenerationForTesting(2147483646);
    // Evaluation 1 runs at the max generation (0x7fffffff) and stamps at that value.
    expect(findDuplicatesForTesting(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9c', '8d'])).toBe(false);
    // Evaluation 2 forces the wrap: the counter restarts and every stale stamp from
    // before the wrap must be cleared — a stale stamp read as current would report a
    // phantom duplicate on these very same (clean) cards.
    expect(findDuplicatesForTesting(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9c', '8d'])).toBe(false);
    // And a real duplicate immediately after the wrap is still caught.
    expect(findDuplicatesForTesting(['Ah', 'Ah', 'Qh', 'Jh', 'Th', '9c', '8d'])).toBe(true);
  });
});

describe('evaluateHandTwoDeck — clean-window parity with the stock evaluator (D-04, D-11)', () => {
  const CLEAN_WINDOWS: { name: string; hole: [Card, Card]; community: Card[] }[] = [
    { name: 'the A-2-3-4-5 wheel straight', hole: ['As', '2h'], community: ['3d', '4c', '5s', 'Kd', 'Qh'] },
    { name: 'a royal flush', hole: ['As', 'Ks'], community: ['Qs', 'Js', 'Ts', '2d', '3h'] },
    { name: 'a straight flush', hole: ['9s', '8s'], community: ['7s', '6s', '5s', '2d', '3h'] },
    { name: 'a kicker comparison hand', hole: ['As', 'Kd'], community: ['Ad', '7c', '2s', '9h', '3d'] },
    { name: 'a play-the-board split', hole: ['2c', '3d'], community: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  ];

  it.each(CLEAN_WINDOWS)('(d) returns the stock result unchanged for $name', ({ hole, community }) => {
    const stock = evaluateHand(hole, community);
    const twoDeck = evaluateHandTwoDeck(hole, community);

    expect(twoDeck.strength).toBe(stock.strength);
    expect(twoDeck.hand).toEqual(stock.hand);
    expect(twoDeck.tiebreak).toBeUndefined();
  });
});

describe('evaluateHandTwoDeck — Five of a Kind (D-05, D-16)', () => {
  it('(e) scores five aces as strength 10 with tiebreak rank 12 — the stock evaluator throws on this exact input', () => {
    // "Does not throw" is never the assertion; the VALUE is (D-16).
    const result = evaluateHandTwoDeck(['As', 'Ah'], ['Ad', 'Ac', 'As', '7d', '9c']);
    expect(result.strength).toBe(FIVE_OF_A_KIND);
    expect(result.tiebreak?.[0]).toBe(12);
    expect(result.hand).toHaveLength(5);
  });

  it('(f) scores five deuces as strength 10 — the stock evaluator silently returns High Card for this exact input (D-16)', () => {
    const result = evaluateHandTwoDeck(['2s', '2s'], ['2h', '2h', '2d', '9d', '7c']);
    expect(result.strength).toBe(FIVE_OF_A_KIND);
    expect(result.tiebreak?.[0]).toBe(0);
  });

  it('(g) scores rank counts 6 and 7 as strength 10', () => {
    expect(evaluateHandTwoDeck(['As', 'As'], ['Ah', 'Ah', 'Ad', 'Ad', '9c']).strength).toBe(FIVE_OF_A_KIND);
    expect(evaluateHandTwoDeck(['As', 'As'], ['Ah', 'Ah', 'Ad', 'Ad', 'Ac']).strength).toBe(FIVE_OF_A_KIND);
  });
});

describe('compareHandsTwoDeck — ordering and sign convention (D-05)', () => {
  const fiveAces = (): HandTwoDeck => evaluateHandTwoDeck(['As', 'Ah'], ['Ad', 'Ac', 'As', '7d', '9c']);
  const fiveDeuces = (): HandTwoDeck => evaluateHandTwoDeck(['2s', '2s'], ['2h', '2h', '2d', '9d', '7c']);
  const royal = (): HandTwoDeck => evaluateHandTwoDeck(['As', 'Ks'], ['Qs', 'Js', 'Ts', '2d', '3h']);

  it('(h) ranks Five of a Kind above Royal Flush, both directions', () => {
    expect(compareHandsTwoDeck(fiveAces(), royal())).toBe(1);
    expect(compareHandsTwoDeck(royal(), fiveAces())).toBe(-1);
  });

  it('(i) ranks five aces above five deuces, both directions', () => {
    expect(compareHandsTwoDeck(fiveAces(), fiveDeuces())).toBe(1);
    expect(compareHandsTwoDeck(fiveDeuces(), fiveAces())).toBe(-1);
  });

  it('(j) ties two same-rank Five of a Kinds at exactly 0, never -0', () => {
    const a = fiveAces();
    // A DIFFERENT five-aces window composition must tie too (no kicker slot exists).
    const b = evaluateHandTwoDeck(['Ah', 'Ad'], ['Ac', 'As', 'As', 'Kd', 'Qc']);
    expect(b.strength).toBe(FIVE_OF_A_KIND);
    expect(Object.is(compareHandsTwoDeck(a, a), 0)).toBe(true);
    expect(Object.is(compareHandsTwoDeck(a, b), 0)).toBe(true);
  });

  it('(k) keeps the +1/0/-1 convention across stock-vs-stock, custom-vs-custom and mixed pairs', () => {
    // Stock-vs-stock (both clean, evaluated through the wrapper).
    const community: Card[] = ['Ad', '7c', '2s', '9h', '3d'];
    const better = evaluateHandTwoDeck(['As', 'Kd'], community);
    const worse = evaluateHandTwoDeck(['Ah', 'Qd'], community);
    expect(compareHandsTwoDeck(better, worse)).toBe(1);
    expect(compareHandsTwoDeck(worse, better)).toBe(-1);

    const board: Card[] = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    const splitA = evaluateHandTwoDeck(['2c', '3d'], board);
    const splitB = evaluateHandTwoDeck(['4c', '5d'], board);
    expect(Object.is(compareHandsTwoDeck(splitA, splitB), 0)).toBe(true);

    // Custom-vs-custom covered in (i)/(j); mixed pairs:
    expect(compareHandsTwoDeck(fiveDeuces(), royal())).toBe(1);
    expect(compareHandsTwoDeck(royal(), fiveDeuces())).toBe(-1);
  });
});

describe('evaluateHandTwoDeck — rank categories are preserved through the suit-remap proxy (D-06)', () => {
  it('(l) scores a duplicate pair of aces as One Pair, NOT High Card — the counterexample that disqualifies the dedupe projection', () => {
    const result = evaluateHandTwoDeck(['Ah', 'Ah'], ['Jc', '9s', '7h', '5d', '2c']);
    expect(result.strength).not.toBe(HandStrength.HighCard);
    expect(result.strength).toBe(HandStrength.OnePair);
  });

  it('(m) scores dup-completed trips, quads and full houses to their physical categories', () => {
    expect(evaluateHandTwoDeck(['Ah', 'Ah'], ['As', '9s', '7h', '5d', '2c']).strength).toBe(HandStrength.ThreeOfAKind);
    expect(evaluateHandTwoDeck(['Ah', 'Ah'], ['Ad', 'As', '7h', '5d', '2c']).strength).toBe(HandStrength.FourOfAKind);
    expect(evaluateHandTwoDeck(['Ah', 'Ah'], ['As', '9s', '9c', '5d', '2c']).strength).toBe(HandStrength.FullHouse);
  });

  it('(n) ties a dup-derived pair of aces against a stock-evaluated clean pair with equal kickers at exactly 0', () => {
    const board: Card[] = ['Jc', '9s', '7h', '5d', '2c'];
    const dupPair = evaluateHandTwoDeck(['Ah', 'Ah'], board);
    const cleanPair = evaluateHand(['Ah', 'As'], board);
    expect(dupPair.strength).toBe(HandStrength.OnePair);
    expect(cleanPair.strength).toBe(HandStrength.OnePair);
    expect(compareHandsTwoDeck(dupPair, cleanPair)).toBe(0);
  });
});

describe('evaluateHandTwoDeck — the dup-flush zone (Assumption A1, D-16)', () => {
  it('(o) scores Ah Ah 2h 3h 4h as a Flush with the multiset tiebreak — the stock evaluator returns a malformed 1-card StraightFlush here', () => {
    const result = evaluateHandTwoDeck(['Ah', 'Ah'], ['2h', '3h', '4h', '9c', '9d']);
    expect(result.strength).toBe(HandStrength.Flush);
    expect(result.tiebreak).toEqual([12, 12, 2, 1, 0]);
  });

  it('(p) scores Ah Ah Kh Kh Qh as a Flush with tiebreak A,A,K,K,Q', () => {
    const result = evaluateHandTwoDeck(['Ah', 'Ah'], ['Kh', 'Kh', 'Qh', '2c', '3d']);
    expect(result.strength).toBe(HandStrength.Flush);
    expect(result.tiebreak).toEqual([12, 12, 11, 11, 10]);
  });

  it('(q) ranks the dup-flush (A,A,4,3,2) above a clean flush (A,K,Q,J,9), suit-agnostically', () => {
    const dupFlush = evaluateHandTwoDeck(['Ah', 'Ah'], ['2h', '3h', '4h', '9c', '9d']);
    const cleanFlush = evaluateHandTwoDeck(['Ah', 'Kh'], ['Qh', 'Jh', '9h', '2c', '3d']);
    expect(cleanFlush.strength).toBe(HandStrength.Flush);
    expect(compareHandsTwoDeck(dupFlush, cleanFlush)).toBe(1);
    expect(compareHandsTwoDeck(cleanFlush, dupFlush)).toBe(-1);
  });

  it('(r) scores 9h 9h 9s 9d 2h 3h 4h as Four of a Kind — the rank hand legitimately beats the 5-card heart flush (the max step); the stock evaluator returns a StraightFlush with an EMPTY hand array here', () => {
    const result = evaluateHandTwoDeck(['9h', '9h'], ['9s', '9d', '2h', '3h', '4h']);
    expect(result.strength).toBe(HandStrength.FourOfAKind);
  });
});

describe('evaluateHandTwoDeck — straights never extend through a duplicate', () => {
  it('(s) does not read 5,5,6,7,8 as a straight — only four DISTINCT consecutive ranks exist (the oracle scores this One Pair)', () => {
    const result = evaluateHandTwoDeck(['5h', '5h'], ['6c', '7d', '8s', '2c', '3d']);
    expect(result.strength).not.toBe(HandStrength.Straight);
    expect(result.strength).toBe(HandStrength.OnePair);
  });

  it('(t) still ranks the wheel as the LOWEST straight', () => {
    const wheel = evaluateHandTwoDeck(['As', '2h'], ['3d', '4c', '5s', 'Kd', 'Qh']);
    const sixHigh = evaluateHandTwoDeck(['2s', '3h'], ['4d', '5c', '6s', 'Kd', 'Qh']);
    expect(wheel.strength).toBe(HandStrength.Straight);
    expect(sixHigh.strength).toBe(HandStrength.Straight);
    expect(compareHandsTwoDeck(wheel, sixHigh)).toBe(-1);
  });

  it('(u) still scores A-K-Q-J-T suited as Royal Flush when an irrelevant duplicate is present', () => {
    const result = evaluateHandTwoDeck(['2c', '2c'], ['Ah', 'Kh', 'Qh', 'Jh', 'Th']);
    expect(result.strength).toBe(HandStrength.RoyalFlush);
  });
});

describe('evaluateHandTwoDeck — 5- and 6-card duplicate windows (the lockedInCategory shapes)', () => {
  it('(v) evaluates a 5-card dup window to its exact category', () => {
    const result = evaluateHandTwoDeck(['Ah', 'Ah'], ['Kd', 'Qs', 'Jc']);
    expect(result.strength).toBe(HandStrength.OnePair);
  });

  it('(w) evaluates a 6-card dup window to its exact category', () => {
    const result = evaluateHandTwoDeck(['Ah', 'Ah'], ['Kd', 'Qs', 'Jc', '9d']);
    expect(result.strength).toBe(HandStrength.OnePair);
  });
});
