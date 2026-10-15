import { describe, it, expect, beforeEach } from 'vitest';
import { useCrapsStore } from './crapsStore';
import { TRIALS_PER_BATCH } from '../engine/craps';

function resetStore() {
  useCrapsStore.setState({ bet: null, fieldRule: 'triple12', trials: [], revealed: 0 });
}

describe('crapsStore — defaults', () => {
  beforeEach(resetStore);

  it('starts with no bet, the triple-12 Field rule, and no history', () => {
    const state = useCrapsStore.getState();
    expect(state.bet).toBeNull();
    expect(state.fieldRule).toBe('triple12');
    expect(state.trials).toEqual([]);
    expect(state.revealed).toBe(0);
  });
});

describe('crapsStore — the bet', () => {
  beforeEach(resetStore);

  it('selectBet sets, replaces, and clears on a repeat', () => {
    useCrapsStore.getState().selectBet('pass');
    expect(useCrapsStore.getState().bet).toBe('pass');
    useCrapsStore.getState().selectBet('field');
    expect(useCrapsStore.getState().bet).toBe('field');
    useCrapsStore.getState().selectBet('field');
    expect(useCrapsStore.getState().bet).toBeNull();
  });

  it('changing the bet discards the history — a decision depends on the bet it was for', () => {
    useCrapsStore.getState().selectBet('pass');
    useCrapsStore.getState().roll();
    useCrapsStore.getState().revealAll();
    expect(useCrapsStore.getState().trials).toHaveLength(TRIALS_PER_BATCH);

    useCrapsStore.getState().selectBet('dontPass');

    expect(useCrapsStore.getState().trials).toEqual([]);
    expect(useCrapsStore.getState().revealed).toBe(0);
  });
});

describe('crapsStore — rolling and revealing', () => {
  beforeEach(resetStore);

  it('roll() with no bet is a no-op — there is nothing to resolve', () => {
    useCrapsStore.getState().roll();
    expect(useCrapsStore.getState().trials).toEqual([]);
  });

  it('roll() appends exactly TRIALS_PER_BATCH decisions of the current bet and reveals none', () => {
    useCrapsStore.getState().selectBet('anySeven');
    useCrapsStore.getState().roll();
    const { trials, revealed } = useCrapsStore.getState();
    expect(trials).toHaveLength(TRIALS_PER_BATCH);
    expect(revealed).toBe(0);
    for (const trial of trials) expect(trial.rolls).toHaveLength(1);
  });

  it('a second roll() accumulates to 200', () => {
    useCrapsStore.getState().selectBet('pass');
    useCrapsStore.getState().roll();
    const first = useCrapsStore.getState().trials;
    useCrapsStore.getState().roll();
    expect(useCrapsStore.getState().trials).toHaveLength(2 * TRIALS_PER_BATCH);
    expect(useCrapsStore.getState().trials.slice(0, TRIALS_PER_BATCH)).toEqual(first);
  });

  it('revealNext walks and clamps; revealAll jumps; reset clears but keeps the bet and rule', () => {
    useCrapsStore.getState().selectBet('place6');
    useCrapsStore.getState().setFieldRule('double12');
    useCrapsStore.getState().roll();
    useCrapsStore.getState().revealNext();
    expect(useCrapsStore.getState().revealed).toBe(1);
    useCrapsStore.getState().revealNext(500);
    expect(useCrapsStore.getState().revealed).toBe(TRIALS_PER_BATCH);
    useCrapsStore.getState().revealNext(-3);
    expect(useCrapsStore.getState().revealed).toBe(TRIALS_PER_BATCH);

    useCrapsStore.getState().reset();
    expect(useCrapsStore.getState().trials).toEqual([]);
    expect(useCrapsStore.getState().revealed).toBe(0);
    expect(useCrapsStore.getState().bet).toBe('place6');
    expect(useCrapsStore.getState().fieldRule).toBe('double12');
  });
});

describe('crapsStore — the Field house rule', () => {
  beforeEach(resetStore);

  it('discards the history only when the Field is the bet being scored', () => {
    useCrapsStore.getState().selectBet('pass');
    useCrapsStore.getState().roll();
    useCrapsStore.getState().setFieldRule('double12');
    expect(useCrapsStore.getState().fieldRule).toBe('double12');
    expect(useCrapsStore.getState().trials).toHaveLength(TRIALS_PER_BATCH);

    useCrapsStore.getState().selectBet('field');
    useCrapsStore.getState().roll();
    useCrapsStore.getState().setFieldRule('triple12');
    expect(useCrapsStore.getState().fieldRule).toBe('triple12');
    expect(useCrapsStore.getState().trials).toEqual([]);
  });

  it('the already-selected rule is a complete no-op', () => {
    useCrapsStore.getState().selectBet('field');
    useCrapsStore.getState().roll();
    const before = useCrapsStore.getState().trials;
    useCrapsStore.getState().setFieldRule('triple12');
    expect(useCrapsStore.getState().trials).toBe(before);
  });
});
