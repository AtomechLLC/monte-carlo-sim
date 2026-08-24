// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { buildShoe, shoeSize, cardCounts, shoeWithout, type DeckCount } from './shoe';
import { FULL_DECK, deckWithout } from './cards';

describe('buildShoe — count-aware shoe construction (D-01, D-03)', () => {
  it('buildShoe(1) has length 52', () => {
    expect(buildShoe(1)).toHaveLength(52);
  });

  it('buildShoe(2) has length 104', () => {
    expect(buildShoe(2)).toHaveLength(104);
  });

  it('buildShoe(1) deep-equals [...FULL_DECK] — same values, same order', () => {
    expect(buildShoe(1)).toEqual([...FULL_DECK]);
  });

  it('buildShoe(2) deep-equals [...FULL_DECK, ...FULL_DECK] (concatenated, not interleaved) and contains exactly 2 occurrences of As', () => {
    expect(buildShoe(2)).toEqual([...FULL_DECK, ...FULL_DECK]);
    expect(buildShoe(2).filter((c) => c === 'As')).toHaveLength(2);
  });

  it('buildShoe(2) is a fresh mutable array each call: mutating the result does not affect a later call or FULL_DECK', () => {
    const first = buildShoe(2);
    const originalFullDeckFirst = FULL_DECK[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (first as any)[0] = 'INVALID';

    const second = buildShoe(2);
    expect(second[0]).not.toBe('INVALID');
    expect(FULL_DECK[0]).toBe(originalFullDeckFirst);
  });
});

describe('shoeSize — total physical cards in a full shoe (D-03)', () => {
  it('shoeSize(1) is 52', () => {
    expect(shoeSize(1)).toBe(52);
  });

  it('shoeSize(2) is 104', () => {
    expect(shoeSize(2)).toBe(104);
  });
});

describe('cardCounts — the shared occurrence-count primitive (D-01)', () => {
  it('counts occurrences per card value', () => {
    const counts = cardCounts(['As', 'As', 'Kd']);
    expect(counts.get('As')).toBe(2);
    expect(counts.get('Kd')).toBe(1);
    expect(counts.get('2c')).toBeUndefined();
  });

  it('returns an empty Map for an empty input', () => {
    const counts = cardCounts([]);
    expect(counts.size).toBe(0);
  });
});

describe('shoeWithout — count-aware subtraction, the DECK-01 headline primitive (D-01, D-03)', () => {
  it('shoeWithout(1, [As]) has length 51 and does not contain As', () => {
    const result = shoeWithout(1, ['As']);
    expect(result).toHaveLength(51);
    expect(result).not.toContain('As');
  });

  it('DECK-01 headline case: shoeWithout(2, [As]) has length 103 and contains As exactly ONCE — the second physical copy is still drawable', () => {
    const result = shoeWithout(2, ['As']);
    expect(result).toHaveLength(103);
    expect(result.filter((c) => c === 'As')).toHaveLength(1);
  });

  it('shoeWithout(2, [As, As]) has length 102 and contains no As', () => {
    const result = shoeWithout(2, ['As', 'As']);
    expect(result).toHaveLength(102);
    expect(result).not.toContain('As');
  });

  it('shoeWithout(1, [As, As]) over-excludes without throwing or going negative, matching v1 deckWithout for the same input', () => {
    const result = shoeWithout(1, ['As', 'As']);
    expect(result).toHaveLength(51);
    expect(result).not.toContain('As');
  });

  it('shoeWithout(2, []) deep-equals buildShoe(2)', () => {
    expect(shoeWithout(2, [])).toEqual(buildShoe(2));
  });

  it('shoeWithout(2, [As, Kd, As]) has length 101, contains no As, and contains Kd exactly once — excluded order does not matter, mixed multiplicities handled in one pass', () => {
    const result = shoeWithout(2, ['As', 'Kd', 'As']);
    expect(result).toHaveLength(101);
    expect(result).not.toContain('As');
    expect(result.filter((c) => c === 'Kd')).toHaveLength(1);
  });
});

describe('shoeWithout(1, x) v1 parity — exact-value sanity check against deckWithout (D-08, D-10)', () => {
  it('matches deckWithout output exactly for a representative excluded set', () => {
    const excluded: (typeof FULL_DECK)[number][] = ['As', 'Kd', '2c'];
    expect(shoeWithout(1, excluded)).toEqual(deckWithout(excluded));
  });
});

describe('shoeWithout property tests — v1 parity and multiset closure (D-08, D-01, D-10)', () => {
  test.prop([fc.uniqueArray(fc.integer({ min: 0, max: 51 }), { minLength: 0, maxLength: 13 })])(
    'D-08 v1-parity: shoeWithout(1, x) is array-identical to the untouched v1 deckWithout(x) for any excluded set — a mismatch here means the count-aware rewrite has drifted from v1 single-deck behaviour',
    (indices) => {
      const excluded = indices.map((i) => FULL_DECK[i]);
      expect(shoeWithout(1, excluded)).toEqual(deckWithout(excluded));
    },
  );

  test.prop([fc.array(fc.integer({ min: 0, max: 51 }), { maxLength: 13 })])(
    'D-08 v1-parity holds even when the excluded indices contain duplicate values at deckCount=1',
    (indices) => {
      const excluded = indices.map((i) => FULL_DECK[i]);
      expect(shoeWithout(1, excluded)).toEqual(deckWithout(excluded));
    },
  );

  // D-01: this assertion is deliberately COUNT-shaped, never set-membership-shaped. The 1-deck
  // sibling invariant — "every (street, revealedMask) combination reconstitutes exactly the
  // 52-card FULL_DECK with no duplicates", asserted via a dedup-then-measure-length idiom —
  // lives untouched at conditioning.test.ts line 111 (D-10: that property stays a 1-deck-only
  // invariant and is not modified here). At deckCount=2, that same dedup-then-measure-length
  // assertion would be not merely weaker but FALSE for correct output, since two legitimate
  // physical copies of the same value must both be present (PITFALLS.md Pitfall 12) — so
  // closure here is proven by reading exact occurrence counts out of a Map instead.
  test.prop([fc.constantFrom(1, 2), fc.array(fc.integer({ min: 0, max: 51 }), { maxLength: 20 })])(
    'multiset closure: shoeWithout(deckCount, excluded) plus excluded always reconstructs exactly deckCount copies of every FULL_DECK value',
    (deckCount, rawIndices) => {
      // Clamp so no card value is requested more than `deckCount` times — that is the only
      // shape of `excluded` a real caller could ever produce from a `deckCount`-sized shoe.
      const seen = new Map<number, number>();
      const clampedIndices: number[] = [];
      for (const index of rawIndices) {
        const occurrences = seen.get(index) ?? 0;
        if (occurrences < deckCount) {
          seen.set(index, occurrences + 1);
          clampedIndices.push(index);
        }
      }
      const excluded = clampedIndices.map((i) => FULL_DECK[i]);

      const result = shoeWithout(deckCount as DeckCount, excluded);
      expect(result.length).toBe(shoeSize(deckCount as DeckCount) - excluded.length);

      const combinedCounts = cardCounts([...result, ...excluded]);
      for (const card of FULL_DECK) {
        expect(combinedCounts.get(card)).toBe(deckCount);
      }
    },
  );
});
