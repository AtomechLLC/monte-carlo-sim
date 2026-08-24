import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { useBlackjackOddsStore, blackjackKnowledgeKey } from './blackjackOddsStore';
import { DEALER_BUCKET_COUNT } from '../worker/blackjackProtocol';
import type { BlackjackProgressSnapshot } from '../worker/blackjackProtocol';

/** A fully self-consistent settled snapshot: every tally reconciles with trialsCompleted. */
function makeSnapshot(overrides: Partial<BlackjackProgressSnapshot> = {}): BlackjackProgressSnapshot {
  return {
    requestId: 1,
    dealerOutcomeCounts: [20, 15, 15, 15, 10, 5, 20], // 7 buckets, sums to 100
    bustIfHitCount: 30,
    standOutcomes: { win: 40, push: 10, lose: 50 },
    hitOutcomes: { win: 30, push: 10, lose: 60 },
    trialsCompleted: 100,
    done: true,
    ...overrides,
  };
}

function resetOddsState() {
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
}

describe('blackjackKnowledgeKey — blackjack-shaped two-part key (D-10, Pitfall 11)', () => {
  it('composes player hand length and reveal state into a single string', () => {
    expect(blackjackKnowledgeKey(2, false)).toBe('2|0');
    expect(blackjackKnowledgeKey(3, true)).toBe('3|1');
  });

  it('two different hand lengths never collide', () => {
    expect(blackjackKnowledgeKey(2, false)).not.toBe(blackjackKnowledgeKey(3, false));
    expect(blackjackKnowledgeKey(2, true)).not.toBe(blackjackKnowledgeKey(3, true));
  });

  it('the same hand length with a differing reveal state never collides', () => {
    expect(blackjackKnowledgeKey(3, false)).not.toBe(blackjackKnowledgeKey(3, true));
  });
});

describe('blackjackOddsStore — settled cache and live display fields', () => {
  beforeEach(resetOddsState);

  it('cacheIfSettled stores a settled (done: true) snapshot and getCached returns it', () => {
    const snapshot = makeSnapshot({ done: true });
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, snapshot);
    expect(useBlackjackOddsStore.getState().getCached(2, false)).toEqual(snapshot);
  });

  it('cacheIfSettled stores nothing for an unsettled (done: false) snapshot — a silent no-op', () => {
    const snapshot = makeSnapshot({ done: false });
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, snapshot);
    expect(useBlackjackOddsStore.getState().getCached(2, false)).toBeUndefined();
    expect(useBlackjackOddsStore.getState().settledCache.size).toBe(0);
  });

  it('getCached returns undefined for a key never written', () => {
    expect(useBlackjackOddsStore.getState().getCached(5, true)).toBeUndefined();
  });

  it('entries are keyed independently per hand length and per reveal state', () => {
    const snapshot = makeSnapshot({ done: true });
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, snapshot);

    expect(useBlackjackOddsStore.getState().getCached(2, false)).toEqual(snapshot);
    expect(useBlackjackOddsStore.getState().getCached(2, true)).toBeUndefined();
    expect(useBlackjackOddsStore.getState().getCached(3, false)).toBeUndefined();
  });

  it('reset() zeroes every live display field but leaves the cache key set unchanged', () => {
    const snapshot = makeSnapshot({ done: true });
    useBlackjackOddsStore.getState().applySnapshot(snapshot);
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, snapshot);
    useBlackjackOddsStore.getState().cacheIfSettled(3, true, snapshot);
    const keysBefore = [...useBlackjackOddsStore.getState().settledCache.keys()];

    useBlackjackOddsStore.getState().reset();

    const state = useBlackjackOddsStore.getState();
    expect(state.dealerOutcomeCounts).toEqual(new Array(DEALER_BUCKET_COUNT).fill(0));
    expect(state.bustIfHitCount).toBe(0);
    expect(state.standOutcomes).toEqual({ win: 0, push: 0, lose: 0 });
    expect(state.hitOutcomes).toEqual({ win: 0, push: 0, lose: 0 });
    expect(state.trialsCompleted).toBe(0);
    expect(state.done).toBe(false);
    expect([...state.settledCache.keys()]).toEqual(keysBefore);
    expect(state.getCached(2, false)).toEqual(snapshot);
    expect(state.getCached(3, true)).toEqual(snapshot);
  });

  it('clearCache() empties settledCache while leaving the live display fields untouched', () => {
    const snapshot = makeSnapshot({ done: true });
    useBlackjackOddsStore.getState().applySnapshot(snapshot);
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, snapshot);

    useBlackjackOddsStore.getState().clearCache();

    const state = useBlackjackOddsStore.getState();
    expect(state.settledCache.size).toBe(0);
    expect(state.getCached(2, false)).toBeUndefined();
    // Live display fields (written via applySnapshot) are untouched by clearCache.
    expect(state.trialsCompleted).toBe(100);
    expect(state.dealerOutcomeCounts).toEqual(snapshot.dealerOutcomeCounts);
    expect(state.bustIfHitCount).toBe(30);
    expect(state.done).toBe(true);
  });

  it('every cache write produces a NEW Map instance (Zustand reference-equality rule)', () => {
    const before = useBlackjackOddsStore.getState().settledCache;
    useBlackjackOddsStore.getState().cacheIfSettled(2, false, makeSnapshot({ done: true }));
    const after = useBlackjackOddsStore.getState().settledCache;

    expect(after).not.toBe(before);
  });

  it('applySnapshot copies every tally field onto the live state', () => {
    const snapshot = makeSnapshot();
    useBlackjackOddsStore.getState().applySnapshot(snapshot);

    const state = useBlackjackOddsStore.getState();
    expect(state.dealerOutcomeCounts).toEqual(snapshot.dealerOutcomeCounts);
    expect(state.bustIfHitCount).toBe(snapshot.bustIfHitCount);
    expect(state.standOutcomes).toEqual(snapshot.standOutcomes);
    expect(state.hitOutcomes).toEqual(snapshot.hitOutcomes);
    expect(state.trialsCompleted).toBe(snapshot.trialsCompleted);
    expect(state.done).toBe(snapshot.done);
  });
});

