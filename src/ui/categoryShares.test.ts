// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { categoryShares, shareWidth } from './categoryShares';
import { formatPct } from './formatPct';

// The Share column's geometry, tested where it is cheapest to test: as a pure function, with
// no table rendered. The DOM-level consequences (which cell, which class, which testid) are
// pinned separately in OddsTable.shareBars.test.tsx.

/** The distribution the frozen v1 suites use — max 500 at index 0, 1000 trials. */
const SETTLED_10 = [500, 300, 100, 50, 25, 15, 5, 3, 1, 1];

describe('categoryShares — relative-to-max geometry', () => {
  it('gives the largest category a full bar and scales every other bar against it', () => {
    const shares = categoryShares(SETTLED_10, 10, 1000, false);

    expect(shares.map((entry) => entry.share)).toEqual([
      1, 0.6, 0.2, 0.1, 0.05, 0.03, 0.01, 0.006, 0.002, 0.002,
    ]);
  });

  it('scales against the MAX, not against the trial count — a flat-topped distribution still fills', () => {
    // Every category at 10% of trials: relative-to-100 would draw ten near-invisible stubs;
    // relative-to-max correctly draws ten full bars, because that IS the shape.
    const flat = new Array(10).fill(100) as number[];
    const shares = categoryShares(flat, 10, 1000, false);

    expect(shares.every((entry) => entry.share === 1)).toBe(true);
    // ...and the percentages are emphatically NOT 100% — the two columns say different,
    // complementary things, which is the whole point of keeping both.
    expect(formatPct(flat[0], 1000, false)).toBe('10.0%');
  });

  it('marks exactly the max-holding category as leading', () => {
    const shares = categoryShares(SETTLED_10, 10, 1000, false);

    expect(shares.map((entry) => entry.leading)).toEqual([
      true, false, false, false, false, false, false, false, false, false,
    ]);
  });

  it('marks every member of an exact tie as leading rather than picking an arbitrary winner', () => {
    const shares = categoryShares([400, 400, 200], 3, 1000, false);

    expect(shares.map((entry) => entry.leading)).toEqual([true, true, false]);
    expect(shares.map((entry) => entry.share)).toEqual([1, 1, 0.5]);
  });

  it('tracks the leader as it changes: a later category overtaking index 0 moves the emphasis', () => {
    const early = categoryShares([500, 300, 100], 3, 900, false);
    const late = categoryShares([500, 900, 100], 3, 1500, false);

    expect(early[0].leading).toBe(true);
    expect(early[1].leading).toBe(false);
    expect(late[0].leading).toBe(false);
    expect(late[1].leading).toBe(true);
    // The former leader keeps a proportional (not zeroed) bar.
    expect(late[0].share).toBeCloseTo(500 / 900, 10);
  });
});

describe('categoryShares — the animation gate (TBL-04)', () => {
  it('returns all-empty bars while pending, even with a fully settled snapshot in the store', () => {
    const shares = categoryShares(SETTLED_10, 10, 1000, true);

    expect(shares).toHaveLength(10);
    expect(shares.every((entry) => entry.share === 0)).toBe(true);
    expect(shares.every((entry) => entry.leading === false)).toBe(true);
  });

  it('returns all-empty bars at zero trials', () => {
    const shares = categoryShares(new Array(10).fill(0) as number[], 10, 0, false);

    expect(shares.every((entry) => entry.share === 0 && !entry.leading)).toBe(true);
  });

  it('NEGATIVE CONTROL: the gate is real — the same snapshot ungated produces a non-empty shape', () => {
    // Without this, "bars are empty while pending" could pass against a function that ALWAYS
    // returns zeros. The gated and ungated calls differ only in the `pending` flag.
    const gated = categoryShares(SETTLED_10, 10, 1000, true);
    const ungated = categoryShares(SETTLED_10, 10, 1000, false);

    expect(gated.some((entry) => entry.share > 0)).toBe(false);
    expect(ungated.some((entry) => entry.share > 0)).toBe(true);
    expect(ungated[0].leading).toBe(true);
  });
});

