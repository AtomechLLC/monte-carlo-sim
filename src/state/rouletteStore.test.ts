import { describe, it, expect, beforeEach } from 'vitest';
import { hasPrediction, useRouletteStore } from './rouletteStore';
import { SPINS_PER_BATCH, isPocketOnWheel } from '../engine/roulette';

function resetStore() {
  useRouletteStore.setState({ wheel: 'european', color: null, number: null, spins: [], revealed: 0 });
}

describe('rouletteStore — defaults', () => {
  beforeEach(resetStore);

  it('starts on the single-zero wheel with no prediction and no spins', () => {
    const state = useRouletteStore.getState();
    expect(state.wheel).toBe('european');
    expect(state.color).toBeNull();
    expect(state.number).toBeNull();
    expect(state.spins).toEqual([]);
    expect(state.revealed).toBe(0);
    expect(hasPrediction(state)).toBe(false);
  });
});

describe('rouletteStore — predictions toggle independently', () => {
  beforeEach(resetStore);

  it('selectColor sets, replaces, and clears on a repeat', () => {
    useRouletteStore.getState().selectColor('red');
    expect(useRouletteStore.getState().color).toBe('red');
    useRouletteStore.getState().selectColor('black');
    expect(useRouletteStore.getState().color).toBe('black');
    useRouletteStore.getState().selectColor('black');
    expect(useRouletteStore.getState().color).toBeNull();
  });

  it('selectNumber sets, replaces, and clears on a repeat', () => {
    useRouletteStore.getState().selectNumber('17');
    expect(useRouletteStore.getState().number).toBe('17');
    useRouletteStore.getState().selectNumber('0');
    expect(useRouletteStore.getState().number).toBe('0');
    useRouletteStore.getState().selectNumber('0');
    expect(useRouletteStore.getState().number).toBeNull();
  });

  it('a colour and a number can both be set — they are scored as two predictions', () => {
    useRouletteStore.getState().selectColor('green');
    useRouletteStore.getState().selectNumber('17');
    const state = useRouletteStore.getState();
    expect(state.color).toBe('green');
    expect(state.number).toBe('17');
    expect(hasPrediction(state)).toBe(true);
  });

  it('selectNumber ignores a pocket the current wheel does not carry', () => {
    useRouletteStore.getState().selectNumber('00');
    expect(useRouletteStore.getState().number).toBeNull();
    useRouletteStore.getState().selectNumber('37');
    expect(useRouletteStore.getState().number).toBeNull();

    useRouletteStore.getState().setWheel('american');
    useRouletteStore.getState().selectNumber('00');
    expect(useRouletteStore.getState().number).toBe('00');
  });
});

describe('rouletteStore — spinning and revealing', () => {
  beforeEach(resetStore);

  it('spin() appends exactly SPINS_PER_BATCH pockets of the current wheel and reveals none of them', () => {
    useRouletteStore.getState().spin();
    const { spins, revealed } = useRouletteStore.getState();
    expect(spins).toHaveLength(SPINS_PER_BATCH);
    expect(revealed).toBe(0);
    for (const pocket of spins) expect(isPocketOnWheel('european', pocket)).toBe(true);
  });

  it('a second spin() accumulates — the history grows to 200', () => {
    useRouletteStore.getState().spin();
    const first = useRouletteStore.getState().spins;
    useRouletteStore.getState().spin();
    const { spins } = useRouletteStore.getState();
    expect(spins).toHaveLength(2 * SPINS_PER_BATCH);
    expect(spins.slice(0, SPINS_PER_BATCH)).toEqual(first);
  });

  it('spin() does not wait for a prediction — the spins are independent of it', () => {
    expect(hasPrediction(useRouletteStore.getState())).toBe(false);
    useRouletteStore.getState().spin();
    expect(useRouletteStore.getState().spins).toHaveLength(SPINS_PER_BATCH);
  });

  it('revealNext walks the cursor up and clamps at the history length', () => {
    useRouletteStore.getState().spin();
    useRouletteStore.getState().revealNext();
    expect(useRouletteStore.getState().revealed).toBe(1);
    useRouletteStore.getState().revealNext(10);
    expect(useRouletteStore.getState().revealed).toBe(11);
    useRouletteStore.getState().revealNext(1000);
    expect(useRouletteStore.getState().revealed).toBe(SPINS_PER_BATCH);
    useRouletteStore.getState().revealNext(-5);
    expect(useRouletteStore.getState().revealed).toBe(SPINS_PER_BATCH);
  });

  it('revealAll jumps to the end; a later batch leaves the cursor where it was', () => {
    useRouletteStore.getState().spin();
    useRouletteStore.getState().revealAll();
    expect(useRouletteStore.getState().revealed).toBe(SPINS_PER_BATCH);
    useRouletteStore.getState().spin();
    expect(useRouletteStore.getState().revealed).toBe(SPINS_PER_BATCH);
    expect(useRouletteStore.getState().spins).toHaveLength(2 * SPINS_PER_BATCH);
  });

  it('reset clears the history and cursor but keeps the wheel and both predictions', () => {
    useRouletteStore.getState().setWheel('american');
    useRouletteStore.getState().selectColor('red');
    useRouletteStore.getState().selectNumber('00');
    useRouletteStore.getState().spin();
    useRouletteStore.getState().revealAll();

    useRouletteStore.getState().reset();

    const state = useRouletteStore.getState();
    expect(state.spins).toEqual([]);
    expect(state.revealed).toBe(0);
    expect(state.wheel).toBe('american');
    expect(state.color).toBe('red');
    expect(state.number).toBe('00');
  });
});

describe('rouletteStore — switching wheels', () => {
  beforeEach(resetStore);

  it('discards the history — it was spun on a different wheel', () => {
    useRouletteStore.getState().spin();
    useRouletteStore.getState().revealAll();
    useRouletteStore.getState().setWheel('american');
    expect(useRouletteStore.getState().wheel).toBe('american');
    expect(useRouletteStore.getState().spins).toEqual([]);
    expect(useRouletteStore.getState().revealed).toBe(0);
  });

  it('drops a 00 prediction when switching to single zero, keeps every other pocket', () => {
    useRouletteStore.getState().setWheel('american');
    useRouletteStore.getState().selectNumber('00');
    useRouletteStore.getState().setWheel('european');
    expect(useRouletteStore.getState().number).toBeNull();

    useRouletteStore.getState().selectNumber('17');
    useRouletteStore.getState().setWheel('american');
    expect(useRouletteStore.getState().number).toBe('17');
  });

  it('keeps the colour prediction across a switch', () => {
    useRouletteStore.getState().selectColor('green');
    useRouletteStore.getState().setWheel('american');
    expect(useRouletteStore.getState().color).toBe('green');
  });

  it('the already-selected wheel is a complete no-op — the history survives', () => {
    useRouletteStore.getState().spin();
    const before = useRouletteStore.getState().spins;
    useRouletteStore.getState().setWheel('european');
    expect(useRouletteStore.getState().spins).toBe(before);
  });
});
