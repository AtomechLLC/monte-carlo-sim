import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { useOddsStore } from './oddsStore';
import { usePickerStore } from './pickerStore';
import { FULL_DECK } from '../engine/cards';
import type { ProgressSnapshot } from '../worker/protocol';

const EMPTY_PICKS = {
  'hero-0': null,
  'hero-1': null,
  'flop-0': null,
  'flop-1': null,
  'flop-2': null,
  turn: null,
  river: null,
} as const;

describe('gameStore — predetermined runout and street pointer', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
  });

  it('starts with no runout, preflop street, no reveals, and dealNonce 0', () => {
    const state = useGameStore.getState();
    expect(state.runout).toBeNull();
    expect(state.street).toBe('preflop');
    expect(state.revealedMask).toBe(0);
    expect(state.dealNonce).toBe(0);
  });

  it('deal() produces a runout whose 13 cards are all distinct and all members of FULL_DECK', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    expect(runout).not.toBeNull();

    const allCards = [
      ...runout!.heroHole,
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];

    expect(allCards).toHaveLength(13);
    expect(new Set(allCards).size).toBe(13);
    for (const card of allCards) {
      expect(FULL_DECK).toContain(card);
    }
  });

  it('deal() resets street to preflop and revealedMask to 0, and increments dealNonce by exactly 1', () => {
    useGameStore.setState({ street: 'river', revealedMask: 0b101 });
    useGameStore.getState().deal();

    const state = useGameStore.getState();
    expect(state.street).toBe('preflop');
    expect(state.revealedMask).toBe(0);
    expect(state.dealNonce).toBe(1);
  });

  it('advanceStreet walks preflop -> flop -> turn -> river and is a no-op at river', () => {
    useGameStore.getState().deal();

    expect(useGameStore.getState().street).toBe('preflop');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('flop');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('turn');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
  });

  it('rewindStreet walks river -> turn -> flop -> preflop and is a no-op at preflop', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'river' });

    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('turn');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('flop');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
  });

  it('advancing to river, rewinding to preflop and advancing back to river leaves runout object-identical', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    expect(useGameStore.getState().runout).toBe(runout);

    useGameStore.getState().rewindStreet();
    useGameStore.getState().rewindStreet();
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
    expect(useGameStore.getState().runout).toBe(runout);

    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    expect(useGameStore.getState().runout).toBe(runout);
  });

  it('calling deal() twice produces two different runouts and dealNonce of 2', () => {
    useGameStore.getState().deal();
    const firstRunout = useGameStore.getState().runout;

    useGameStore.getState().deal();
    const secondRunout = useGameStore.getState().runout;

    expect(useGameStore.getState().dealNonce).toBe(2);
    expect(secondRunout).not.toBe(firstRunout);

    // Probabilistic — assert the two 13-card sets are not identical across a handful of deals.
    let sawDifference = false;
    let previous = secondRunout;
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().deal();
      const current = useGameStore.getState().runout;
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        sawDifference = true;
      }
      previous = current;
    }
    expect(sawDifference).toBe(true);
  });

  it('reveal(1) sets bit 1 of revealedMask; calling reveal(1) again leaves the mask unchanged', () => {
    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).toBe(0b010);

    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).toBe(0b010);
  });

  it('reveal(0) followed by reveal(2) yields a mask of 5; no action clears an individual bit', () => {
    useGameStore.getState().reveal(0);
    useGameStore.getState().reveal(2);
    expect(useGameStore.getState().revealedMask).toBe(5);
  });

  it('deal() resets revealedMask to 0', () => {
    useGameStore.getState().reveal(0);
    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).not.toBe(0);

    useGameStore.getState().deal();

    expect(useGameStore.getState().revealedMask).toBe(0);
  });

  it('deal() clears the settled odds cache even when entries existed for the previous hand', () => {
    useOddsStore.getState().clearCache();
    const snapshot: ProgressSnapshot = {
      requestId: 1,
      categoryCounts: new Array(10).fill(0),
      outcomes: { win: 60, tie: 10, lose: 30 },
      trialsCompleted: 100,
      done: true,
    };
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);
    expect(useOddsStore.getState().settledCache.size).toBe(1);

    useGameStore.getState().deal();

    expect(useOddsStore.getState().settledCache.size).toBe(0);
  });
});

describe('gameStore — merge-on-deal (picker draft honoured, unset slots randomly filled)', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
  });

  it('with no picks set, deal() still produces 13 distinct random cards (unchanged 02-02 behavior)', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    const allCards = [
      ...runout!.heroHole,
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];
    expect(new Set(allCards).size).toBe(13);
  });

  it('honours hero picks: heroHole deep-equals the picks and neither card appears elsewhere', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.heroHole).toEqual(['As', 'Ah']);
    const rest = [
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];
    expect(rest).not.toContain('As');
    expect(rest).not.toContain('Ah');
  });

  it('honours flop picks: board[0..2] equal the picks in order, board[3..4] random', () => {
    usePickerStore.getState().setPick('flop-0', '2c');
    usePickerStore.getState().setPick('flop-1', '3c');
    usePickerStore.getState().setPick('flop-2', '4c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.board.slice(0, 3)).toEqual(['2c', '3c', '4c']);
    expect(runout!.board[3]).not.toBe('2c');
    expect(runout!.board[4]).not.toBe('2c');
  });

  it('honours turn/river picks with the flop unset: board[3..4] equal the picks, board[0..2] random', () => {
    usePickerStore.getState().setPick('turn', '5c');
    usePickerStore.getState().setPick('river', '6c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.board[3]).toBe('5c');
    expect(runout!.board[4]).toBe('6c');
    expect(runout!.board.slice(0, 3)).not.toContain('5c');
    expect(runout!.board.slice(0, 3)).not.toContain('6c');
  });

  it('opponent hole cards are always random and never taken from the picks (D-07)', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');
    usePickerStore.getState().setPick('flop-0', '2c');
    usePickerStore.getState().setPick('flop-1', '3c');
    usePickerStore.getState().setPick('flop-2', '4c');
    usePickerStore.getState().setPick('turn', '5c');
    usePickerStore.getState().setPick('river', '6c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    const picked = ['As', 'Ah', '2c', '3c', '4c', '5c', '6c'];
    for (const hole of runout!.opponentHoles) {
      expect(picked).not.toContain(hole[0]);
      expect(picked).not.toContain(hole[1]);
    }
  });

  it('across 200 consecutive deals with a partial draft, every runout has 13 distinct cards (Pitfall 5)', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('turn', '5c');

    for (let i = 0; i < 200; i++) {
      useGameStore.getState().deal();
      const { runout } = useGameStore.getState();
      const allCards = [
        ...runout!.heroHole,
        ...runout!.board,
        ...runout!.opponentHoles[0],
        ...runout!.opponentHoles[1],
        ...runout!.opponentHoles[2],
      ];
      expect(new Set(allCards).size).toBe(13);
    }
  });

  it('picks persist after deal() — the draft is unchanged and a second deal() honours the same picks again', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');

    useGameStore.getState().deal();
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
    expect(usePickerStore.getState().picks['hero-1']).toBe('Ah');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    expect(runout!.heroHole).toEqual(['As', 'Ah']);
  });
});
