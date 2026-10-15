// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  AMERICAN_WHEEL,
  EUROPEAN_WHEEL,
  LAYOUT_NUMBERS,
  RED_POCKETS,
  SPINS_PER_BATCH,
  countHits,
  greenPockets,
  houseEdge,
  isPocketOnWheel,
  payoutFor,
  pocketColor,
  pocketCount,
  pocketsCovered,
  spinMany,
  targetHits,
  targetLabel,
  trueProbability,
  wheelPockets,
  type PredictionTarget,
  type WheelKind,
} from './roulette';
import { createRng } from './rng';

// The wheel model (quick task 261015-ch8). Composition and closed forms are exact-value
// tests; the spin sampler gets a seeded frequency anchor in the blackjackNaturalFrequency
// style — the standing rule there applies here too: a red anchor means fix the sampler,
// never widen the band.

describe('wheel composition', () => {
  it('the single-zero wheel has 37 distinct pockets: 0 and 1..36', () => {
    expect(EUROPEAN_WHEEL).toHaveLength(37);
    expect(new Set(EUROPEAN_WHEEL).size).toBe(37);
    expect([...EUROPEAN_WHEEL].sort()).toEqual(['0', ...LAYOUT_NUMBERS].sort());
  });

  it('the double-zero wheel has 38 distinct pockets: 0, 00 and 1..36', () => {
    expect(AMERICAN_WHEEL).toHaveLength(38);
    expect(new Set(AMERICAN_WHEEL).size).toBe(38);
    expect([...AMERICAN_WHEEL].sort()).toEqual(['0', '00', ...LAYOUT_NUMBERS].sort());
  });

  it('eighteen reds, eighteen blacks, and the zeros are green', () => {
    expect(RED_POCKETS.size).toBe(18);
    const blacks = LAYOUT_NUMBERS.filter((pocket) => pocketColor(pocket) === 'black');
    expect(blacks).toHaveLength(18);
    expect(pocketColor('0')).toBe('green');
    expect(pocketColor('00')).toBe('green');
    expect(pocketColor('1')).toBe('red');
    expect(pocketColor('2')).toBe('black');
    expect(pocketColor('10')).toBe('black');
    expect(pocketColor('19')).toBe('red');
  });

  it.each([['european'], ['american']] as const)(
    '%s: around the wheel, adjacent non-green pockets alternate red and black',
    (wheel) => {
      // The physical wheel's defining property, and the strongest check that the pocket
      // order was transcribed correctly: a single transposition breaks the alternation.
      const pockets = wheelPockets(wheel);
      for (let i = 0; i < pockets.length; i++) {
        const here = pocketColor(pockets[i]);
        const next = pocketColor(pockets[(i + 1) % pockets.length]);
        if (here === 'green' || next === 'green') continue;
        expect(here, `${pockets[i]} and ${pockets[(i + 1) % pockets.length]} are both ${here}`).not.toBe(next);
      }
    },
  );

  it('the double-zero wheel places 0 and 00 opposite each other', () => {
    const zero = AMERICAN_WHEEL.indexOf('0');
    const doubleZero = AMERICAN_WHEEL.indexOf('00');
    expect(Math.abs(zero - doubleZero)).toBe(19);
  });

  it('pocketColor rejects anything that is not a pocket', () => {
    expect(() => pocketColor('37')).toThrow(/not a roulette pocket/);
    expect(() => pocketColor('')).toThrow();
    expect(() => pocketColor('red')).toThrow();
  });

  it('isPocketOnWheel: 00 is only on the double-zero wheel', () => {
    expect(isPocketOnWheel('european', '00')).toBe(false);
    expect(isPocketOnWheel('american', '00')).toBe(true);
    expect(isPocketOnWheel('european', '0')).toBe(true);
    expect(isPocketOnWheel('european', '36')).toBe(true);
    expect(isPocketOnWheel('american', '37')).toBe(false);
  });

  it('greenPockets and pocketCount follow the wheel', () => {
    expect(greenPockets('european')).toEqual(['0']);
    expect(greenPockets('american')).toEqual(['0', '00']);
    expect(pocketCount('european')).toBe(37);
    expect(pocketCount('american')).toBe(38);
  });
});

