import type { Card } from '@poker-apprentice/types';
import { CATEGORY_COUNT } from '../worker/protocol';

/** The known/unknown card partition a trial batch is conditioned on. */
export interface ConditionedState {
  heroHole: [Card, Card];
  remainingDeck: Card[];
}

/** Tallies produced by a single call to `runTrials`. */
export interface TrialBatchResult {
  /** Length `CATEGORY_COUNT`, indexed by `HandStrength` enum value. */
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
}

/**
 * STUB: replaced with the real evaluator-backed loop in plan 01-03 (ENG-01/ENG-02).
 *
 * Runs `trialCount` trials, calling `draw11()` on every iteration so the sampling path
 * (deck conditioning, RNG draw) is genuinely exercised end to end — only the poker math
 * (hand evaluation, win/tie/lose comparison) is stubbed. Every trial is tallied as a
 * `HighCard` win, deliberately arbitrary: this plan proves the streaming/worker plumbing
 * independently of evaluator correctness, so that plan 01-03's math bugs are unambiguous.
 */
export function runTrials(
  _state: ConditionedState,
  trialCount: number,
  draw11: () => Card[],
): TrialBatchResult {
  const categoryCounts = new Array(CATEGORY_COUNT).fill(0);
  const outcomes = { win: 0, tie: 0, lose: 0 };

  for (let t = 0; t < trialCount; t++) {
    draw11();
    categoryCounts[0]++;
    outcomes.win++;
  }

  return { categoryCounts, outcomes, trialsCompleted: trialCount };
}
