// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  BET_LABELS,
  CRAPS_BETS,
  DICE_TOTALS,
  TRIALS_PER_BATCH,
  WAYS_TO_ROLL,
  betPayout,
  betPayoutText,
  countTotals,
  expectedValue,
  houseEdge,
  isPointTotal,
  pushProbability,
  resolveBet,
  rollDice,
  rollTotal,
  runTrials,
  tallyTrials,
  totalProbability,
  winProbability,
  type CrapsBet,
  type Roll,
} from './craps';
import { createRng } from './rng';

// Craps engine (quick task 261015-d7o). The resolution rules are exercised roll by roll with a
// scripted queue; the closed forms are exact-value tests; the sampler gets seeded anchors in the
// roulette/blackjack style — a red anchor means fix the sampler, never widen the band.

/** A roll source that hands out the scripted rolls in order and fails loudly if asked for more. */
function scripted(rolls: Roll[]): () => Roll {
  let cursor = 0;
  return () => {
    const roll = rolls[cursor++];
    if (roll === undefined) throw new Error('scripted roll source exhausted');
    return roll;
  };
}

describe('dice', () => {
  it('the 36 ordered pairs make the eleven totals in the triangle 1-2-3-4-5-6-5-4-3-2-1', () => {
    expect(DICE_TOTALS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(DICE_TOTALS.reduce((sum, total) => sum + WAYS_TO_ROLL[total], 0)).toBe(36);
    expect(WAYS_TO_ROLL[7]).toBe(6);
    expect(WAYS_TO_ROLL[2]).toBe(1);
    expect(WAYS_TO_ROLL[12]).toBe(1);
    expect(totalProbability(7)).toBeCloseTo(1 / 6, 12);
    expect(totalProbability(1)).toBe(0);
    expect(totalProbability(13)).toBe(0);
  });

  it('rollDice is seeded, in range, and sums correctly', () => {
    const a = Array.from({ length: 20 }, () => rollDice(createRng(3)));
    const b = Array.from({ length: 20 }, () => rollDice(createRng(3)));
    expect(a).toEqual(b);
    const rng = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const roll = rollDice(rng);
      expect(roll[0]).toBeGreaterThanOrEqual(1);
      expect(roll[0]).toBeLessThanOrEqual(6);
      expect(roll[1]).toBeGreaterThanOrEqual(1);
      expect(roll[1]).toBeLessThanOrEqual(6);
      expect(rollTotal(roll)).toBe(roll[0] + roll[1]);
    }
  });

  it('the points are 4, 5, 6, 8, 9 and 10', () => {
    expect(DICE_TOTALS.filter(isPointTotal)).toEqual([4, 5, 6, 8, 9, 10]);
  });
});