describe('targets — coverage, probability, payout and the one house edge', () => {
  const red: PredictionTarget = { kind: 'color', color: 'red' };
  const green: PredictionTarget = { kind: 'color', color: 'green' };
  const seventeen: PredictionTarget = { kind: 'number', pocket: '17' };
  const doubleZero: PredictionTarget = { kind: 'number', pocket: '00' };

  it('covers 18 pockets for red or black, the zeros for green, one for a number', () => {
    expect(pocketsCovered('european', red)).toBe(18);
    expect(pocketsCovered('american', red)).toBe(18);
    expect(pocketsCovered('european', green)).toBe(1);
    expect(pocketsCovered('american', green)).toBe(2);
    expect(pocketsCovered('european', seventeen)).toBe(1);
    expect(pocketsCovered('european', doubleZero)).toBe(0);
    expect(pocketsCovered('american', doubleZero)).toBe(1);
  });

  it('true probabilities are the closed forms', () => {
    expect(trueProbability('european', red)).toBeCloseTo(18 / 37, 12);
    expect(trueProbability('american', red)).toBeCloseTo(18 / 38, 12);
    expect(trueProbability('european', green)).toBeCloseTo(1 / 37, 12);
    expect(trueProbability('american', green)).toBeCloseTo(2 / 38, 12);
    expect(trueProbability('european', seventeen)).toBeCloseTo(1 / 37, 12);
    expect(trueProbability('american', seventeen)).toBeCloseTo(1 / 38, 12);
    expect(trueProbability('european', doubleZero)).toBe(0);
  });

  it('payouts are the real-table figures, derived from coverage', () => {
    expect(payoutFor('european', seventeen)).toBe(35);
    expect(payoutFor('american', seventeen)).toBe(35);
    expect(payoutFor('european', red)).toBe(1);
    expect(payoutFor('european', green)).toBe(35);
    expect(payoutFor('american', green)).toBe(17);
    expect(payoutFor('european', doubleZero)).toBe(0);
  });

  it('house edge is 1/37 on the single-zero wheel and 2/38 on the double-zero wheel', () => {
    expect(houseEdge('european')).toBeCloseTo(1 / 37, 12);
    expect(houseEdge('american')).toBeCloseTo(2 / 38, 12);
    expect(houseEdge('american')).toBeGreaterThan(houseEdge('european'));
  });

  it('targetLabel capitalises a colour and passes a pocket through', () => {
    expect(targetLabel(red)).toBe('Red');
    expect(targetLabel(green)).toBe('Green');
    expect(targetLabel({ kind: 'color', color: 'black' })).toBe('Black');
    expect(targetLabel(seventeen)).toBe('17');
    expect(targetLabel(doubleZero)).toBe('00');
  });
});

describe('hits', () => {
  const spins = ['0', '32', '15', '19', '4', '17', '17', '00'];

  it('targetHits matches a pocket to a colour or to itself', () => {
    expect(targetHits('32', { kind: 'color', color: 'red' })).toBe(true);
    expect(targetHits('15', { kind: 'color', color: 'red' })).toBe(false);
    expect(targetHits('0', { kind: 'color', color: 'green' })).toBe(true);
    expect(targetHits('17', { kind: 'number', pocket: '17' })).toBe(true);
    expect(targetHits('7', { kind: 'number', pocket: '17' })).toBe(false);
  });

  it('countHits tallies over the history', () => {
    expect(countHits(spins, { kind: 'color', color: 'red' })).toBe(2); // 32, 19
    expect(countHits(spins, { kind: 'color', color: 'black' })).toBe(4); // 15, 4, 17, 17
    expect(countHits(spins, { kind: 'color', color: 'green' })).toBe(2); // 0, 00
    expect(countHits(spins, { kind: 'number', pocket: '17' })).toBe(2);
    expect(countHits(spins, { kind: 'number', pocket: '36' })).toBe(0);
    expect(countHits([], { kind: 'color', color: 'red' })).toBe(0);
  });
});

