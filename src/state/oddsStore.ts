import { create } from 'zustand';
import { CATEGORY_COUNT } from '../worker/protocol';
import type { ProgressSnapshot } from '../worker/protocol';

interface OddsState {
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
  done: boolean;
  /** Restores initial (all-zero) state — call before starting a fresh simulation run. */
  reset: () => void;
  /** Writes a streamed snapshot's fields into state. */
  applySnapshot: (snapshot: ProgressSnapshot) => void;
}

function initialOddsFields(): Omit<OddsState, 'reset' | 'applySnapshot'> {
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

  if (snapshot.categoryCounts.length !== CATEGORY_COUNT) {
    console.error(
      `[oddsStore consistency guard] categoryCounts has length ${snapshot.categoryCounts.length}, expected ${CATEGORY_COUNT}`,
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

export const useOddsStore = create<OddsState>()((set) => ({
  ...initialOddsFields(),
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
}));