describe('bets — labels, payouts and closed forms', () => {
  it('lists the seven bets with their labels', () => {
    expect(CRAPS_BETS).toEqual(['pass', 'dontPass', 'field', 'anySeven', 'anyCraps', 'place6', 'place8']);
    expect(BET_LABELS.dontPass).toBe("Don't pass");
    expect(BET_LABELS.place8).toBe('Place 8');
  });

  it('headline payouts', () => {
    expect(betPayout('pass')).toBe(1);
    expect(betPayout('anySeven')).toBe(4);
    expect(betPayout('anyCraps')).toBe(7);
    expect(betPayout('place6')).toBeCloseTo(7 / 6, 12);
    expect(betPayoutText('field', 'triple12')).toBe('pays 1 to 1 · 2 pays double · 12 pays triple');
    expect(betPayoutText('field', 'double12')).toBe('pays 1 to 1 · 2 pays double · 12 pays double');
    expect(betPayoutText('place6', 'triple12')).toBe('pays 7 to 6');
    expect(betPayoutText('dontPass', 'triple12')).toBe('pays 1 to 1 · bar 12');
    expect(betPayoutText('anySeven', 'triple12')).toBe('pays 4 to 1');
  });

  it('win probabilities are the closed forms', () => {
    expect(winProbability('pass')).toBeCloseTo(0.492929, 6);
    expect(winProbability('dontPass')).toBeCloseTo(0.479293, 6);
    expect(winProbability('field')).toBeCloseTo(4 / 9, 12);
    expect(winProbability('anySeven')).toBeCloseTo(1 / 6, 12);
    expect(winProbability('anyCraps')).toBeCloseTo(1 / 9, 12);
    expect(winProbability('place6')).toBeCloseTo(5 / 11, 12);
    expect(winProbability('place8')).toBeCloseTo(5 / 11, 12);
  });

  it("only Don't pass pushes, and its win + push + loss account for everything", () => {
    for (const bet of CRAPS_BETS) {
      expect(pushProbability(bet)).toBe(bet === 'dontPass' ? 1 / 36 : 0);
    }
    // Don't pass loses exactly where Pass wins.
    expect(winProbability('dontPass') + pushProbability('dontPass') + winProbability('pass')).toBeCloseTo(1, 12);
  });

  it('expected values follow from the payouts: the house edge of each bet', () => {
    expect(expectedValue('pass', 'triple12')).toBeCloseTo(2 * (244 / 495) - 1, 12);
    expect(expectedValue('dontPass', 'triple12')).toBeCloseTo(949 / 1980 - 976 / 1980, 12);
    expect(expectedValue('field', 'triple12')).toBeCloseTo((14 + 2 + 3 - 20) / 36, 12);
    expect(expectedValue('field', 'double12')).toBeCloseTo((14 + 2 + 2 - 20) / 36, 12);
    expect(expectedValue('anySeven', 'triple12')).toBeCloseTo((6 * 4 - 30) / 36, 12);
    expect(expectedValue('anyCraps', 'triple12')).toBeCloseTo((4 * 7 - 32) / 36, 12);
    expect(expectedValue('place6', 'triple12')).toBeCloseTo((5 / 11) * (7 / 6) - 6 / 11, 12);
    expect(houseEdge('pass', 'triple12')).toBeCloseTo(0.014141, 6);
    expect(houseEdge('dontPass', 'triple12')).toBeCloseTo(0.013636, 6);
    expect(houseEdge('field', 'triple12')).toBeCloseTo(0.027778, 6);
    expect(houseEdge('field', 'double12')).toBeCloseTo(0.055556, 6);
    expect(houseEdge('anySeven', 'triple12')).toBeCloseTo(0.166667, 6);
    expect(houseEdge('anyCraps', 'triple12')).toBeCloseTo(0.111111, 6);
    expect(houseEdge('place8', 'triple12')).toBeCloseTo(0.015152, 6);
  });

  it('TRIALS_PER_BATCH is 100', () => {
    expect(TRIALS_PER_BATCH).toBe(100);
  });
});

describe('resolution — Pass line', () => {
  it('a natural 7 or 11 on the come-out wins at once', () => {
    expect(resolveBet('pass', 'triple12', scripted([[3, 4]]))).toEqual({
      rolls: [[3, 4]],
      outcome: 'win',
      units: 1,
      point: null,
    });
    expect(resolveBet('pass', 'triple12', scripted([[5, 6]])).outcome).toBe('win');
  });

  it('craps (2, 3, 12) on the come-out loses at once', () => {
    for (const roll of [[1, 1], [1, 2], [6, 6]] as Roll[]) {
      const trial = resolveBet('pass', 'triple12', scripted([roll]));
      expect(trial.outcome).toBe('lose');
      expect(trial.units).toBe(-1);
      expect(trial.rolls).toHaveLength(1);
      expect(trial.point).toBeNull();
    }
  });

  it('a point is set and must repeat before a 7 — other totals are rolled through', () => {
    const win = resolveBet('pass', 'triple12', scripted([[2, 2], [5, 5], [1, 1], [1, 3]]));
    expect(win).toEqual({ rolls: [[2, 2], [5, 5], [1, 1], [1, 3]], outcome: 'win', units: 1, point: 4 });

    const lose = resolveBet('pass', 'triple12', scripted([[4, 4], [5, 6], [3, 4]]));
    expect(lose).toEqual({ rolls: [[4, 4], [5, 6], [3, 4]], outcome: 'lose', units: -1, point: 8 });
  });
});

