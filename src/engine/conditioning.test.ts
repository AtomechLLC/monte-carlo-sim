// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { Card } from '@poker-apprentice/types';
import { deriveConditionedState, isOpponentRevealed, type PredeterminedRunout } from './conditioning';
import { STREET_ORDER, STREET_BOARD_COUNT, STREET_LABEL, nextStreet, previousStreet } from './streets';
import { FULL_DECK } from './cards';

// Fixed fixture built from 13 disjoint slices of FULL_DECK (2 hero + 5 board + 3x2 opponents).
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

describe('streets — Street model', () => {
  it('STREET_BOARD_COUNT maps preflop->0, flop->3, turn->4, river->5', () => {
    expect(STREET_BOARD_COUNT.preflop).toBe(0);
    expect(STREET_BOARD_COUNT.flop).toBe(3);
    expect(STREET_BOARD_COUNT.turn).toBe(4);
    expect(STREET_BOARD_COUNT.river).toBe(5);
  });

  it('STREET_LABEL.preflop is exactly "Pre-Flop" (UI-SPEC copy contract)', () => {
    expect(STREET_LABEL.preflop).toBe('Pre-Flop');
    expect(STREET_LABEL.flop).toBe('Flop');
    expect(STREET_LABEL.turn).toBe('Turn');
    expect(STREET_LABEL.river).toBe('River');
  });

  it('nextStreet clamps at river; previousStreet clamps at preflop; otherwise steps by one', () => {
    expect(nextStreet('river')).toBe('river');
    expect(previousStreet('preflop')).toBe('preflop');
    expect(nextStreet('preflop')).toBe('flop');
    expect(nextStreet('flop')).toBe('turn');
    expect(nextStreet('turn')).toBe('river');
    expect(previousStreet('river')).toBe('turn');
    expect(previousStreet('turn')).toBe('flop');
    expect(previousStreet('flop')).toBe('preflop');
  });
});

describe('isOpponentRevealed — bitmask reveal check', () => {
  it('reports only the bit that is set', () => {
    expect(isOpponentRevealed(0b010, 1)).toBe(true);
    expect(isOpponentRevealed(0b010, 0)).toBe(false);
    expect(isOpponentRevealed(0b010, 2)).toBe(false);
  });
});

describe('deriveConditionedState — the D-02 visibility-derived conditioning function', () => {
  it('preflop, no reveals: empty board, all opponents hidden, 50-card deck STILL containing all hidden cards', () => {
    const result = deriveConditionedState(runout, 'preflop', 0);

    expect(result.knownBoard).toEqual([]);
    expect(result.knownOpponentHoles).toEqual([null, null, null]);
    expect(result.remainingDeck).toHaveLength(50);

    // D-02 leak guard: hidden board and hidden opponent cards must remain in the unknown pool.
    for (const boardCard of runout.board) {
      expect(result.remainingDeck).toContain(boardCard);
    }
    for (const hole of runout.opponentHoles) {
      expect(result.remainingDeck).toContain(hole[0]);
      expect(result.remainingDeck).toContain(hole[1]);
    }
  });

  it('flop, no reveals: exactly the first 3 board cards known, 47-card deck', () => {
    const result = deriveConditionedState(runout, 'flop', 0);

    expect(result.knownBoard).toEqual([runout.board[0], runout.board[1], runout.board[2]]);
    expect(result.remainingDeck).toHaveLength(47);
  });

  it('turn, no reveals: 4 known board cards, 46-card deck', () => {
    const result = deriveConditionedState(runout, 'turn', 0);

    expect(result.knownBoard).toHaveLength(4);
    expect(result.remainingDeck).toHaveLength(46);
  });

  it('river, no reveals: 5 known board cards, 45-card deck', () => {
    const result = deriveConditionedState(runout, 'river', 0);

    expect(result.knownBoard).toHaveLength(5);
    expect(result.remainingDeck).toHaveLength(45);
  });

  it('river with opponents 0 and 2 revealed: knownOpponentHoles reflects the mask, 41-card deck excludes only revealed holes', () => {
    const result = deriveConditionedState(runout, 'river', 0b101);

    expect(result.knownOpponentHoles).toEqual([runout.opponentHoles[0], null, runout.opponentHoles[2]]);
    expect(result.remainingDeck).toHaveLength(41);

    expect(result.remainingDeck).not.toContain(runout.opponentHoles[0][0]);
    expect(result.remainingDeck).not.toContain(runout.opponentHoles[0][1]);
    expect(result.remainingDeck).not.toContain(runout.opponentHoles[2][0]);
    expect(result.remainingDeck).not.toContain(runout.opponentHoles[2][1]);

    // Opponent 1 is NOT revealed — both of their cards must remain in the unknown pool.
    expect(result.remainingDeck).toContain(runout.opponentHoles[1][0]);
    expect(result.remainingDeck).toContain(runout.opponentHoles[1][1]);
  });

  test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
    'every (street, revealedMask) combination reconstitutes exactly the 52-card FULL_DECK with no duplicates',
    (streetIndex, revealedMask) => {
      const street = STREET_ORDER[streetIndex];
      const result = deriveConditionedState(runout, street, revealedMask);

      const revealedOpponentCards = result.knownOpponentHoles.flatMap((hole) =>
        hole ? [hole[0], hole[1]] : [],
      );
      const allCards: Card[] = [
        ...result.heroHole,
        ...result.knownBoard,
        ...revealedOpponentCards,
        ...result.remainingDeck,
      ];

      expect(allCards).toHaveLength(FULL_DECK.length);
      expect(new Set(allCards).size).toBe(FULL_DECK.length);
    },
  );

  test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
    'remainingDeck.length always equals 52 - 2 - knownBoard.length - 2 * revealedCount',
    (streetIndex, revealedMask) => {
      const street = STREET_ORDER[streetIndex];
      const result = deriveConditionedState(runout, street, revealedMask);
      const revealedCount = [0, 1, 2].filter((i) => isOpponentRevealed(revealedMask, i)).length;

      expect(result.remainingDeck.length).toBe(52 - 2 - result.knownBoard.length - 2 * revealedCount);
    },
  );
});
