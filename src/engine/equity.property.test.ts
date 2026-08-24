// @vitest-environment node
import { test, fc } from '@fast-check/vitest';
import { expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { runTrials } from './equity';
import { FULL_DECK, deckWithout, CARDS_PER_TRIAL } from './cards';
import { createRng, createDrawer } from './rng';

// ENG-04: invariants that must hold for every input, not just the hand-picked cases in
// equity.test.ts. A sign-inverted comparator or a biased sampler can pass every
// deterministic test while still producing wrong odds; these properties close that gap.

test.prop([fc.integer({ min: 1, max: 3000 }), fc.integer()])(
  '(a) categoryCounts and outcomes always sum exactly to the trial count, for any trial count and seed',
  (trialCount, seed) => {
    const rng = createRng(seed);
    const heroHole: [Card, Card] = [FULL_DECK[0], FULL_DECK[1]];
    const remainingDeck = deckWithout(heroHole);
    const draw11 = createDrawer(rng, remainingDeck, CARDS_PER_TRIAL);

    const result = runTrials({ heroHole, remainingDeck }, trialCount, draw11);

    const categorySum = result.categoryCounts.reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(trialCount);
    expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(trialCount);
  },
);

test.prop([
  fc.uniqueArray(fc.integer({ min: 0, max: FULL_DECK.length - 1 }), {
    minLength: 2,
    maxLength: 2,
  }),
])(
  '(b) every trial samples 11 distinct cards excluding the hero hole, for any hero hand (ENG-02)',
  (indices) => {
    const heroHole: [Card, Card] = [FULL_DECK[indices[0]], FULL_DECK[indices[1]]];
    const remainingDeck = deckWithout(heroHole);
    expect(remainingDeck).toHaveLength(FULL_DECK.length - 2);

    const rng = createRng(2026);
    const baseDraw = createDrawer(rng, remainingDeck, CARDS_PER_TRIAL);
    const captured: Card[][] = [];
    const draw11 = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    // 100 trials is enough — this property is about sampling structure, not statistics.
    runTrials({ heroHole, remainingDeck }, 100, draw11);

    expect(captured).toHaveLength(100);
    for (const sample of captured) {
      expect(sample).toHaveLength(CARDS_PER_TRIAL);
      expect(new Set(sample).size).toBe(CARDS_PER_TRIAL);
      expect(sample).not.toContain(heroHole[0]);
      expect(sample).not.toContain(heroHole[1]);
    }
  },
);
