import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';

// 05-REVIEW WR-01 regression pins. `errorMessage` lives in the cross-game App shell, so before
// the fix an error banner from a failed Hold'em run survived the entire Blackjack dwell and
// re-mounted — re-announcing itself via role="alert" — the instant the user switched back,
// describing a run the switch itself had already torn down. The fix clears the error when mode
// leaves 'holdem' (a queued microtask, mirroring the cache-hit branch's existing setState
// discipline). Same defect class the project already fixed once as 02-REVIEW WR-01 ("banner no
// longer describes what's on screen"). Default harness (reduced motion) — no real-motion mock,
// the banner lifecycle is animation-independent. Additive sibling to App.modeSwitch.test.tsx.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as every other App-level test's mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

const ERROR_DETAIL = 'deliberate test failure';

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  // TEST-ONLY use of resetAnimations (src/state/uiStore.ts's own guard comment) — beforeEach
  // isolation only.
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useGameModeStore.setState({ mode: 'holdem' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

describe('stale error banner does not survive a mode round trip (05-REVIEW WR-01)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('an error banner from before the switch is gone after switching back, while the recompute run is still in flight', async () => {
    // First run errors immediately; every later run hangs WITHOUT streaming progress — so
    // nothing on the switch-back path can clear the banner except the WR-01 fix itself (the
    // live branch only clears the error once a snapshot actually streams).
    vi.mocked(simulationService.startSimulation)
      .mockImplementationOnce(async (_conditioned, _onProgress, onError) => {
        onError(ERROR_DETAIL);
      })
      .mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    // Guard: the banner genuinely appeared before the switch — otherwise the absence assertion
    // after the round trip would be vacuous.
    const alert = await screen.findByTestId('simulation-error');
    expect(alert.textContent).toContain('unexpected error');
    expect(screen.getByTestId('simulation-error-detail').textContent).toContain(ERROR_DETAIL);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    // Mode-gated JSX already unmounts the banner while in Blackjack (D-04/A8) — pre- and
    // post-fix alike; the defect was the retained STATE behind it.
    expect(screen.queryByTestId('simulation-error')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    // Guard: the switch-back genuinely started a fresh (hanging, progress-less) recompute run —
    // proving the banner absence below comes from the mode-switch clear, not from a streamed
    // snapshot's own error-clearing path.
    expect(vi.mocked(simulationService.startSimulation)).toHaveBeenCalledTimes(2);

    // WR-01: the stale banner — describing the pre-switch run the switch itself cancelled —
    // must NOT re-mount (and re-announce via role="alert") on the way back in. Pre-fix it sat
    // on screen for the whole re-mount because `errorMessage` was never cleared on switch-away.
    expect(screen.queryByTestId('simulation-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('simulation-error-detail')).not.toBeInTheDocument();
  });

  it('a FRESH error from the post-switch-back recompute still shows its banner (the clear is not a suppression)', async () => {
    // Every run errors — after the round trip, the recompute run's own error is current, honest
    // state for what is on screen and must surface normally.
    vi.mocked(simulationService.startSimulation).mockImplementation(
      async (_conditioned, _onProgress, onError) => {
        onError(ERROR_DETAIL);
      },
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await screen.findByTestId('simulation-error');

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(vi.mocked(simulationService.startSimulation)).toHaveBeenCalledTimes(2);
    const freshAlert = await screen.findByTestId('simulation-error');
    expect(freshAlert.textContent).toContain('unexpected error');
    expect(screen.getByTestId('simulation-error-detail').textContent).toContain(ERROR_DETAIL);
  });
});
