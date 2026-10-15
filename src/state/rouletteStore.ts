import { create } from 'zustand';
import { createRng } from '../engine/rng';
import {
  SPINS_PER_BATCH,
  isPocketOnWheel,
  spinMany,
  type Pocket,
  type PocketColor,
  type WheelKind,
} from '../engine/roulette';

// Roulette's one store (quick task 261015-ch8). It imports engine modules only — no other
// store, in either direction — which is the same isolation the Phase 5/6 shell rules put on
// the two games before it. There is no odds store beside it: a batch of 100 spins is a
// hundred integer draws, computed synchronously right here on the main thread, so there is
// no streamed run to cache or cancel (PLAN decision 2).

interface RouletteState {
  /** Single-zero (37 pockets) or double-zero (38). The one parameter that moves every odds. */
  wheel: WheelKind;
  /** The colour prediction, if any. Independent of `number` — both can be set at once. */
  color: PocketColor | null;
  /** The straight-up pocket prediction, if any. Always a pocket of the current wheel. */
  number: Pocket | null;
  /** Every spin so far, oldest first. Independent of the prediction, so a changed prediction
   * re-scores the same history. */
  spins: Pocket[];
  /** How many of `spins` the display counts. `spin()` appends a batch without moving this;
   * the progressive-reveal hook walks it up to `spins.length` (PLAN decision 3). */
  revealed: number;
  /** Switches wheels. The history is discarded (it was spun on a different wheel) and a
   * `number` the new wheel does not carry ('00' on single zero) is dropped. Same value: no-op. */
  setWheel: (wheel: WheelKind) => void;
  /** Toggles a colour prediction: the current colour clears, any other replaces. */
  selectColor: (color: PocketColor) => void;
  /** Toggles a straight-up prediction. A pocket not on the current wheel is ignored. */
  selectNumber: (pocket: Pocket) => void;
  /** Appends SPINS_PER_BATCH fresh spins. Permissive on purpose — the spins do not depend
   * on the prediction; the control is what waits for one. */
  spin: () => void;
  /** Reveals `step` more spins (default 1), clamped to the history. */
  revealNext: (step?: number) => void;
  /** Reveals the whole history at once (reduced motion, tests). */
  revealAll: () => void;
  /** Clears the history. The wheel and both predictions stay. */
  reset: () => void;
}

export const useRouletteStore = create<RouletteState>()((set, get) => ({
  wheel: 'european',
  color: null,
  number: null,
  spins: [],
  revealed: 0,
  setWheel: (wheel) => {
    if (get().wheel === wheel) return;
    const number = get().number;
    set({
      wheel,
      spins: [],
      revealed: 0,
      number: number !== null && isPocketOnWheel(wheel, number) ? number : null,
    });
  },
  selectColor: (color) => set((state) => ({ color: state.color === color ? null : color })),
  selectNumber: (pocket) => {
    if (!isPocketOnWheel(get().wheel, pocket)) return;
    set((state) => ({ number: state.number === pocket ? null : pocket }));
  },
  spin: () => {
    // createRng() with NO seed: real, non-reproducible-by-design spins, the same convention
    // the Hold'em and Blackjack deals use. Seeded determinism lives in the engine tests.
    const batch = spinMany(createRng(), get().wheel, SPINS_PER_BATCH);
    set((state) => ({ spins: [...state.spins, ...batch] }));
  },
  revealNext: (step = 1) =>
    set((state) => ({ revealed: Math.min(state.spins.length, state.revealed + Math.max(0, step)) })),
  revealAll: () => set((state) => ({ revealed: state.spins.length })),
  reset: () => set({ spins: [], revealed: 0 }),
}));

/** True once the player has picked something to score. */
export function hasPrediction(state: Pick<RouletteState, 'color' | 'number'>): boolean {
  return state.color !== null || state.number !== null;
}
