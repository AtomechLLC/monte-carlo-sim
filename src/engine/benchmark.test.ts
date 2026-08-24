// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { runTrials, unknownCardsPerTrial, type ConditionedState } from './equity';
import { deckWithout } from './cards';
import { createRng, createDrawer } from './rng';

function preflopState(heroHole: [Card, Card]): ConditionedState {
  return {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
}

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
      const state = preflopState(heroHole);
      const drawUnknown = createDrawer(createRng(20260823), state.remainingDeck, unknownCardsPerTrial(state));

      const result = runTrials(state, 200000, drawUnknown);

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
    const aceState = preflopState(aceHole);
    const aceResult = runTrials(
      aceState,
      trialCount,
      createDrawer(createRng(seed), aceState.remainingDeck, unknownCardsPerTrial(aceState)),
    );

    const trashHole: [Card, Card] = ['7h', '2c'];
    const trashState = preflopState(trashHole);
    const trashResult = runTrials(
      trashState,
      trialCount,
      createDrawer(createRng(seed), trashState.remainingDeck, unknownCardsPerTrial(trashState)),
    );

    const aceWinRate = aceResult.outcomes.win / aceResult.trialsCompleted;
    const trashWinRate = trashResult.outcomes.win / trashResult.trialsCompleted;

    expect(aceWinRate).toBeGreaterThan(trashWinRate);
  });
});
