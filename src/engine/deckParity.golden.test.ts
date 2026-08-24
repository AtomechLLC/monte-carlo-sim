// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveConditionedState, type PredeterminedRunout } from './conditioning';
import { unknownCardsPerTrial, runTrials, type ConditionedState } from './equity';
import { createRng, createDrawer } from './rng';
import { FULL_DECK } from './cards';

/**
 * GOLDEN (D-08): these are literal values transcribed from a real run of the pre-refactor,
 * currently-shipped `deckCount=1` engine code (deriveConditionedState + runTrials, both
 * operating over value-based `Set`/`FULL_DECK.filter` exclusion). They exist as a drift
 * detector for the Phase 4 multiset/runner refactor that follows this plan.
 *
 * A failure here means the refactor changed observable behaviour — remainingDeck ordering,
 * sampling order, or pool contents. The correct response to a red test in this file is to fix
 * the refactor so it reproduces these numbers again, NEVER to re-record the expected literals.
 * Re-recording would silently erase the only proof that Roadmap criterion 1 ("byte-identical to
 * shipped v1.0 at deckCount=1") holds.
 */

// Fixed fixture reused verbatim from conditioning.test.ts lines 9-18: 13 disjoint slices of
// FULL_DECK (2 hero + 5 board + 3x2 opponents).
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

describe('D-08 golden parity — engine layer (deriveConditionedState + runTrials)', () => {
  it('GOLDEN: preflop remainingDeck ordering (50 cards) matches the pre-refactor literal', () => {
    const result = deriveConditionedState(runout, 'preflop', 0);
    expect(result.remainingDeck.join(' ')).toBe(
      '2h 2s 3c 3d 3h 3s 4c 4d 4h 4s 5c 5d 5h 5s 6c 6d 6h 6s 7c 7d 7h 7s 8c 8d 8h 8s 9c 9d 9h 9s Tc Td Th Ts Jc Jd Jh Js Qc Qd Qh Qs Kc Kd Kh Ks Ac Ad Ah As',
    );
  });

  it('GOLDEN: flop remainingDeck ordering (47 cards) matches the pre-refactor literal', () => {
    const result = deriveConditionedState(runout, 'flop', 0);
    expect(result.remainingDeck.join(' ')).toBe(
      '3d 3h 3s 4c 4d 4h 4s 5c 5d 5h 5s 6c 6d 6h 6s 7c 7d 7h 7s 8c 8d 8h 8s 9c 9d 9h 9s Tc Td Th Ts Jc Jd Jh Js Qc Qd Qh Qs Kc Kd Kh Ks Ac Ad Ah As',
    );
  });

  it('GOLDEN: river-with-two-opponents-revealed remainingDeck ordering (41 cards) matches the pre-refactor literal', () => {
    const result = deriveConditionedState(runout, 'river', 0b101);
    expect(result.remainingDeck.join(' ')).toBe(
      '4d 4h 5d 5h 5s 6c 6d 6h 6s 7c 7d 7h 7s 8c 8d 8h 8s 9c 9d 9h 9s Tc Td Th Ts Jc Jd Jh Js Qc Qd Qh Qs Kc Kd Kh Ks Ac Ad Ah As',
    );
  });

  it('GOLDEN: seeded 5000-trial preflop tallies match the pre-refactor literals', () => {
    const state: ConditionedState = deriveConditionedState(runout, 'preflop', 0);
    const rng = createRng(20260824);
    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
    const result = runTrials(state, 5000, drawUnknown);

    expect(result.trialsCompleted).toBe(5000);
    expect(result.categoryCounts).toEqual([0, 1861, 1960, 550, 60, 84, 440, 45, 0, 0]);
    expect(result.outcomes).toEqual({ win: 1079, tie: 39, lose: 3882 });
  });

  it('GOLDEN: seeded 5000-trial flop tallies match the pre-refactor literals', () => {
    const state: ConditionedState = deriveConditionedState(runout, 'flop', 0);
    const rng = createRng(20260824);
    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
    const result = runTrials(state, 5000, drawUnknown);

    expect(result.trialsCompleted).toBe(5000);
    expect(result.categoryCounts).toEqual([0, 0, 0, 0, 0, 0, 0, 5000, 0, 0]);
    expect(result.outcomes).toEqual({ win: 4996, tie: 0, lose: 4 });
  });
});
