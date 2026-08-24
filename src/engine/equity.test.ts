// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
import { runTrials } from './equity';
import { FULL_DECK, deckWithout, CARDS_PER_TRIAL } from './cards';
import { createRng, createDrawer } from './rng';

describe('runTrials — Monte Carlo trial-loop correctness', () => {
  it('(a) tallies categoryCounts and outcomes that both sum to the trial count', () => {
    const rng = createRng(12345);
    const heroHole: [Card, Card] = [FULL_DECK[0], FULL_DECK[1]];
    const remainingDeck = deckWithout(heroHole);
    expect(remainingDeck).toHaveLength(50);

    const draw11 = createDrawer(rng, remainingDeck, CARDS_PER_TRIAL);
    const result = runTrials({ heroHole, remainingDeck }, 2000, draw11);

    expect(result.categoryCounts).toHaveLength(10);
    expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(2000);
  });

  it('(b) samples 11 distinct cards per trial, never reusing a hero hole card (ENG-02)', () => {
    const rng = createRng(999);
    const heroHole: [Card, Card] = [FULL_DECK[2], FULL_DECK[3]];
    const remainingDeck = deckWithout(heroHole);
    const baseDraw = createDrawer(rng, remainingDeck, CARDS_PER_TRIAL);

    const captured: Card[][] = [];
    const draw11 = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    runTrials({ heroHole, remainingDeck }, 500, draw11);

    expect(captured).toHaveLength(500);
    for (const sample of captured) {
      expect(sample).toHaveLength(11);
      expect(new Set(sample).size).toBe(11);
      expect(sample).not.toContain(heroHole[0]);
      expect(sample).not.toContain(heroHole[1]);
    }
  });

  it('(c) is deterministic: identical seeds produce identical categoryCounts and outcomes', () => {
    const heroHole: [Card, Card] = [FULL_DECK[4], FULL_DECK[5]];
    const remainingDeck = deckWithout(heroHole);

    const resultA = runTrials(
      { heroHole, remainingDeck },
      1000,
      createDrawer(createRng(42), remainingDeck, CARDS_PER_TRIAL),
    );
    const resultB = runTrials(
      { heroHole, remainingDeck },
      1000,
      createDrawer(createRng(42), remainingDeck, CARDS_PER_TRIAL),
    );

    expect(resultA.categoryCounts).toEqual(resultB.categoryCounts);
    expect(resultA.outcomes).toEqual(resultB.outcomes);
  });

  it('(d) rigged hero-wins scenario: hero pair of aces beats three high-card hands every trial', () => {
    const heroHole: [Card, Card] = ['As', 'Ah'];
    const fixedSample: Card[] = ['2c', '7d', '9s', 'Jh', '4s', '3d', '5d', '6c', '8c', 'Td', '3c'];

    const result = runTrials(
      { heroHole, remainingDeck: deckWithout(heroHole) },
      10,
      () => fixedSample,
    );

    expect(result.outcomes.win).toBe(10);
    expect(result.outcomes.tie).toBe(0);
    expect(result.outcomes.lose).toBe(0);
    expect(result.categoryCounts[HandStrength.OnePair]).toBe(10);
  });

  it('(e) rigged hero-loses scenario: hero high card loses to an opponent trips every trial', () => {
    const heroHole: [Card, Card] = ['3h', '5c'];
    const fixedSample: Card[] = ['2c', '7d', '9s', 'Jh', '4s', '9d', '9h', '6c', '8c', 'Td', '3c'];

    const result = runTrials(
      { heroHole, remainingDeck: deckWithout(heroHole) },
      10,
      () => fixedSample,
    );

    expect(result.outcomes.lose).toBe(10);
  });

  it('(e) rigged all-tie scenario: a royal flush on the board ties every hand every trial', () => {
    const heroHole: [Card, Card] = ['2c', '3d'];
    const fixedSample: Card[] = ['As', 'Ks', 'Qs', 'Js', 'Ts', '4c', '5d', '6c', '7d', '8c', '9d'];

    const result = runTrials(
      { heroHole, remainingDeck: deckWithout(heroHole) },
      10,
      () => fixedSample,
    );

    expect(result.outcomes.tie).toBe(10);
    expect(result.categoryCounts[HandStrength.RoyalFlush]).toBe(10);
  });
});
