import { useGameModeStore } from '../state/gameModeStore';

/**
 * Segmented two-button game-mode control (D-01). Renders in the control bar in BOTH modes.
 * Reads/writes only `gameModeStore` — no other store is touched from this component (D-05).
 * Button labels never change with state; `aria-pressed` alone carries which game is active,
 * mirroring the "Set Up Scenario" toggle's locked-label rule (`aria-expanded` carries its state).
 * Neither button is ever `disabled` (UI-SPEC A5) — clicking the already-active button is a
 * harmless no-op routed through `setMode`.
 */
export function GameModeSwitcher() {
  const mode = useGameModeStore((state) => state.mode);
  const setMode = useGameModeStore((state) => state.setMode);

  return (
    <div data-testid="game-mode-switcher" role="group" aria-label="Game mode">
      <button
        type="button"
        data-testid="game-mode-switch-holdem"
        aria-pressed={mode === 'holdem'}
        onClick={() => setMode('holdem')}
      >
        Hold'em
      </button>
      <button
        type="button"
        data-testid="game-mode-switch-blackjack"
        aria-pressed={mode === 'blackjack'}
        onClick={() => setMode('blackjack')}
      >
        Blackjack
      </button>
    </div>
  );
}
