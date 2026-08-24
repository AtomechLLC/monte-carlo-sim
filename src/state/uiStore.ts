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
  /** Hard reset to 0 — used by tests and as a re-deal safety valve. */
  resetAnimations: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  pendingAnimationCount: 0,
  beginAnimation: () => set((state) => ({ pendingAnimationCount: state.pendingAnimationCount + 1 })),
  endAnimation: () => set((state) => ({ pendingAnimationCount: Math.max(0, state.pendingAnimationCount - 1) })),
  resetAnimations: () => set({ pendingAnimationCount: 0 }),
}));
