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
   * Switches the active game. Setting the mode to its current value is a harmless no-op (UI-SPEC
   * A5: clicking the already-active switcher button must not be an error path) — `set` still
   * fires, but the resulting state is unchanged.
   */
  setMode: (mode: GameMode) => void;
}

export const useGameModeStore = create<GameModeState>()((set) => ({
  mode: 'holdem',
  setMode: (mode) => set({ mode }),
}));