describe('spins — seeded, on-wheel, and the batch size the user asked for', () => {
  it('SPINS_PER_BATCH is 100', () => {
    expect(SPINS_PER_BATCH).toBe(100);
  });

  it('the same seed gives the same spins; a different seed does not', () => {
    const a = spinMany(createRng(7), 'european', 50);
    const b = spinMany(createRng(7), 'european', 50);
    const c = spinMany(createRng(8), 'european', 50);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(50);
  });

  it('every spin is a pocket of the wheel it was spun on', () => {
    const european = spinMany(createRng(1), 'european', 2000);
    const american = spinMany(createRng(1), 'american', 2000);
    for (const pocket of european) expect(isPocketOnWheel('european', pocket)).toBe(true);
    for (const pocket of american) expect(isPocketOnWheel('american', pocket)).toBe(true);
    expect(european).not.toContain('00');
    expect(american).toContain('00');
  });

  it('spinMany(…, 0) is an empty batch', () => {
    expect(spinMany(createRng(1), 'european', 0)).toEqual([]);
  });
});

// Seeded frequency anchor. 2,000,000 spins per wheel: at p ≈ 0.027 the per-pocket standard
// error is ~0.0115pp, so the ±0.06pp band is ~5σ — never flaky under this seed, and tight
// enough that a sampler quietly using the WRONG wheel size (2.63% vs 2.70% per pocket, a
// 0.07pp gap) lands outside it. The distinct-pocket count catches that mix-up structurally
// as well. Two million `uniformInt` calls take well under a second.
const SPINS_PER_ARM = 2_000_000;
const SEED = 20261015;
const POCKET_BAND_PP = 0.06;
const COLOR_BAND_PP = 0.2;
const ANCHOR_TIMEOUT_MS = 60_000;

function measure(wheel: WheelKind) {
  const rng = createRng(SEED);
  const counts = new Map<string, number>();
  let red = 0;
  let black = 0;
  let green = 0;
  for (let i = 0; i < SPINS_PER_ARM; i++) {
    const [pocket] = spinMany(rng, wheel, 1);
    counts.set(pocket, (counts.get(pocket) ?? 0) + 1);
    const color = pocketColor(pocket);
    if (color === 'red') red += 1;
    else if (color === 'black') black += 1;
    else green += 1;
  }
  const pct = (n: number) => (n / SPINS_PER_ARM) * 100;
  return { counts, redPct: pct(red), blackPct: pct(black), greenPct: pct(green), pct };
}

describe('frequency anchor — every pocket is equally likely, on both wheels', () => {
  it.each([['european', 37], ['american', 38]] as const)(
    '%s: each of the %d pockets lands within ±0.06pp of its closed form, and colours within ±0.2pp',
    (wheel, count) => {
      const { counts, redPct, blackPct, greenPct, pct } = measure(wheel);
      expect(counts.size).toBe(count);
      const expectedPocketPct = 100 / count;
      for (const pocket of wheelPockets(wheel)) {
        const observed = pct(counts.get(pocket) ?? 0);
        expect(
          Math.abs(observed - expectedPocketPct),
          `${wheel} pocket ${pocket}: ${observed.toFixed(3)}% vs ${expectedPocketPct.toFixed(3)}%`,
        ).toBeLessThanOrEqual(POCKET_BAND_PP);
      }
      expect(Math.abs(redPct - (1800 / count))).toBeLessThanOrEqual(COLOR_BAND_PP);
      expect(Math.abs(blackPct - (1800 / count))).toBeLessThanOrEqual(COLOR_BAND_PP);
      expect(Math.abs(greenPct - ((count - 36) * 100) / count)).toBeLessThanOrEqual(COLOR_BAND_PP);
    },
    ANCHOR_TIMEOUT_MS,
  );
});