describe("resolution — Don't pass", () => {
  it('wins on a come-out 2 or 3, loses on 7 or 11, pushes on 12 (bar 12)', () => {
    expect(resolveBet('dontPass', 'triple12', scripted([[1, 1]]))).toMatchObject({ outcome: 'win', units: 1 });
    expect(resolveBet('dontPass', 'triple12', scripted([[1, 2]]))).toMatchObject({ outcome: 'win', units: 1 });
    expect(resolveBet('dontPass', 'triple12', scripted([[3, 4]]))).toMatchObject({ outcome: 'lose', units: -1 });
    expect(resolveBet('dontPass', 'triple12', scripted([[5, 6]]))).toMatchObject({ outcome: 'lose', units: -1 });
    expect(resolveBet('dontPass', 'triple12', scripted([[6, 6]]))).toEqual({
      rolls: [[6, 6]],
      outcome: 'push',
      units: 0,
      point: null,
    });
  });

  it('after a point, a 7 wins and the point repeating loses', () => {
    expect(resolveBet('dontPass', 'triple12', scripted([[3, 3], [2, 2], [3, 4]]))).toEqual({
      rolls: [[3, 3], [2, 2], [3, 4]],
      outcome: 'win',
      units: 1,
      point: 6,
    });
    expect(resolveBet('dontPass', 'triple12', scripted([[3, 3], [2, 4]]))).toMatchObject({
      outcome: 'lose',
      units: -1,
      point: 6,
    });
  });
});

describe('resolution — single-roll bets', () => {
  it('Field: 3/4/9/10/11 pay even, 2 pays double, 12 pays triple or double by house rule, the rest lose', () => {
    expect(resolveBet('field', 'triple12', scripted([[2, 2]]))).toMatchObject({ outcome: 'win', units: 1 });
    expect(resolveBet('field', 'triple12', scripted([[5, 6]]))).toMatchObject({ outcome: 'win', units: 1 });
    expect(resolveBet('field', 'triple12', scripted([[1, 1]]))).toMatchObject({ outcome: 'win', units: 2 });
    expect(resolveBet('field', 'triple12', scripted([[6, 6]]))).toMatchObject({ outcome: 'win', units: 3 });
    expect(resolveBet('field', 'double12', scripted([[6, 6]]))).toMatchObject({ outcome: 'win', units: 2 });
    for (const roll of [[2, 3], [3, 3], [3, 4], [4, 4]] as Roll[]) {
      expect(resolveBet('field', 'triple12', scripted([roll]))).toMatchObject({ outcome: 'lose', units: -1 });
    }
    expect(resolveBet('field', 'triple12', scripted([[1, 2]])).rolls).toHaveLength(1);
  });

  it('Any seven pays 4 to 1 on a 7 and loses on anything else', () => {
    expect(resolveBet('anySeven', 'triple12', scripted([[1, 6]]))).toMatchObject({ outcome: 'win', units: 4 });
    expect(resolveBet('anySeven', 'triple12', scripted([[2, 2]]))).toMatchObject({ outcome: 'lose', units: -1 });
  });

  it('Any craps pays 7 to 1 on 2, 3 or 12', () => {
    for (const roll of [[1, 1], [1, 2], [6, 6]] as Roll[]) {
      expect(resolveBet('anyCraps', 'triple12', scripted([roll]))).toMatchObject({ outcome: 'win', units: 7 });
    }
    expect(resolveBet('anyCraps', 'triple12', scripted([[3, 4]]))).toMatchObject({ outcome: 'lose', units: -1 });
  });
});

describe('resolution — Place 6 and Place 8', () => {
  it('rolls until the number (pays 7 to 6) or a 7 (loses), ignoring everything else', () => {
    const win = resolveBet('place6', 'triple12', scripted([[2, 3], [5, 5], [3, 3]]));
    expect(win.outcome).toBe('win');
    expect(win.units).toBeCloseTo(7 / 6, 12);
    expect(win.rolls).toHaveLength(3);
    expect(win.point).toBe(6);

    const lose = resolveBet('place8', 'triple12', scripted([[4, 4]]));
    expect(lose).toMatchObject({ outcome: 'win', point: 8 });
    expect(resolveBet('place8', 'triple12', scripted([[3, 3], [1, 6]]))).toMatchObject({ outcome: 'lose', units: -1, point: 8 });
  });
});

