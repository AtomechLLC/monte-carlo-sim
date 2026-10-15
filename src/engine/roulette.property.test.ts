// @vitest-environment node
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  countHits,
  houseEdge,
  isPocketOnWheel,
  payoutFor,
  pocketColor,
  pocketsCovered,
  spinMany,
  trueProbability,
  wheelPockets,
  type PredictionTarget,
  type WheelKind,
} from './roulette';
import { scorePrediction } from './predictionScore';
import { createRng } from './rng';

// Invariants of the wheel model that hold for ANY wheel, seed, batch length and target —
// the roulette sibling of the engine's other property suites.

const wheelArb = fc.constantFrom<WheelKind>('european', 'american');
const colorArb = fc.constantFrom('red', 'black', 'green' as const);
const pocketArb = fc.constantFrom(...wheelPockets('american'));
const targetArb: fc.Arbitrary<PredictionTarget> = fc.oneof(
  colorArb.map((color) => ({ kind: 'color', color }) as const),
  pocketArb.map((pocket) => ({ kind: 'number', pocket }) as const),
);

describe('spins', () => {
  test.prop([wheelArb, fc.integer(), fc.integer({ min: 0, max: 400 })])(
    'every spin is a pocket of its wheel, and the batch has exactly the requested length',
    (wheel, seed, count) => {
      const spins = spinMany(createRng(seed), wheel, count);
      expect(spins).toHaveLength(count);
      for (const pocket of spins) expect(isPocketOnWheel(wheel, pocket)).toBe(true);
    },
  );

  test.prop([wheelArb, fc.integer(), fc.integer({ min: 0, max: 400 })])(
    'red + black + green hits account for every spin',
    (wheel, seed, count) => {
      const spins = spinMany(createRng(seed), wheel, count);
      const red = countHits(spins, { kind: 'color', color: 'red' });
      const black = countHits(spins, { kind: 'color', color: 'black' });
      const green = countHits(spins, { kind: 'color', color: 'green' });
      expect(red + black + green).toBe(count);
    },
  );

  test.prop([wheelArb, fc.integer(), fc.integer({ min: 0, max: 400 }), targetArb])(
    'a target never hits more often than there were spins, and a number target hits exactly its own occurrences',
    (wheel, seed, count, target) => {
      const spins = spinMany(createRng(seed), wheel, count);
      const hits = countHits(spins, target);
      expect(hits).toBeGreaterThanOrEqual(0);
      expect(hits).toBeLessThanOrEqual(count);
      if (target.kind === 'number') {
        expect(hits).toBe(spins.filter((pocket) => pocket === target.pocket).length);
      } else {
        expect(hits).toBe(spins.filter((pocket) => pocketColor(pocket) === target.color).length);
      }
    },
  );
});

describe('the one house edge', () => {
  test.prop([wheelArb, targetArb])(
    'every target that covers at least one pocket has expected value exactly −(house edge)',
    (wheel, target) => {
      fc.pre(pocketsCovered(wheel, target) > 0);
      const p = trueProbability(wheel, target);
      const ev = p * payoutFor(wheel, target) - (1 - p);
      expect(ev).toBeCloseTo(-houseEdge(wheel), 12);
    },
  );

  test.prop([wheelArb, targetArb])('probability is in (0, 1/2] and coverage never exceeds the wheel', (wheel, target) => {
    const p = trueProbability(wheel, target);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(0.5);
    expect(pocketsCovered(wheel, target)).toBeLessThanOrEqual(wheelPockets(wheel).length);
  });
});

describe('scoring', () => {
  test.prop([wheelArb, fc.integer(), fc.integer({ min: 0, max: 400 }), targetArb])(
    'expected hits scale with the batch and observed is the hit fraction',
    (wheel, seed, count, target) => {
      const spins = spinMany(createRng(seed), wheel, count);
      const hits = countHits(spins, target);
      const score = scorePrediction(hits, count, trueProbability(wheel, target), payoutFor(wheel, target));
      expect(score.expectedHits).toBeCloseTo(trueProbability(wheel, target) * count, 12);
      expect(score.observed).toBe(count === 0 ? 0 : hits / count);
      expect(Number.isNaN(score.observed)).toBe(false);
      expect(score.netUnits).toBe(hits * payoutFor(wheel, target) - (count - hits));
    },
  );
});
