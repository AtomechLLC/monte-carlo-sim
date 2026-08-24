import { create } from 'zustand';

interface UiState {
  /**
   * Number of card animations currently in flight. A counter, never a boolean: the deal
   * stagger animates 8 cards concurrently and a boolean would clear on the first completion
   * rather than the last (03-RESEARCH Pattern 4).
   */
  pendingAnimationCount: number;
  /** Registers one animation as in-flight. Called synchronously by the four gameStore
   * navigation actions, in the same `set` transaction, so React renders the state change and
   * the armed count together. */
  beginAnimation: () => void;
  /** Releases one animation. Clamped at 0 — never negative, so an over-release (e.g. a
   * double-completion) can never strand the gate open in the wrong direction. */
  endAnimation: () => void;
  /**
   * Hard reset to 0 — TEST-ONLY helper (beforeEach isolation). Deliberately never called from
   * production code (03-REVIEW WR-01): gate correctness relies solely on balanced arm/release
   * accounting — every beginAnimation() has a guaranteed release path (useAnimationGate's
   * complete/key-change/unmount, useExitGate's closed hold lifecycle, TableScene's per-action
   * release). Calling this from deal() would NOT be a safe valve as-is: old in-flight cards'
   * unmount cleanups run in the re-deal commit and would decrement units armed AFTER the reset
   * (the clamp prevents negatives, not cross-registration theft), letting the gate open before
   * the new deal's cards finish registering. A real valve would need generation-aware
   * registrations (tag with dealNonce, drop stale releases) — not needed while accounting stays
   * balanced by construction.
   */
  resetAnimations: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  pendingAnimationCount: 0,
  beginAnimation: () => set((state) => ({ pendingAnimationCount: state.pendingAnimationCount + 1 })),
  endAnimation: () => set((state) => ({ pendingAnimationCount: Math.max(0, state.pendingAnimationCount - 1) })),
  resetAnimations: () => set({ pendingAnimationCount: 0 }),
}));
