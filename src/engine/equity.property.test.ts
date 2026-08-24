// @vitest-environment node
import { test, fc } from '@fast-check/vitest';
import { expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { runTrials, unknownCardsPerTrial, type ConditionedState } from './equity';
import { FULL_DECK, deckWithout } from './cards';
import { createRng, createDrawer } from './rng';
import { deriveConditionedState, type PredeterminedRunout } from './conditioning';
import { STREET_ORDER } from './streets';

// ENG-04: invariants that must hold for every input, not just the hand-picked cases in
// equity.test.ts. A sign-inverted comparator or a biased sampler can pass every
// deterministic test while still producing wrong odds; these properties close that gap.

function preflopState(heroHole: [Card, Card]): ConditionedState {
  return {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
}

test.prop([fc.integer({ min: 1, max: 3000 }), fc.integer()])(
  '(a) categoryCounts and outcomes always sum exactly to the trial count, for any trial count and seed',
  (trialCount, seed) => {
    const rng = createRng(seed);
    const state = preflopState([FULL_DECK[0], FULL_DECK[1]]);
    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));

    const result = runTrials(state, trialCount, drawUnknown);

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
    const state = preflopState(heroHole);
    expect(state.remainingDeck).toHaveLength(FULL_DECK.length - 2);

    const rng = createRng(2026);
    const baseDraw = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    // 100 trials is enough — this property is about sampling structure, not statistics.
    runTrials(state, 100, drawUnknown);

    expect(captured).toHaveLength(100);
    for (const sample of captured) {
      expect(sample).toHaveLength(11);
      expect(new Set(sample).size).toBe(11);
      expect(sample).not.toContain(heroHole[0]);
      expect(sample).not.toContain(heroHole[1]);
    }
  },
);

// Fixed fixture for the cross-partition reconstruction property below — 13 disjoint slices
// of FULL_DECK (2 hero + 5 board + 3x2 opponents), same shape as conditioning.test.ts.
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
  '(c) every trial produces exactly 13 unique cards regardless of known/unknown split',
  (streetIndex, revealedMask) => {
    const street = STREET_ORDER[streetIndex];
    const state = deriveConditionedState(runout, street, revealedMask);
    const rng = createRng(20260824);
    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));

    // Reconstruct one trial's full 13-card table exactly as runTrials does internally, using
    // the same drawUnknown, to assert the union is 13 distinct cards.
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
    expect(new Set(allCards).size).toBe(13);
  },
);
