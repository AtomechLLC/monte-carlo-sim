import type { Card } from '@poker-apprentice/types';
import { CATEGORY_COUNT } from '../worker/protocol';
import { evaluateHand, compareHands, type Hand } from './evaluator';
import { BOARD_SIZE, HOLE_CARDS_PER_PLAYER } from './cards';
import type { DeckCount } from './shoe';

/**
 * The known/unknown card partition a trial batch is conditioned on. `knownBoard` and
 * `knownOpponentHoles` are ALWAYS derived from the user's current visibility state
 * (`deriveConditionedState` in `conditioning.ts`) — never from a stored predetermined
 * runout directly (D-02).
 */
export interface ConditionedState {
  heroHole: [Card, Card];
  /** 0-5 cards, in street order (flop 3, then turn, then river). */
  knownBoard: Card[];
  /** Length `OPPONENT_COUNT` (3). `null` = still hidden. */
  knownOpponentHoles: (readonly [Card, Card] | null)[];
  /** Every card NOT in `heroHole`, `knownBoard`, or any non-null `knownOpponentHoles` entry. */
  remainingDeck: Card[];
  /** Physical decks the shoe was built from (D-04). ABSENT MEANS 1. */
  deckCount?: DeckCount;
}

/**
 * Number of cards `drawUnknown()` must supply per trial for this knowledge partition:
 * the remaining unseen board slots plus 2 cards for every still-hidden opponent.
 */
export function unknownCardsPerTrial(state: ConditionedState): number {
  const hiddenOpponentCount = state.knownOpponentHoles.filter((hole) => hole === null).length;
  return BOARD_SIZE - state.knownBoard.length + HOLE_CARDS_PER_PLAYER * hiddenOpponentCount;
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
 * Each trial draws `unknownCardsPerTrial(state)` unknown cards via `drawUnknown()` — the
 * remaining unseen board slots plus 2 cards per still-hidden opponent, which may be as few
 * as 0 (a fully-determined river-all-revealed state) or as many as 11 (Phase 1's original
 * preflop-no-reveals shape). Known board cards and known opponent holes are used verbatim.
 * Evaluates all four hands with `evaluateHand`, buckets the hero's category into a
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
  drawUnknown: () => Card[],
): TrialBatchResult {
  const categoryCounts = new Array(CATEGORY_COUNT).fill(0);
  const outcomes = { win: 0, tie: 0, lose: 0 };
  const unknownBoardCount = BOARD_SIZE - state.knownBoard.length;

  for (let t = 0; t < trialCount; t++) {
    const drawn = drawUnknown();
    const board = [...state.knownBoard, ...drawn.slice(0, unknownBoardCount)];

    let cursor = unknownBoardCount;
    const oppHoles: [Card, Card][] = state.knownOpponentHoles.map((known) => {
      if (known !== null) return known as [Card, Card];
      const pair: [Card, Card] = [drawn[cursor], drawn[cursor + 1]];
      cursor += 2;
      return pair;
    });

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
