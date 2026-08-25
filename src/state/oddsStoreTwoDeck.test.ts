import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useOddsStore } from './oddsStore';
import type { ProgressSnapshot } from '../worker/protocol';

// ADDITIVE sibling of oddsStore.test.ts (Phase 7 plan 07-03, D-05/HE2-02): pins the
// widened-but-not-disabled dev consistency guard. The guard accepts BOTH the 10-length
// (1-deck) and 11-length (2-deck) histogram shapes rather than being switched to 11,
// because shipped 10-length snapshot fixtures elsewhere in the suite (e.g.
// App.holdemCachePoison.test.tsx's settledSnapshot) must keep passing it silently — and a
// report-only guard that fires on every legitimate 2-deck snapshot trains people to ignore
// the channel entirely (07-RESEARCH Pitfall 2). Out-of-family lengths and sum mismatches
// must still fire: widened, never neutered.

/** Internally consistent snapshot: category sum and outcome sum both equal trialsCompleted. */
function reconcilingSnapshot(categoryCounts: number[]): ProgressSnapshot {
  const total = categoryCounts.reduce((a, b) => a + b, 0);
  return {
    requestId: 1,
    categoryCounts,
    outcomes: { win: total, tie: 0, lose: 0 },
    trialsCompleted: total,
    done: true,
  };
}

/** A length-N histogram putting every tally at index 0, summing to 100. */
function histogramOfLength(length: number): number[] {
  const counts = new Array<number>(length).fill(0);
  counts[0] = 100;
  return counts;
}

describe('oddsStore dev consistency guard — accepts 10- and 11-length snapshots without losing its teeth', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useOddsStore.getState().reset();
    // The guard is DEV-only (checkSnapshotConsistency runs behind import.meta.env.DEV,
    // which vitest sets true) and report-only — it writes to console.error, never throws.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('a length-10 snapshot with reconciling sums produces no console error (1-deck shape)', () => {
    useOddsStore.getState().applySnapshot(reconcilingSnapshot(histogramOfLength(10)));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a length-11 snapshot with reconciling sums produces no console error (2-deck shape)', () => {
    useOddsStore.getState().applySnapshot(reconcilingSnapshot(histogramOfLength(11)));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a length-9 snapshot DOES fire the guard, naming the observed length', () => {
    useOddsStore.getState().applySnapshot(reconcilingSnapshot(histogramOfLength(9)));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('length 9');
  });

  it('a length-12 snapshot DOES fire the guard, naming the observed length', () => {
    useOddsStore.getState().applySnapshot(reconcilingSnapshot(histogramOfLength(12)));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('length 12');
  });

  it('a length-11 snapshot whose category sum does not match trialsCompleted still fires the sum-mismatch error', () => {
    const snapshot = reconcilingSnapshot(histogramOfLength(11));
    // Break ONLY the category sum (outcomes still reconcile), so exactly one report fires.
    snapshot.categoryCounts = [...snapshot.categoryCounts];
    snapshot.categoryCounts[10] = 7;
    useOddsStore.getState().applySnapshot(snapshot);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('does not match trialsCompleted');
  });
});
