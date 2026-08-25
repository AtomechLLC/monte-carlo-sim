// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { Card } from '@poker-apprentice/types';
import { runTrials, unknownCardsPerTrial, type ConditionedState } from './equity';
import { FULL_DECK, deckWithout } from './cards';
import { cardCounts } from './shoe';
import { createRng, createDrawer } from './rng';
import { deriveConditionedState, type PredeterminedRunout } from './conditioning';
import { STREET_ORDER } from './streets';
import { CATEGORY_COUNT, FIVE_OF_A_KIND_INDEX, categoryCountFor } from '../worker/protocol';

// ADDITIVE 2-deck sibling of `equity.property.test.ts` (D-04/D-05, HE2-02). That file's
// "(c) every trial produces exactly 13 unique cards" property title and its
// `new Set(allCards).size).toBe(13)` assertion are byte-pinned by `shoePath.guard.test.ts`
// and must NEVER be generalised — at deckCount=2 a trial legitimately holds two physical
// copies of a value, so the dedup-then-measure invariant is FALSE for correct output. The
// sanctioned move (the `multisetSampling.property.test.ts` precedent) is this new sibling
// file: count-shaped assertions via `cardCounts`, never Set size.

const SEED = 20260824;

/**
 * A 2-deck runout whose hero holds BOTH physical copies of one value — legal only at
 * deckCount=2 (the shoe carries two `Ah`). Board and opponent holes are 11 distinct other
 * values, so the hero hole is the window's guaranteed duplicate: every hero evaluation
 * window contains the identical pair, which forces the duplicate gate on every trial.
 */
const dupHeroRunout: PredeterminedRunout = {
  heroHole: ['Ah', 'Ah'],
  board: ['2c', '5d', '7h', '9s', 'Jc'],
  opponentHoles: [
    ['Kd', 'Qs'],
    ['3h', '4c'],
    ['6s', '8d'],
  ],
};