describe('blackjackOddsStore — displayedDeckCount follows the A3 snapshot rule', () => {
  beforeEach(resetOddsState);

  it('defaults to 1', () => {
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(1);
  });

  it('setDisplayedDeckCount(2) is the only way it moves', () => {
    useBlackjackOddsStore.getState().setDisplayedDeckCount(2);
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(2);
  });

  it('reset(), clearCache() and applySnapshot() all leave displayedDeckCount unchanged', () => {
    useBlackjackOddsStore.getState().setDisplayedDeckCount(2);

    useBlackjackOddsStore.getState().reset();
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(2);

    useBlackjackOddsStore.getState().clearCache();
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(2);

    useBlackjackOddsStore.getState().applySnapshot(makeSnapshot());
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(2);
  });
});

describe('blackjackOddsStore — dev-only consistency guard (report-only, never throws, never alters state)', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    resetOddsState();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('reports a dealerOutcomeCounts array that is not 7 long — and still applies the snapshot', () => {
    // Length 6 but still summing to trialsCompleted, so ONLY the length check fires.
    const malformed = makeSnapshot({ dealerOutcomeCounts: [20, 15, 15, 15, 10, 25] });
    useBlackjackOddsStore.getState().applySnapshot(malformed);

    expect(errorSpy).toHaveBeenCalled();
    // Report-only: state is applied unchanged, the guard never blocks or rewrites it.
    expect(useBlackjackOddsStore.getState().dealerOutcomeCounts).toEqual([20, 15, 15, 15, 10, 25]);
    expect(useBlackjackOddsStore.getState().trialsCompleted).toBe(100);
  });

  it('reports when dealerOutcomeCounts does not sum to trialsCompleted — and still applies', () => {
    const malformed = makeSnapshot({ dealerOutcomeCounts: [20, 15, 15, 15, 10, 5, 19] }); // sums to 99
    useBlackjackOddsStore.getState().applySnapshot(malformed);

    expect(errorSpy).toHaveBeenCalled();
    expect(useBlackjackOddsStore.getState().dealerOutcomeCounts).toEqual([20, 15, 15, 15, 10, 5, 19]);
  });

  it('reports when standOutcomes does not sum to trialsCompleted — and still applies', () => {
    const malformed = makeSnapshot({ standOutcomes: { win: 40, push: 10, lose: 49 } }); // sums to 99
    useBlackjackOddsStore.getState().applySnapshot(malformed);

    expect(errorSpy).toHaveBeenCalled();
    expect(useBlackjackOddsStore.getState().standOutcomes).toEqual({ win: 40, push: 10, lose: 49 });
  });

  it('reports when hitOutcomes does not sum to trialsCompleted — and still applies', () => {
    const malformed = makeSnapshot({ hitOutcomes: { win: 30, push: 10, lose: 59 } }); // sums to 99
    useBlackjackOddsStore.getState().applySnapshot(malformed);

    expect(errorSpy).toHaveBeenCalled();
    expect(useBlackjackOddsStore.getState().hitOutcomes).toEqual({ win: 30, push: 10, lose: 59 });
  });

  it('reports when bustIfHitCount exceeds trialsCompleted — and still applies', () => {
    const malformed = makeSnapshot({ bustIfHitCount: 101 });
    useBlackjackOddsStore.getState().applySnapshot(malformed);

    expect(errorSpy).toHaveBeenCalled();
    expect(useBlackjackOddsStore.getState().bustIfHitCount).toBe(101);
  });

  it('does NOT report bustIfHitCount > hitOutcomes.lose — those are two genuinely different tallies', () => {
    // A hit can lose without busting, so there is no equality between these two numbers to
    // reconcile; the only hard bound on bustIfHitCount is trialsCompleted itself.
    const valid = makeSnapshot({
      bustIfHitCount: 60,
      hitOutcomes: { win: 30, push: 20, lose: 50 }, // sums to 100; 60 > 50 is legal
    });
    useBlackjackOddsStore.getState().applySnapshot(valid);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(useBlackjackOddsStore.getState().bustIfHitCount).toBe(60);
  });

  it('a fully consistent snapshot reports nothing', () => {
    useBlackjackOddsStore.getState().applySnapshot(makeSnapshot());
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
