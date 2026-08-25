import type { Card } from '@poker-apprentice/types';
import { categoryCountFor } from '../worker/protocol';
import { evaluateHand, compareHands } from './evaluator';
import { evaluateHandTwoDeck, compareHandsTwoDeck, type HandTwoDeck } from './evaluatorTwoDeck';
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
  /**
   * Length `categoryCountFor(deckCount)` — 10 at one deck (indexed by `HandStrength`),
   * 11 at two decks, where index 10 tallies Five of a Kind (D-05).
   */
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
}

/** Evaluator/comparator function shapes for the per-batch hoisted selection below. */
type EvalFn = (holeCards: [Card, Card], communityCards: Card[]) => HandTwoDeck;
type CmpFn = (a: HandTwoDeck, b: HandTwoDeck) => number;

/**
 * Runs `trialCount` real Monte Carlo trials of Hold'em vs. 3 opponents.
 *
 * Each trial draws `unknownCardsPerTrial(state)` unknown cards via `drawUnknown()` — the
 * remaining unseen board slots plus 2 cards per still-hidden opponent, which may be as few
 * as 0 (a fully-determined river-all-revealed state) or as many as 11 (Phase 1's original
 * preflop-no-reveals shape). Known board cards and known opponent holes are used verbatim.
 * Evaluates all four hands with the hoisted evaluator, buckets the hero's category into a
 * `categoryCountFor(deckCount)`-length histogram, and determines win/tie/lose via an
 * explicit max-then-count-ties reduction over the hoisted comparator — never ad-hoc
 * pairwise greater-than chains, which get multi-way tie shapes wrong.
 *
 * ONE loop serves both deck counts through a per-batch evaluator/comparator selection
 * (07-RESEARCH "wrapper-in-path, not parallel path") — never a forked two-deck sibling
 * loop, which would duplicate the win/tie semantics out from under the goldens' protection.
 * Performance envelope (07-RESEARCH, measured): the blended 2-deck cost is roughly +10%
 * per evaluation, and the streaming cadence is time-throttled — no batch-size or
 * progress-interval retuning is needed or permitted here.
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
  // Hoisted evaluator/comparator selection (D-04): (a) the selection happens ONCE per
  // batch, so the per-trial cost of the branch is zero — and at one deck the selected
  // functions ARE the identical v1 functions with the identical array length, making
  // external behavior byte-identical and golden-pinned; (b) the 1-deck path therefore
  // never executes the duplicate gate at all, which is exactly what D-04 requires;
  // (c) the `compareHands as CmpFn` cast is sound because at deckCount 1 the wrapper is
  // never invoked, so no value reaching compareHands can carry strength 10 or a
  // `tiebreak` — every hand on this path is stock-shaped.
  const deckCount = state.deckCount ?? 1;
  const evalFn: EvalFn = deckCount === 2 ? evaluateHandTwoDeck : evaluateHand;
  const cmpFn: CmpFn = deckCount === 2 ? compareHandsTwoDeck : (compareHands as CmpFn);
  const categoryCounts = new Array(categoryCountFor(deckCount)).fill(0);
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

    const hero = evalFn(state.heroHole, board);
    const villains = oppHoles.map((hole) => evalFn(hole, board));

    categoryCounts[hero.strength]++;

    const allHands: HandTwoDeck[] = [hero, ...villains];
    let best = allHands[0];
    for (let i = 1; i < allHands.length; i++) {
      if (cmpFn(allHands[i], best) > 0) {
        best = allHands[i];
      }
    }

    if (cmpFn(hero, best) !== 0) {
      outcomes.lose++;
    } else {
      let tiedCount = 0;
      for (const hand of allHands) {
        if (cmpFn(hand, best) === 0) tiedCount++;
      }
      if (tiedCount > 1) outcomes.tie++;
      else outcomes.win++;
    }
  }

  return { categoryCounts, outcomes, trialsCompleted: trialCount };
}
