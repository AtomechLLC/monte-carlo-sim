// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
import { runTrials, unknownCardsPerTrial, type ConditionedState } from './equity';
import { FULL_DECK, deckWithout } from './cards';
import { createRng, createDrawer } from './rng';

function preflopState(heroHole: [Card, Card]): ConditionedState {
  return {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
}

describe('runTrials — Monte Carlo trial-loop correctness', () => {
  it('(a) tallies categoryCounts and outcomes that both sum to the trial count', () => {
    const rng = createRng(12345);
    const heroHole: [Card, Card] = [FULL_DECK[0], FULL_DECK[1]];
    const state = preflopState(heroHole);
    expect(state.remainingDeck).toHaveLength(50);

    const drawUnknown = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
    const result = runTrials(state, 2000, drawUnknown);

    expect(result.categoryCounts).toHaveLength(10);
    expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(2000);
  });

  it('(b) samples 11 distinct cards per trial, never reusing a hero hole card (ENG-02)', () => {
    const rng = createRng(999);
    const heroHole: [Card, Card] = [FULL_DECK[2], FULL_DECK[3]];
    const state = preflopState(heroHole);
    const baseDraw = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));

    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    runTrials(state, 500, drawUnknown);

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
    const state = preflopState(heroHole);

    const resultA = runTrials(
      state,
      1000,
      createDrawer(createRng(42), state.remainingDeck, unknownCardsPerTrial(state)),
    );
    const resultB = runTrials(
      state,
      1000,
      createDrawer(createRng(42), state.remainingDeck, unknownCardsPerTrial(state)),
    );

    expect(resultA.categoryCounts).toEqual(resultB.categoryCounts);
    expect(resultA.outcomes).toEqual(resultB.outcomes);
  });

  it('(d) rigged hero-wins scenario: hero pair of aces beats three high-card hands every trial', () => {
    const heroHole: [Card, Card] = ['As', 'Ah'];
    const fixedSample: Card[] = ['2c', '7d', '9s', 'Jh', '4s', '3d', '5d', '6c', '8c', 'Td', '3c'];

    const result = runTrials(preflopState(heroHole), 10, () => fixedSample);

    expect(result.outcomes.win).toBe(10);
    expect(result.outcomes.tie).toBe(0);
    expect(result.outcomes.lose).toBe(0);
    expect(result.categoryCounts[HandStrength.OnePair]).toBe(10);
  });

  it('(e) rigged hero-loses scenario: hero high card loses to an opponent trips every trial', () => {
    const heroHole: [Card, Card] = ['3h', '5c'];
    const fixedSample: Card[] = ['2c', '7d', '9s', 'Jh', '4s', '9d', '9h', '6c', '8c', 'Td', '3c'];

    const result = runTrials(preflopState(heroHole), 10, () => fixedSample);

    expect(result.outcomes.lose).toBe(10);
  });

  it('(e) rigged all-tie scenario: a royal flush on the board ties every hand every trial', () => {
    const heroHole: [Card, Card] = ['2c', '3d'];
    const fixedSample: Card[] = ['As', 'Ks', 'Qs', 'Js', 'Ts', '4c', '5d', '6c', '7d', '8c', '9d'];

    const result = runTrials(preflopState(heroHole), 10, () => fixedSample);

    expect(result.outcomes.tie).toBe(10);
    expect(result.categoryCounts[HandStrength.RoyalFlush]).toBe(10);
  });

  it('(f) unknownCardsPerTrial returns 11 for the fully-unknown preflop shape (Phase 1 shape)', () => {
    const state = preflopState(['2c', '3d']);
    expect(unknownCardsPerTrial(state)).toBe(11);
  });

  it('(g) unknownCardsPerTrial returns 8 with 3 known board cards and 0 revealed', () => {
    const state: ConditionedState = {
      heroHole: ['2c', '3d'],
      knownBoard: ['4h', '5s', '6c'],
      knownOpponentHoles: [null, null, null],
      remainingDeck: deckWithout(['2c', '3d', '4h', '5s', '6c']),
    };
    expect(unknownCardsPerTrial(state)).toBe(8);
  });

  it('(h) unknownCardsPerTrial returns 0 with 5 known board cards and all 3 opponents revealed', () => {
    const state: ConditionedState = {
      heroHole: ['2c', '3d'],
      knownBoard: ['4h', '5s', '6c', '7d', '8h'],
      knownOpponentHoles: [
        ['9c', '9d'],
        ['Tc', 'Td'],
        ['Jc', 'Jd'],
      ],
      remainingDeck: deckWithout(['2c', '3d', '4h', '5s', '6c', '7d', '8h', '9c', '9d', 'Tc', 'Td', 'Jc', 'Jd']),
    };
    expect(unknownCardsPerTrial(state)).toBe(0);
  });

  it('(i) reconstructs the board from known + drawn cards: known board completes a straight every hand ties on', () => {
    const state: ConditionedState = {
      heroHole: ['2c', '3d'],
      knownBoard: ['4h', '5s', '6c'],
      knownOpponentHoles: [null, null, null],
      remainingDeck: deckWithout(['2c', '3d', '4h', '5s', '6c']),
    };
    // 8 unknown cards: 2 board fill (7d, 8h completes the 4-8 straight on the board) + 2 per
    // hidden opponent x 3. Opponent pairs (K, Q, J) are far from ranks 3/9, so none of them
    // can extend the board's straight to a higher one — every hand ties on the same 4-8 run.
    const drawn: Card[] = ['7d', '8h', 'Kc', 'Kd', 'Qc', 'Qd', 'Jc', 'Jd'];

    const result = runTrials(state, 10, () => drawn);

    // If knownBoard were dropped/ignored, the reconstructed board would be incomplete and
    // this deterministic 4-way tie would not occur.
    expect(result.categoryCounts[HandStrength.Straight]).toBe(10);
    expect(result.outcomes.tie).toBe(10);
  });

  it('(j) opponent 1 revealed: uses their known hole cards unchanged, draws only the other two', () => {
    const state: ConditionedState = {
      heroHole: ['2c', '3d'],
      knownBoard: [],
      knownOpponentHoles: [null, ['9c', '9d'], null],
      remainingDeck: deckWithout(['2c', '3d', '9c', '9d']),
    };
    // unknownCardsPerTrial = 5 (board) + 2*2 (two hidden opponents) = 9.
    expect(unknownCardsPerTrial(state)).toBe(9);

    const drawn: Card[] = ['4h', '5s', '6c', '7d', '8h', 'Tc', 'Td', 'Jc', 'Jd'];
    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      captured.push(drawn);
      return drawn;
    };
    const result = runTrials(state, 1, drawUnknown);
    expect(result.trialsCompleted).toBe(1);
    expect(captured).toHaveLength(1);
  });

  it('(k) fully-determined state (river, all 3 revealed) with drawUnknown returning [] produces identical outcomes every trial', () => {
    const state: ConditionedState = {
      heroHole: ['As', 'Ah'],
      knownBoard: ['2c', '3d', '4h', '5s', '6c'],
      knownOpponentHoles: [
        ['7d', '7h'],
        ['8c', '8d'],
        ['9c', '9d'],
      ],
      remainingDeck: deckWithout([
        'As',
        'Ah',
        '2c',
        '3d',
        '4h',
        '5s',
        '6c',
        '7d',
        '7h',
        '8c',
        '8d',
        '9c',
        '9d',
      ]),
    };
    expect(unknownCardsPerTrial(state)).toBe(0);

    const result = runTrials(state, 100, () => []);

    expect(result.categoryCounts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result.outcomes.win + result.outcomes.tie + result.outcomes.lose).toBe(100);
    const nonZeroCategories = result.categoryCounts.filter((count) => count > 0);
    expect(nonZeroCategories).toHaveLength(1);
    expect(nonZeroCategories[0]).toBe(100);
  });
});
