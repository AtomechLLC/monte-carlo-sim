import { create } from 'zustand';
import { createRng } from '../engine/rng';
import { TRIALS_PER_BATCH, runTrials, type CrapsBet, type CrapsTrial, type FieldRule } from '../engine/craps';

// Craps' one store (quick task 261015-d7o). Engine modules only — no other store, in either
// direction — the isolation every game before it has. As with roulette there is no odds store:
// a batch of 100 decisions is a few hundred dice rolls computed synchronously here, so there is
// no streamed run to cache or cancel.

interface CrapsState {
  /** The bet being scored, or null until the player picks one. Exactly one at a time. */
  bet: CrapsBet | null;
  /** Whether a Field 12 pays triple (the common rule) or double. The explorable house rule. */
  fieldRule: FieldRule;
  /** Every resolved decision so far, oldest first, each with every roll it took. */
  trials: CrapsTrial[];
  /** How many of `trials` the display counts — walked up by the progressive-reveal hook. */
  revealed: number;
  /** Toggles the bet: the current bet clears, any other replaces. Changing the bet discards the
   * history, because a decision's boundaries depend on the bet (PLAN decision 6). */
  selectBet: (bet: CrapsBet) => void;
  /** Switches the Field house rule. Discards the history only when the Field is the bet being
   * scored — no other bet's resolution depends on it. Same value: no-op. */
  setFieldRule: (rule: FieldRule) => void;
  /** Appends TRIALS_PER_BATCH resolved decisions of the current bet. No bet: nothing to resolve. */
  roll: () => void;
  /** Reveals `step` more decisions (default 1), clamped to the history. */
  revealNext: (step?: number) => void;
  /** Reveals the whole history at once (reduced motion, tests). */
  revealAll: () => void;
  /** Clears the history. The bet and the house rule stay. */
  reset: () => void;
}

export const useCrapsStore = create<CrapsState>()((set, get) => ({
  bet: null,
  fieldRule: 'triple12',
  trials: [],
  revealed: 0,
  selectBet: (bet) =>
    set((state) => ({
      bet: state.bet === bet ? null : bet,
      trials: [],
      revealed: 0,
    })),
  setFieldRule: (rule) => {
    const state = get();
    if (state.fieldRule === rule) return;
    if (state.bet === 'field') {
      set({ fieldRule: rule, trials: [], revealed: 0 });
    } else {
      set({ fieldRule: rule });
    }
  },
  roll: () => {
    const { bet, fieldRule } = get();
    if (bet === null) return;
    // createRng() with NO seed: real, non-reproducible-by-design rolls, the convention every
    // game's deal uses. Seeded determinism lives in the engine tests.
    const batch = runTrials(createRng(), bet, fieldRule, TRIALS_PER_BATCH);
    set((state) => ({ trials: [...state.trials, ...batch] }));
  },
  revealNext: (step = 1) =>
    set((state) => ({ revealed: Math.min(state.trials.length, state.revealed + Math.max(0, step)) })),
  revealAll: () => set((state) => ({ revealed: state.trials.length })),
  reset: () => set({ trials: [], revealed: 0 }),
}));
