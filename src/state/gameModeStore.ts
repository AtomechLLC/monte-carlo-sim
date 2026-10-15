import { create } from 'zustand';

/**
 * A literal union, never a boolean and never a TS `enum` — mirrors `Street` (src/engine/streets.ts)
 * and `DeckCount` (src/engine/shoe.ts). Two games in Phase 5 (D-02); roulette joined as the
 * third (quick task 261015-ch8) and craps as the fourth (261015-d7o) by extending this union
 * exactly as that decision foresaw — it never becomes a boolean flag.
 */
export type GameMode = 'holdem' | 'blackjack' | 'roulette' | 'craps';

// gameModeStore must not import gameStore/oddsStore/pickerStore/uiStore — those stores stay
// entirely unaware Blackjack exists (D-05). The dependency, if any ever forms, runs one way only:
// consumers read `mode` from here, this module never reads game-specific state.

interface GameModeState {
  mode: GameMode;
  /**
   * True from the instant of a switch INTO holdem from any other game until the restored
   * Hold'em tree commits (App acknowledges via `ackHoldemRestore` in that commit's effect
   * phase). Consumed at render time by the animation layer (AnimatedCard captures it once at
   * mount) so a switch-back re-mount renders the exact table left behind instantly — no
   * deal-choreography replay, no animation-gate arming (D-07, 05-UI-SPEC "instant DOM swap",
   * 05-REVIEW WR-02 fix). This is cross-game SHELL state (which mount is a mode restore), not
   * game state — it reads nothing from any Hold'em-owned store.
   *
   * Generalised from "exactly a blackjack -> holdem switch" when roulette arrived (261015-ch8):
   * whichever game the user left, the Hold'em cards on the way back are a restore, not a deal.
   */
  holdemRestorePending: boolean;
  /**
   * True from the instant of a switch INTO blackjack from any other game until the restored
   * Blackjack tree commits (the Blackjack game root acknowledges via `ackBlackjackRestore` in
   * that commit's effect phase). Consumed at render time by the animation layer (captured once
   * at mount) so a switch-back re-mount renders the exact table left behind instantly — no
   * deal-choreography replay, no animation-gate arming (06-RESEARCH Pattern 5, Pitfall C). This
   * is cross-game SHELL state (which mount is a mode restore), not game state — it reads
   * nothing from any game-owned store. Note: the blackjack-local deck count does NOT belong in
   * this file — it lives in blackjackStore per D-10, and the mode-shell guard's token sweep
   * enforces that. Roulette and craps have no card animation and therefore no restore flag.
   */
  blackjackRestorePending: boolean;
  /**
   * Switches the active game. Setting the mode to its current value is a harmless no-op (UI-SPEC
   * A5: clicking the already-active switcher button must not be an error path) — `set` still
   * fires, but the resulting state is unchanged.
   */
  setMode: (mode: GameMode) => void;
  /** Clears the restore flag once the restored tree has committed. Idempotent. */
  ackHoldemRestore: () => void;
  /** Clears the blackjack restore flag once the restored tree has committed. Idempotent. */
  ackBlackjackRestore: () => void;
}

export const useGameModeStore = create<GameModeState>()((set) => ({
  mode: 'holdem',
  holdemRestorePending: false,
  blackjackRestorePending: false,
  setMode: (mode) =>
    set((state) => ({
      mode,
      // Recomputed on EVERY call: exactly a transition INTO holdem from another game marks a
      // restore; any other call (switch-away, A5 no-op click) clears it, so a stale flag can
      // never outlive the transition that justified it.
      holdemRestorePending: state.mode !== 'holdem' && mode === 'holdem',
      // Symmetric for blackjack (06-RESEARCH Pattern 5, Pitfall C): exactly a transition INTO
      // blackjack from another game marks a Blackjack restore, recomputed on every call in
      // this same set so neither flag can ever go stale.
      blackjackRestorePending: state.mode !== 'blackjack' && mode === 'blackjack',
    })),
  ackHoldemRestore: () => set({ holdemRestorePending: false }),
  ackBlackjackRestore: () => set({ blackjackRestorePending: false }),
}));
