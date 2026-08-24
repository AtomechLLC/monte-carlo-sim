import { describe, it, expect, beforeEach } from 'vitest';
import { useOddsStore, knowledgeKey } from './oddsStore';
import { useGameStore } from './gameStore';
import type { ProgressSnapshot } from '../worker/protocol';

function makeSnapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    requestId: 1,
    categoryCounts: new Array(10).fill(0),
    outcomes: { win: 60, tie: 10, lose: 30 },
    trialsCompleted: 100,
    done: true,
    ...overrides,
  };
}

describe('oddsStore — knowledge-keyed settled-odds cache', () => {
  beforeEach(() => {
    useOddsStore.getState().reset();
    useOddsStore.getState().clearCache();
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  });

  it('knowledgeKey composes street and revealedMask into a single string', () => {
    expect(knowledgeKey('flop', 5)).toBe('flop|5');
  });

  it('cacheIfSettled stores a settled (done: true) snapshot and getCached returns it', () => {
    const snapshot = makeSnapshot({ done: true });
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);
    expect(useOddsStore.getState().getCached('flop', 0)).toEqual(snapshot);
  });

  it('cacheIfSettled stores nothing for an unsettled (done: false) snapshot', () => {
    const snapshot = makeSnapshot({ done: false });
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);
    expect(useOddsStore.getState().getCached('flop', 0)).toBeUndefined();
  });

  it('getCached returns undefined for a key never written', () => {
    expect(useOddsStore.getState().getCached('turn', 3)).toBeUndefined();
  });

  it('entries are keyed independently per street and per reveal mask', () => {
    const snapshot = makeSnapshot({ done: true });
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);

    expect(useOddsStore.getState().getCached('flop', 0)).toEqual(snapshot);
    expect(useOddsStore.getState().getCached('flop', 1)).toBeUndefined();
    expect(useOddsStore.getState().getCached('turn', 0)).toBeUndefined();
  });

  it('reset() clears the live display fields but leaves settledCache intact', () => {
    const snapshot = makeSnapshot({ done: true });
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);

    useOddsStore.getState().reset();

    expect(useOddsStore.getState().getCached('flop', 0)).toEqual(snapshot);
    expect(useOddsStore.getState().trialsCompleted).toBe(0);
    expect(useOddsStore.getState().done).toBe(false);
  });

  it('clearCache() empties settledCache while leaving the live display fields alone', () => {
    const snapshot = makeSnapshot({ done: true });
    useOddsStore.getState().applySnapshot(snapshot);
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);

    useOddsStore.getState().clearCache();

    expect(useOddsStore.getState().getCached('flop', 0)).toBeUndefined();
    expect(useOddsStore.getState().settledCache.size).toBe(0);
    // Live display fields (applied via applySnapshot) are untouched by clearCache.
    expect(useOddsStore.getState().trialsCompleted).toBe(100);
  });

  it('every cache write produces a NEW Map instance (Zustand reference-equality rule)', () => {
    const before = useOddsStore.getState().settledCache;
    useOddsStore.getState().cacheIfSettled('flop', 0, makeSnapshot({ done: true }));
    const after = useOddsStore.getState().settledCache;

    expect(after).not.toBe(before);
  });

  it('gameStore.deal() leaves settledCache empty even when entries existed for the previous hand', () => {
    useOddsStore.getState().cacheIfSettled('flop', 0, makeSnapshot({ done: true }));
    expect(useOddsStore.getState().settledCache.size).toBe(1);

    useGameStore.getState().deal();

    expect(useOddsStore.getState().settledCache.size).toBe(0);
  });
});