describe('trials, tallies and totals', () => {
  it('runTrials is seeded and returns exactly `count` resolved trials', () => {
    const a = runTrials(createRng(5), 'pass', 'triple12', 50);
    const b = runTrials(createRng(5), 'pass', 'triple12', 50);
    expect(a).toEqual(b);
    expect(a).toHaveLength(50);
    expect(runTrials(createRng(5), 'field', 'triple12', 0)).toEqual([]);
  });

  it('tallyTrials counts wins and pushes and sums the units', () => {
    const trials = [
      resolveBet('dontPass', 'triple12', scripted([[6, 6]])), // push
      resolveBet('dontPass', 'triple12', scripted([[1, 1]])), // win +1
      resolveBet('dontPass', 'triple12', scripted([[3, 4]])), // lose -1
      resolveBet('dontPass', 'triple12', scripted([[1, 2]])), // win +1
    ];
    expect(tallyTrials(trials)).toEqual({ hits: 2, pushes: 1, trials: 4, netUnits: 1 });
    expect(tallyTrials([])).toEqual({ hits: 0, pushes: 0, trials: 0, netUnits: 0 });
  });

  it('countTotals histograms every roll of every trial by total', () => {
    const trials = [
      resolveBet('pass', 'triple12', scripted([[2, 2], [5, 5], [1, 3]])), // 4, 10, 4
      resolveBet('field', 'triple12', scripted([[3, 4]])), // 7
    ];
    const counts = countTotals(trials);
    expect(counts.get(4)).toBe(2);
    expect(counts.get(10)).toBe(1);
    expect(counts.get(7)).toBe(1);
    expect(counts.get(2)).toBe(0);
    expect([...counts.keys()]).toEqual(DICE_TOTALS);
  });
});

// Seeded anchors, 500,000 decisions per bet. At p ≈ 0.49 the standard error of a win rate is
// ~0.071pp, so ±0.35pp is ~5σ; the Don't pass push rate (p = 1/36, SE ~0.023pp) gets ±0.12pp;
// the mean net per trial (SE ≈ 1/√N ≈ 0.14pp for the even-money bets, larger for the
// propositions) gets a band sized to its own payout spread. Across every roll of the pass-line
// arm (~1.7 million rolls) each dice total lands within ±0.15pp of ways/36.
const TRIALS_PER_ARM = 500_000;
const SEED = 20261015;
const WIN_BAND_PP = 0.35;
const PUSH_BAND_PP = 0.12;
const ANCHOR_TIMEOUT_MS = 120_000;

describe('frequency anchors — every bet converges on its closed form', () => {
  const arms: Array<[CrapsBet, number]> = [
    ['pass', 0.6],
    ['dontPass', 0.6],
    ['field', 0.8],
    ['anySeven', 1.2],
    ['anyCraps', 1.4],
    ['place6', 0.7],
  ];

  it.each(arms)(
    '%s: win rate within ±0.35pp, push rate within ±0.12pp, mean net within its band of the EV',
    (bet, netBandPp) => {
      const trials = runTrials(createRng(SEED), bet, 'triple12', TRIALS_PER_ARM);
      const tally = tallyTrials(trials);
      const winPct = (tally.hits / TRIALS_PER_ARM) * 100;
      const pushPct = (tally.pushes / TRIALS_PER_ARM) * 100;
      const meanNetPct = (tally.netUnits / TRIALS_PER_ARM) * 100;
      expect(Math.abs(winPct - winProbability(bet) * 100), `${bet} win rate ${winPct.toFixed(3)}%`).toBeLessThanOrEqual(WIN_BAND_PP);
      expect(Math.abs(pushPct - pushProbability(bet) * 100), `${bet} push rate ${pushPct.toFixed(3)}%`).toBeLessThanOrEqual(PUSH_BAND_PP);
      expect(
        Math.abs(meanNetPct - expectedValue(bet, 'triple12') * 100),
        `${bet} mean net ${meanNetPct.toFixed(3)}% vs EV ${(expectedValue(bet, 'triple12') * 100).toFixed(3)}%`,
      ).toBeLessThanOrEqual(netBandPp);
    },
    ANCHOR_TIMEOUT_MS,
  );

  it(
    'the dice-total triangle: across every roll of the pass-line arm, each total lands within ±0.15pp of ways/36',
    () => {
      const trials = runTrials(createRng(SEED), 'pass', 'triple12', TRIALS_PER_ARM);
      const counts = countTotals(trials);
      const rolls = [...counts.values()].reduce((a, b) => a + b, 0);
      expect(rolls).toBeGreaterThan(TRIALS_PER_ARM * 3);
      for (const total of DICE_TOTALS) {
        const observed = ((counts.get(total) ?? 0) / rolls) * 100;
        expect(Math.abs(observed - totalProbability(total) * 100), `total ${total}: ${observed.toFixed(3)}%`).toBeLessThanOrEqual(0.15);
      }
    },
    ANCHOR_TIMEOUT_MS,
  );
});
