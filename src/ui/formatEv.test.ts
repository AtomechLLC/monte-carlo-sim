import { describe, it, expect } from 'vitest';
import { formatEv } from './formatEv';
import { formatPct } from './formatPct';

describe('formatEv — signed per-unit EV in the locked A8 shape', () => {
  it('returns the em dash while pending, regardless of tallies', () => {
    expect(formatEv({ win: 900, push: 50, lose: 50 }, 1000, true)).toBe('—');
  });

  it('returns the em dash at zero trials, regardless of the counts', () => {
    expect(formatEv({ win: 5, push: 3, lose: 2 }, 0, false)).toBe('—');
  });

  it('uses the SAME em dash literal as formatPct (one dash convention, no second constant)', () => {
    expect(formatEv({ win: 0, push: 0, lose: 0 }, 0, false)).toBe(formatPct(0, 0, false));
    expect(formatEv({ win: 1, push: 1, lose: 1 }, 3, true)).toBe(formatPct(1, 3, true));
  });

  it('formats positive EV with a leading +, two decimals, single space, plural units', () => {
    // (56 - 44) / 100 = +0.12
    expect(formatEv({ win: 56, push: 0, lose: 44 }, 100, false)).toBe('+0.12 units');
  });

  it('formats negative EV with the typographic minus U+2212, never the ASCII hyphen', () => {
    // (41 - 59) / 100 = -0.18
    const result = formatEv({ win: 41, push: 0, lose: 59 }, 100, false);
    expect(result).toBe('−0.18 units');
    expect(result).not.toContain('-');
  });

  it('formats exactly-zero EV unsigned', () => {
    expect(formatEv({ win: 50, push: 0, lose: 50 }, 100, false)).toBe('0.00 units');
  });

  it('renders a value that ROUNDS to zero from the positive side unsigned (the rounds-to-zero trap)', () => {
    // (501 - 500) / 200000 = +0.000005 — rounds to 0.00; a rendered '+0.00' is a bug.
    expect(formatEv({ win: 501, push: 198999, lose: 500 }, 200000, false)).toBe('0.00 units');
  });

  it('renders a value that ROUNDS to zero from the negative side unsigned (the rounds-to-zero trap)', () => {
    // (500 - 501) / 200000 = -0.000005 — rounds to 0.00; a rendered '−0.00' is a bug.
    const result = formatEv({ win: 500, push: 198999, lose: 501 }, 200000, false);
    expect(result).toBe('0.00 units');
    expect(result).not.toContain('−');
    expect(result).not.toContain('+');
  });

  it('pushes contribute zero to the expectation', () => {
    expect(formatEv({ win: 1, push: 98, lose: 1 }, 100, false)).toBe('0.00 units');
  });

  it('formats the +1 boundary (all wins) as +1.00 units', () => {
    expect(formatEv({ win: 100, push: 0, lose: 0 }, 100, false)).toBe('+1.00 units');
  });

  it('formats the −1 boundary (all losses) as −1.00 units', () => {
    expect(formatEv({ win: 0, push: 0, lose: 100 }, 100, false)).toBe('−1.00 units');
  });
});