describe('categoryShares — snapshot/row-count mismatches', () => {
  it('reads a missing index as zero rather than NaN (10-entry snapshot, 11 rows)', () => {
    const shares = categoryShares(SETTLED_10, 11, 1000, false);

    expect(shares).toHaveLength(11);
    expect(shares[10]).toEqual({ share: 0, leading: false });
    expect(Number.isNaN(shares[10].share)).toBe(false);
  });

  it('ignores counts BEYOND the visible row count when picking the max', () => {
    // A stale 11-entry snapshot whose invisible index 10 dwarfs everything must not be able to
    // flatten the ten bars the table is actually rendering.
    const stale = [...SETTLED_10, 99_000];
    const shares = categoryShares(stale, 10, 1000, false);

    expect(shares).toHaveLength(10);
    expect(shares[0]).toEqual({ share: 1, leading: true });
  });

  it('returns all-empty bars for an all-zero histogram instead of dividing by zero', () => {
    const shares = categoryShares(new Array(10).fill(0) as number[], 10, 1000, false);

    expect(shares.every((entry) => entry.share === 0 && !entry.leading)).toBe(true);
    expect(shares.every((entry) => Number.isFinite(entry.share))).toBe(true);
  });

  it('floors a malformed negative count rather than inverting it into a negative width', () => {
    const shares = categoryShares([500, -300, 100], 3, 1000, false);

    expect(shares[1].share).toBe(0);
    expect(shareWidth(shares[1].share)).toBe('0.0%');
  });

  it('returns an empty array for a zero row count', () => {
    expect(categoryShares(SETTLED_10, 0, 1000, false)).toEqual([]);
  });
});

describe('shareWidth', () => {
  it('renders a one-decimal CSS percentage', () => {
    expect(shareWidth(1)).toBe('100.0%');
    expect(shareWidth(0.6)).toBe('60.0%');
    expect(shareWidth(0)).toBe('0.0%');
  });

  it('never emits a float tail that would make a width assertion unassertable', () => {
    expect(shareWidth(1 / 3)).toBe('33.3%');
  });
});

describe('categoryShares — invariants', () => {
  const counts = fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 0, maxLength: 14 });

  test.prop([counts, fc.integer({ min: 0, max: 14 }), fc.integer({ min: 1, max: 1_000_000 })])(
    'every share is a finite value in [0, 1], and the result length always equals the row count',
    (values, rowCount, trials) => {
      const shares = categoryShares(values, rowCount, trials, false);

      expect(shares).toHaveLength(rowCount);
      for (const entry of shares) {
        expect(Number.isFinite(entry.share)).toBe(true);
        expect(entry.share).toBeGreaterThanOrEqual(0);
        expect(entry.share).toBeLessThanOrEqual(1);
      }
    },
  );

  test.prop([counts, fc.integer({ min: 1, max: 14 }), fc.integer({ min: 1, max: 1_000_000 })])(
    'at least one bar is full whenever any visible category is non-zero, and no bar is full otherwise',
    (values, rowCount, trials) => {
      const shares = categoryShares(values, rowCount, trials, false);
      const anyVisibleCount = Array.from({ length: rowCount }, (_, i) => values[i] ?? 0).some(
        (count) => count > 0,
      );

      expect(shares.some((entry) => entry.share === 1)).toBe(anyVisibleCount);
      expect(shares.some((entry) => entry.leading)).toBe(anyVisibleCount);
    },
  );

  test.prop([counts, fc.integer({ min: 0, max: 14 }), fc.integer({ min: 0, max: 1_000_000 }), fc.boolean()])(
    'THE GATE INVARIANT: a bar is empty whenever its percentage cell shows the em dash',
    (values, rowCount, trials, pending) => {
      const shares = categoryShares(values, rowCount, trials, pending);

      shares.forEach((entry, index) => {
        if (formatPct(values[index] ?? 0, trials, pending) === '—') {
          expect(entry.share).toBe(0);
          expect(entry.leading).toBe(false);
        }
      });
    },
  );

  test.prop([counts, fc.integer({ min: 1, max: 14 }), fc.integer({ min: 1, max: 1_000_000 })])(
    'bar order matches count order — a bigger count never draws a shorter bar',
    (values, rowCount, trials) => {
      const shares = categoryShares(values, rowCount, trials, false);
      const visible = Array.from({ length: rowCount }, (_, i) => Math.max(0, values[i] ?? 0));

      for (let a = 0; a < rowCount; a += 1) {
        for (let b = 0; b < rowCount; b += 1) {
          if (visible[a] > visible[b]) {
            expect(shares[a].share).toBeGreaterThan(shares[b].share);
          }
        }
      }
    },
  );
});
