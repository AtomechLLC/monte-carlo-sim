import { create } from 'zustand';

/**
 * A literal union, never a boolean and never a TS `enum` — mirrors `Street` (src/engine/streets.ts)
 * and `DeckCount` (src/engine/shoe.ts). Exactly two games this phase (D-02); a third game later
 * extends this union, it does not become a boolean flag.
 */
export type GameMode = 'holdem' | 'blackjack';

// gameModeStore must not import gameStore/oddsStore/pickerStore/uiStore — those stores stay
// entirely unaware Blackjack exists (D-05). The dependency, if any ever forms, runs one way only:
// consumers read `mode` from here, this module never reads game-specific state.

interface GameModeState {
  mode: GameMode;
  /**
   * True from the instant of a blackjack -> holdem switch until the restored Hold'em tree
   * commits (App acknowledges via `ackHoldemRestore` in that commit's effect phase). Consumed at
   * render time by the animation layer (AnimatedCard captures it once at mount) so a switch-back
   * re-mount renders the exact table left behind instantly — no deal-choreography replay, no
   * animation-gate arming (D-07, 05-UI-SPEC "instant DOM swap", 05-REVIEW WR-02 fix). This is
   * cross-game SHELL state (which mount is a mode restore), not game state — it reads nothing
   * from any Hold'em-owned store.
   */
  holdemRestorePending: boolean;
  /**
   * Switches the active game. Setting the mode to its current value is a harmless no-op (UI-SPEC
   * A5: clicking the already-active switcher button must not be an error path) — `set` still
   * fires, but the resulting state is unchanged.
   */
  setMode: (mode: GameMode) => void;
  /** Clears the restore flag once the restored tree has committed. Idempotent. */
  ackHoldemRestore: () => void;
}

export const useGameModeStore = create<GameModeState>()((set) => ({
  mode: 'holdem',
  holdemRestorePending: false,
  setMode: (mode) =>
    set((state) => ({
      mode,
      // Recomputed on EVERY call: exactly a blackjack -> holdem transition marks a restore;
      // any other call (switch-away, A5 no-op click) clears it, so a stale flag can never
      // outlive the transition that justified it.
      holdemRestorePending: state.mode === 'blackjack' && mode === 'holdem',
    })),
  ackHoldemRestore: () => set({ holdemRestorePending: false }),
}));
