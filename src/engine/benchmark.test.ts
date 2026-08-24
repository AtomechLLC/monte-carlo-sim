// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { runTrials } from './equity';
import { deckWithout, CARDS_PER_TRIAL } from './cards';
import { createRng, createDrawer } from './rng';

// A 200,000-trial run performs 800,000 hand evaluations (hero + 3 opponents per trial) and
// takes seconds, not milliseconds — give it explicit headroom above Vitest's 5s default.
const BENCHMARK_TIMEOUT_MS = 60000;

describe('runTrials — accuracy against a verified equity benchmark (ENG-04)', () => {
  it(
    '(a) AA versus 3 opponents brackets the verified 63.83% equity benchmark',
    () => {
      // Benchmark provenance: computed by the phase research session directly against
      // @poker-apprentice/hand-evaluator@4.3.0 at 2,000,000 samples on 2026-08-23.
      const heroHole: [Card, Card] = ['As', 'Ah'];
      const remainingDeck = deckWithout(heroHole);
      const draw11 = createDrawer(createRng(20260823), remainingDeck, CARDS_PER_TRIAL);

      const result = runTrials({ heroHole, remainingDeck }, 200000, draw11);

      const winRate = (result.outcomes.win / result.trialsCompleted) * 100;
      const tieRate = (result.outcomes.tie / result.trialsCompleted) * 100;

      // Strict bracket: winRate <= equity <= winRate + tieRate (tied pots split equity).
      // A 1.0 percentage-point band is far outside the ~0.11pp standard error at this
      // trial count.
      expect(winRate).toBeLessThanOrEqual(63.83 + 1.0);
      expect(winRate + tieRate).toBeGreaterThanOrEqual(63.83 - 1.0);
      // Inversion floor: a sign-inverted comparator would report a win rate near 12% here
      // — no tolerance band above should ever be widened to accommodate that instead.
      expect(winRate).toBeGreaterThanOrEqual(55);
    },
    BENCHMARK_TIMEOUT_MS,
  );

  it('(b) AA wins more often than 7-2 offsuit against the same number of opponents', () => {
    // Benchmark provenance: computed by the phase research session directly against
    // @poker-apprentice/hand-evaluator@4.3.0 at 2,000,000 samples on 2026-08-23 (AA vs. 3:
    // 63.83%; 7-2o vs. 1: 34.57% — this case needs no external reference value, it only
    // needs the ordering to be correct, which fails loudly under any comparator inversion).
    const seed = 42;
    const trialCount = 20000;

    const aceHole: [Card, Card] = ['As', 'Ah'];
    const aceDeck = deckWithout(aceHole);
    const aceResult = runTrials(
      { heroHole: aceHole, remainingDeck: aceDeck },
      trialCount,
      createDrawer(createRng(seed), aceDeck, CARDS_PER_TRIAL),
    );

    const trashHole: [Card, Card] = ['7h', '2c'];
    const trashDeck = deckWithout(trashHole);
    const trashResult = runTrials(
      { heroHole: trashHole, remainingDeck: trashDeck },
      trialCount,
      createDrawer(createRng(seed), trashDeck, CARDS_PER_TRIAL),
    );

    const aceWinRate = aceResult.outcomes.win / aceResult.trialsCompleted;
    const trashWinRate = trashResult.outcomes.win / trashResult.trialsCompleted;

    expect(aceWinRate).toBeGreaterThan(trashWinRate);
  });
});
