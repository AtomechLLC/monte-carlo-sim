import type { Card } from '@poker-apprentice/types';
import { CATEGORY_COUNT } from '../worker/protocol';
import { evaluateHand, compareHands, type Hand } from './evaluator';

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
 * Runs `trialCount` real Monte Carlo trials of Hold'em vs. 3 opponents.
 *
 * Each trial draws 11 unknown cards via `draw11()` (5 board + 2 per opponent x 3),
 * evaluates all four hands with `evaluateHand`, buckets the hero's category into a
 * `CATEGORY_COUNT`-length histogram, and determines win/tie/lose via an explicit
 * max-then-count-ties reduction over `compareHands` — never ad-hoc pairwise
 * greater-than chains, which get multi-way tie shapes wrong.
 *
 * Does NOT use the library's own built-in equity-simulation generator: its RNG is a
 * hardcoded `Math.random` with no injection point (breaks seeded determinism), and its
 * result shape carries no hand-category breakdown.
 */
export function runTrials(
  state: ConditionedState,
  trialCount: number,
  draw11: () => Card[],
): TrialBatchResult {
  const categoryCounts = new Array(CATEGORY_COUNT).fill(0);
  const outcomes = { win: 0, tie: 0, lose: 0 };

  for (let t = 0; t < trialCount; t++) {
    const sampled = draw11();
    const board = sampled.slice(0, 5);
    const oppHoles: [Card, Card][] = [
      [sampled[5], sampled[6]],
      [sampled[7], sampled[8]],
      [sampled[9], sampled[10]],
    ];

    const hero = evaluateHand(state.heroHole, board);
    const villains = oppHoles.map((hole) => evaluateHand(hole, board));

    categoryCounts[hero.strength]++;

    const allHands: Hand[] = [hero, ...villains];
    let best = allHands[0];
    for (let i = 1; i < allHands.length; i++) {
      if (compareHands(allHands[i], best) > 0) {
        best = allHands[i];
      }
    }

    if (compareHands(hero, best) !== 0) {
      outcomes.lose++;
    } else {
      let tiedCount = 0;
      for (const hand of allHands) {
        if (compareHands(hand, best) === 0) tiedCount++;
      }
      if (tiedCount > 1) outcomes.tie++;
      else outcomes.win++;
    }
  }

  return { categoryCounts, outcomes, trialsCompleted: trialCount };
}