/** 1-deck preflop state in the exact shape `equity.property.test.ts` uses. */
function oneDeckPreflopState(withExplicitDeckCount: boolean): ConditionedState {
  const heroHole: [Card, Card] = [FULL_DECK[0], FULL_DECK[1]];
  const state: ConditionedState = {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
  if (withExplicitDeckCount) {
    state.deckCount = 1;
  }
  return state;
}

function runSeeded(state: ConditionedState, trialCount: number) {
  const rng = createRng(SEED);
  const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
  return runTrials(state, trialCount, drawUnknown);
}

describe('derived category-index constants (D-05, HE2-02)', () => {
  it('categoryCountFor returns 10 at one deck and 11 at two, derived from CATEGORY_COUNT', () => {
    expect(categoryCountFor(1)).toBe(10);
    expect(categoryCountFor(1)).toBe(CATEGORY_COUNT);
    expect(categoryCountFor(2)).toBe(11);
    expect(categoryCountFor(2)).toBe(CATEGORY_COUNT + 1);
  });

  it('FIVE_OF_A_KIND_INDEX is 10 and CATEGORY_COUNT itself stays exactly 10', () => {
    expect(FIVE_OF_A_KIND_INDEX).toBe(10);
    expect(FIVE_OF_A_KIND_INDEX).toBe(CATEGORY_COUNT);
    expect(CATEGORY_COUNT).toBe(10);
  });
});

describe('runTrials at deckCount absent / 1 — the 10-length histogram is unchanged (D-04, D-11)', () => {
  it('deckCount ABSENT: categoryCounts has length 10 and sums to trialsCompleted', () => {
    const result = runSeeded(oneDeckPreflopState(false), 2000);
    expect(result.categoryCounts).toHaveLength(10);
    expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(2000);
  });

  it('explicit deckCount 1: same 10-length shape — no index above 9 is ever written', () => {
    const result = runSeeded(oneDeckPreflopState(true), 2000);
    // An out-of-range write (index 10+) would silently EXTEND a JS array — length 10
    // after the run proves the 1-deck path never touched the extended index.
    expect(result.categoryCounts).toHaveLength(10);
    expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(2000);
  });
});

describe('runTrials at deckCount 2 — the 11-length histogram with a live index 10 (D-05, HE2-02)', () => {
  it(
    'hero holding both copies of one value: 11-length histogram, reconciling sums, and at least one Five of a Kind tally',
    () => {
      // Conditioned shape comes from the sanctioned reader, never a hand-built literal.
      const state = deriveConditionedState(dupHeroRunout, 'preflop', 0, 2);
      expect(state.remainingDeck).toHaveLength(102);

      // Conditional Five of a Kind rate with hero [Ah, Ah] is 1.1204e-3 (07-RESEARCH
      // Anchor A) — E[count] ~ 11.2 at 10k trials, so this fixed-seed run recording at
      // least one index-10 tally is a deterministic, comfortably-satisfied assertion.
      const result = runSeeded(state, 10_000);

      expect(result.categoryCounts).toHaveLength(11);
      expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(10_000);
      expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(10_000);
      expect(result.categoryCounts[FIVE_OF_A_KIND_INDEX]).toBeGreaterThanOrEqual(1);
      // Every tally index is in range: length stays 11 (no out-of-range array extension)
      // and every entry is a non-negative integer count.
      for (const count of result.categoryCounts) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(0);
      }
    },
    // 10k trials x 4 evaluations: fast alone but budgeted for full-suite CPU contention
    // (55+ parallel test files), the equity.property.test.ts timeout precedent.
    30_000,
  );

  it(
    'a duplicate-containing window never reaches the raw stock evaluator: a dup-pair hero is never High Card',
    () => {
      // The hero window ALWAYS contains the identical [Ah, Ah] pair, so its true category
      // is at least One Pair in every trial. The stock evaluator fed this window raw would
      // either throw (rank-count>=5 aces) or silently return High Card (07-RESEARCH D-16
      // characterization) — a single High Card tally here means the gate was bypassed.
      const state = deriveConditionedState(dupHeroRunout, 'preflop', 0, 2);
      const result = runSeeded(state, 2000);

      expect(result.categoryCounts[0]).toBe(0);
      expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(2000);
    },
    30_000,
  );
});

// The count-aware sampling sibling of the pinned 1-deck "(c) 13 unique cards" property:
// at deckCount=2 each trial's full 13-card table holds no VALUE more often than the shoe
// physically carries copies of it (2) — asserted with `cardCounts`, never Set size.
test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
  'at deckCount 2, every trial holds 13 physical cards with per-value count at most the shoe multiplicity',
  (streetIndex, revealedMask) => {
    const street = STREET_ORDER[streetIndex];
    const state = deriveConditionedState(dupHeroRunout, street, revealedMask, 2);
    const rng = createRng(SEED);
    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));

    // Reconstruct trials' full 13-card tables exactly as runTrials does internally.
    for (let t = 0; t < 50; t++) {
      const drawn = drawUnknown();
      const unknownBoardCount = 5 - state.knownBoard.length;
      const board = [...state.knownBoard, ...drawn.slice(0, unknownBoardCount)];
      let cursor = unknownBoardCount;
      const oppHoles: [Card, Card][] = state.knownOpponentHoles.map((known) => {
        if (known !== null) return known as [Card, Card];
        const pair: [Card, Card] = [drawn[cursor], drawn[cursor + 1]];
        cursor += 2;
        return pair;
      });

      const allCards: Card[] = [...state.heroHole, ...board, ...oppHoles.flat()];
      expect(allCards).toHaveLength(13);
      const counts = cardCounts(allCards);
      for (const [, count] of counts) {
        expect(count).toBeLessThanOrEqual(2);
      }
      // The hero's duplicated value is fully spent by the hole cards: both shoe copies of
      // Ah sit in the hero hole, so the drawn sample may never contain a third.
      expect(counts.get('Ah')).toBe(2);
    }
  },
  // 50 reconstructed trials x 100 fast-check runs: fast alone, budgeted for full-suite
  // CPU contention (the equity.property.test.ts 30s precedent).
  30_000,
);
