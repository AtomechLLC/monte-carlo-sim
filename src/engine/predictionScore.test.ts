// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatSignedUnits, scorePrediction, scoreTallied } from './predictionScore';

describe('scorePrediction', () => {
  it('before the first trial: observed 0 (never NaN), nothing expected, nothing won or lost', () => {
    const score = scorePrediction(0, 0, 18 / 37, 1);
    expect(score.observed).toBe(0);
    expect(score.expectedHits).toBe(0);
    expect(score.netUnits).toBe(0);
    expect(Number.isNaN(score.observed)).toBe(false);
  });

  it('52 red hits in 100 spins at 1:1: observed 52%, 48.6 expected, +4 units', () => {
    const score = scorePrediction(52, 100, 18 / 37, 1);
    expect(score.observed).toBeCloseTo(0.52, 12);
    expect(score.expectedHits).toBeCloseTo(1800 / 37, 10);
    expect(score.netUnits).toBe(4);
  });

  it('3 straight-up hits in 100 spins at 35:1: +8 units — hits pay 35, each miss loses 1', () => {
    const score = scorePrediction(3, 100, 1 / 37, 35);
    expect(score.netUnits).toBe(3 * 35 - 97);
    expect(score.expectedHits).toBeCloseTo(2.7027, 4);
  });

  it('carries its inputs through unchanged', () => {
    const score = scorePrediction(7, 50, 0.25, 3);
    expect(score).toMatchObject({ hits: 7, trials: 50, probability: 0.25, payout: 3 });
  });
});

describe('formatSignedUnits', () => {
  it('signs positives, uses a real minus for negatives, and leaves zero bare', () => {
    expect(formatSignedUnits(4)).toBe('+4');
    expect(formatSignedUnits(-3)).toBe('−3');
    expect(formatSignedUnits(0)).toBe('0');
  });
});

describe('scoreTallied (261015-d7o) - outcomes the game settled itself', () => {
  it('reports pushes and uses the tallied net rather than hits x payout', () => {
    const score = scoreTallied({ hits: 48, pushes: 3, trials: 100, netUnits: -1 }, 949 / 1980, 1);
    expect(score.pushes).toBe(3);
    expect(score.observed).toBeCloseTo(0.48, 12);
    expect(score.expectedHits).toBeCloseTo(94900 / 1980, 10);
    expect(score.netUnits).toBe(-1);
    expect(score.payout).toBe(1);
  });

  it('is empty-safe', () => {
    const score = scoreTallied({ hits: 0, pushes: 0, trials: 0, netUnits: 0 }, 0.5, 1);
    expect(score.observed).toBe(0);
    expect(Number.isNaN(score.observed)).toBe(false);
  });

  it('scorePrediction still reports zero pushes', () => {
    expect(scorePrediction(1, 2, 0.5, 1).pushes).toBe(0);
  });
});

describe('formatSignedUnits - fractional nets (261015-d7o)', () => {
  it('prints a fractional net to one decimal and a near-zero net as 0', () => {
    expect(formatSignedUnits(7 / 6 - 1)).toBe('+0.2');
    expect(formatSignedUnits(-(7 / 6) * 2 + 3)).toBe('+0.7');
    expect(formatSignedUnits(5 * (7 / 6) - 6)).toBe('−0.2');
    expect(formatSignedUnits(0.04)).toBe('0');
    expect(formatSignedUnits(-0.04)).toBe('0');
    expect(formatSignedUnits(12.0)).toBe('+12');
  });
});
