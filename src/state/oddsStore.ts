import { create } from 'zustand';
import { CATEGORY_COUNT } from '../worker/protocol';
import type { ProgressSnapshot } from '../worker/protocol';
import type { Street } from '../engine/streets';

// oddsStore must not import gameStore — the dependency runs one way only (gameStore.deal()
// calls useOddsStore.getState().clearCache(), never the reverse).

/** Composite cache key: `${street}|${revealedMask}`, e.g. `knowledgeKey('flop', 5)` -> `"flop|5"`. */
export function knowledgeKey(street: Street, revealedMask: number): string {
  return `${street}|${revealedMask}`;
}

interface OddsState {
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
  done: boolean;
  /**
   * Settled (done: true) snapshots keyed by knowledgeKey(street, revealedMask). Because the key
   * includes the reveal mask, a reveal changes the key for every street simultaneously — every
   * future lookup at any street misses until recomputed, satisfying D-11 with no explicit
   * invalidation code path.
   */
  settledCache: Map<string, ProgressSnapshot>;
  /** Restores initial (all-zero) LIVE DISPLAY fields — call before starting a fresh simulation
   * run. Deliberately does NOT touch settledCache: reset() runs before every fresh simulation
   * and must not throw away previously settled streets (load-bearing for D-10). */
  reset: () => void;
  /** Writes a streamed snapshot's fields into state. */
  applySnapshot: (snapshot: ProgressSnapshot) => void;
  /** Returns the cached settled snapshot for (street, revealedMask), or undefined on a miss. */
  getCached: (street: Street, revealedMask: number) => ProgressSnapshot | undefined;
  /** Stores `snapshot` under (street, revealedMask) ONLY when `snapshot.done` is true — a
   * no-op write-gate for unsettled (still-converging) snapshots. */
  cacheIfSettled: (street: Street, revealedMask: number, snapshot: ProgressSnapshot) => void;
  /** Empties settledCache — called by gameStore.deal() so a new hand never serves the previous
   * hand's settled numbers. Leaves the live display fields untouched. */
  clearCache: () => void;
}

function initialOddsFields(): Omit<OddsState, 'reset' | 'applySnapshot' | 'settledCache' | 'getCached' | 'cacheIfSettled' | 'clearCache'> {
  return {
    categoryCounts: new Array(CATEGORY_COUNT).fill(0),
    outcomes: { win: 0, tie: 0, lose: 0 },
    trialsCompleted: 0,
    done: false,
  };
}

/**
 * Dev-only internal consistency guard (ENG-04 / T-04-01): reports — but never throws or
 * alters — any snapshot whose category counts or outcome counts fail to reconcile with
 * `trialsCompleted`, or whose category histogram is not `CATEGORY_COUNT` long. This is a
 * report-only safety net so a numeric regression surfaces loudly during development
 * without ever being able to break the live convergence display in production.
 */
function checkSnapshotConsistency(snapshot: ProgressSnapshot): void {
  const categorySum = snapshot.categoryCounts.reduce((a, b) => a + b, 0);
  const outcomeSum = snapshot.outcomes.win + snapshot.outcomes.tie + snapshot.outcomes.lose;

  // Both histogram shapes are legitimate (Phase 7 D-05): CATEGORY_COUNT (10, 1-deck) and
  // CATEGORY_COUNT + 1 (11, 2-deck — index 10 is Five of a Kind). A report-only guard that
  // fires on every legitimate 2-deck snapshot is worse than no guard, because it trains
  // people to ignore the channel (07-RESEARCH Pitfall 2) — so the length check is WIDENED
  // to the two-member family, never disabled: out-of-family lengths still report, and the
  // `categorySum === trialsCompleted` check below holds unchanged at length 11.
  if (
    snapshot.categoryCounts.length !== CATEGORY_COUNT &&
    snapshot.categoryCounts.length !== CATEGORY_COUNT + 1
  ) {
    console.error(
      `[oddsStore consistency guard] categoryCounts has length ${snapshot.categoryCounts.length}, expected ${CATEGORY_COUNT} (1 deck) or ${CATEGORY_COUNT + 1} (2 decks)`,
    );
  }
  if (categorySum !== snapshot.trialsCompleted) {
    console.error(
      `[oddsStore consistency guard] categoryCounts sum (${categorySum}) does not match trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
  if (outcomeSum !== snapshot.trialsCompleted) {
    console.error(
      `[oddsStore consistency guard] outcomes sum (${outcomeSum}) does not match trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
}

export const useOddsStore = create<OddsState>()((set, get) => ({
  ...initialOddsFields(),
  settledCache: new Map<string, ProgressSnapshot>(),
  // Partial merge (set() only overwrites the live-display keys returned by initialOddsFields())
  // — settledCache is untouched, which is load-bearing for D-10 (rewinding to a previously
  // settled street must not lose its cached numbers just because a fresh run started).
  reset: () => set(initialOddsFields()),
  applySnapshot: (snapshot) => {
    if (import.meta.env.DEV) {
      checkSnapshotConsistency(snapshot);
    }
    set({
      categoryCounts: snapshot.categoryCounts,
      outcomes: snapshot.outcomes,
      trialsCompleted: snapshot.trialsCompleted,
      done: snapshot.done,
    });
  },
  getCached: (street, revealedMask) => get().settledCache.get(knowledgeKey(street, revealedMask)),
  cacheIfSettled: (street, revealedMask, snapshot) => {
    if (!snapshot.done) return;
    // Copy-on-write: never mutate the existing Map in place (Zustand reference-equality rule —
    // subscribers comparing the old/new Map reference would otherwise miss the update).
    set((state) => ({
      settledCache: new Map(state.settledCache).set(knowledgeKey(street, revealedMask), snapshot),
    }));
  },
  clearCache: () => set({ settledCache: new Map<string, ProgressSnapshot>() }),
}));
