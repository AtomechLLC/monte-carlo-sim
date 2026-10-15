// @vitest-environment node
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  CRAPS_BETS,
  betPayout,
  countTotals,
  isPointTotal,
  rollTotal,
  runTrials,
  tallyTrials,
  winProbability,
  type CrapsBet,
  type FieldRule,
} from './craps';
import { scoreTallied } from './predictionScore';
import { createRng } from './rng';

// Invariants of the craps engine that hold for ANY bet, seed, rule and batch length.

const betArb = fc.constantFrom<CrapsBet>(...CRAPS_BETS);
const ruleArb = fc.constantFrom<FieldRule>('triple12', 'double12');
const SINGLE_ROLL: readonly CrapsBet[] = ['field', 'anySeven', 'anyCraps'];

describe('every resolved trial is well-formed', () => {
  test.prop([betArb, ruleArb, fc.integer(), fc.integer({ min: 0, max: 200 })])(
    'units agree with the outcome, every trial took at least one roll, and single-roll bets took exactly one',
    (bet, rule, seed, count) => {
      const trials = runTrials(createRng(seed), bet, rule, count);
      expect(trials).toHaveLength(count);
      for (const trial of trials) {
        expect(trial.rolls.length).toBeGreaterThanOrEqual(1);
        if (SINGLE_ROLL.includes(bet)) expect(trial.rolls).toHaveLength(1);
        if (trial.outcome === 'win') expect(trial.units).toBeGreaterThan(0);
        if (trial.outcome === 'lose') expect(trial.units).toBe(-1);
        if (trial.outcome === 'push') {
          expect(trial.units).toBe(0);
          expect(bet).toBe('dontPass');
        }
        for (const roll of trial.rolls) {
          expect(rollTotal(roll)).toBeGreaterThanOrEqual(2);
          expect(rollTotal(roll)).toBeLessThanOrEqual(12);
        }
      }
    },
  );

  test.prop([fc.constantFrom<CrapsBet>('pass', 'dontPass'), fc.integer(), fc.integer({ min: 1, max: 200 })])(
    'a multi-roll line decision opens on a point total and closes on that point or a 7',
    (bet, seed, count) => {
      for (const trial of runTrials(createRng(seed), bet, 'triple12', count)) {
        if (trial.rolls.length === 1) {
          expect(trial.point).toBeNull();
          continue;
        }
        const comeOut = rollTotal(trial.rolls[0]);
        const last = rollTotal(trial.rolls[trial.rolls.length - 1]);
        expect(isPointTotal(comeOut)).toBe(true);
        expect(trial.point).toBe(comeOut);
        expect(last === comeOut || last === 7).toBe(true);
        // Every roll in between settled nothing.
        for (const roll of trial.rolls.slice(1, -1)) {
          const total = rollTotal(roll);
          expect(total === comeOut || total === 7).toBe(false);
        }
      }
    },
  );

  test.prop([fc.constantFrom<CrapsBet>('place6', 'place8'), fc.integer(), fc.integer({ min: 1, max: 200 })])(
    'a place decision closes on its number or a 7 and nothing else',
    (bet, seed, count) => {
      const number = bet === 'place6' ? 6 : 8;
      for (const trial of runTrials(createRng(seed), bet, 'triple12', count)) {
        const last = rollTotal(trial.rolls[trial.rolls.length - 1]);
        expect(last === number || last === 7).toBe(true);
        expect(trial.outcome).toBe(last === number ? 'win' : 'lose');
        expect(trial.point).toBe(number);
      }
    },
  );
});

describe('tallies and scores', () => {
  test.prop([betArb, ruleArb, fc.integer(), fc.integer({ min: 0, max: 200 })])(
    'wins + pushes + losses account for every trial, the net is the sum of units, and the score carries it through',
    (bet, rule, seed, count) => {
      const trials = runTrials(createRng(seed), bet, rule, count);
      const tally = tallyTrials(trials);
      const losses = trials.filter((trial) => trial.outcome === 'lose').length;
      expect(tally.hits + tally.pushes + losses).toBe(count);
      expect(tally.netUnits).toBeCloseTo(trials.reduce((sum, trial) => sum + trial.units, 0), 9);

      const score = scoreTallied(tally, winProbability(bet), betPayout(bet));
      expect(score.observed).toBe(count === 0 ? 0 : tally.hits / count);
      expect(score.pushes).toBe(tally.pushes);
      expect(score.expectedHits).toBeCloseTo(winProbability(bet) * count, 12);
      expect(score.netUnits).toBe(tally.netUnits);
    },
  );

  test.prop([betArb, ruleArb, fc.integer(), fc.integer({ min: 0, max: 200 })])(
    'the total histogram counts every roll exactly once',
    (bet, rule, seed, count) => {
      const trials = runTrials(createRng(seed), bet, rule, count);
      const counts = countTotals(trials);
      const rolls = trials.reduce((sum, trial) => sum + trial.rolls.length, 0);
      expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(rolls);
    },
  );
});
