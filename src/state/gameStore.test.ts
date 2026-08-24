import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { FULL_DECK } from '../engine/cards';

describe('gameStore — predetermined runout and street pointer', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
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
});
