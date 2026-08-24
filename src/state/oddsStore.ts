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

export const useOddsStore = create<OddsState>()((set) => ({
  ...initialOddsFields(),
  reset: () => set(initialOddsFields()),
  applySnapshot: (snapshot) =>
    set({
      categoryCounts: snapshot.categoryCounts,
      outcomes: snapshot.outcomes,
      trialsCompleted: snapshot.trialsCompleted,
      done: snapshot.done,
    }),
}));
