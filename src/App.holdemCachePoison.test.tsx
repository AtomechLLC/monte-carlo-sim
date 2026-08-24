import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import * as blackjackSimulationService from './state/blackjackSimulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { usePickerStore } from './state/pickerStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';
import { useBlackjackStore } from './state/blackjackStore';
import { useBlackjackOddsStore } from './state/blackjackOddsStore';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';
import type { Card } from '@poker-apprentice/types';

// 06-REVIEW CR-02, Hold'em half. `HoldemGame`'s onProgress stays fully live from a store
// action's synchronous writes until React's passive-effect flush runs the cleanup that flips
// the ignore flag — worker `message` events are macrotasks that can be delivered inside that
// gap. A re-deal lands on the SAME (street, revealedMask) cache key with completely different
// cards, so a late settled snapshot from the superseded hand can be cached AFTER deal()'s
// clearCache(), then served as a cache hit for the fresh hand (which then starts NO run).
// Deliberately a NEW sibling file: the five frozen v1 suites (App.test.tsx,
// App.acceptance.test.tsx, App.phase3.acceptance.test.tsx, App.modeErrorBanner.test.tsx,
// App.modeSwitchRace.test.tsx) must not be edited (D-08), same precedent as
// App.modeIsolation.test.tsx.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.modeIsolation.test.tsx's existing mocks.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

// Same explicit-factory rationale: <App /> reaches the blackjack service through
// <BlackjackGame />'s import graph even while mode stays 'holdem'.
vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const startSim = vi.mocked(simulationService.startSimulation);

/** Bumped per default-implementation call so each run's settled win count is recognisably
 * distinct — a cache-served value is distinguishable from a coincidentally-identical fresh
 * run (the App.modeIsolation.test.tsx harness convention). */
let callIndex = 0;

/** Internally consistent settled snapshot (category and outcome sums both equal
 * trialsCompleted, so the dev-only store consistency guard stays silent). */
function settledSnapshot(win: number): ProgressSnapshot {
  return {
    requestId: 1,
    categoryCounts: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    outcomes: { win, tie: 0, lose: 100 - win },
    trialsCompleted: 100,
    done: true,
  };
}

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useBlackjackStore.setState({
    round: null,
    playerHand: [] as Card[],
    dealerPlayoutCards: [] as Card[],
    roundPhase: 'idle',
    revealedHole: false,
    outcome: null,
    playerNaturalWin: false,
    deckCount: 1,
    roundNonce: 0,
  });
  // Placed AFTER the store resets (mirrors every existing App-level test harness): a reset
  // must never leave a stale armed count behind from a previous test.
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  usePickerStore.getState().clearAll();
  useGameModeStore.setState({ mode: 'holdem' });
  startSim.mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockReset();
  vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mockReset();
  callIndex = 0;
  startSim.mockImplementation(
    async (_conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      onProgress(settledSnapshot(50 + callIndex++));
    },
  );
}

beforeEach(() => {
  resetStores();
});

describe('06-REVIEW CR-02 (Hold\'em): a late snapshot landing between deal() and the effect cleanup must neither display nor cache', () => {
  it('a superseded hand\'s late done-snapshot must not poison the fresh hand\'s preflop cache (same key, wrong dealNonce)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Run 1 HANGS and hands us its onProgress so the test can deliver the late snapshot at
    // the exact race point (after deal()'s synchronous clearCache(), before the passive-
    // effect cleanup flips the ignore flag — the window a real worker macrotask can hit).
    let lateOnProgress: ((snapshot: ProgressSnapshot) => void) | null = null;
    startSim.mockImplementationOnce(
      async (_conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
        lateOnProgress = onProgress;
        await new Promise(() => {});
      },
    );
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(startSim).toHaveBeenCalledTimes(1);
    expect(lateOnProgress).not.toBeNull();

    act(() => {
      useGameStore.getState().deal(); // synchronous clearCache(); same key "preflop|0", new hand
      lateOnProgress!(settledSnapshot(99)); // hand 1's late settled snapshot
    });
    await act(async () => {});

    // A poisoned cache would hit at "preflop|0", apply hand 1's converged odds to hand 2's
    // completely different cards, and start NO run. The fresh hand must instead get its own
    // live run (win 50, call index 0 of the default implementation).
    expect(startSim).toHaveBeenCalledTimes(2);
    expect(useOddsStore.getState().outcomes.win).toBe(50);
    const cached = useOddsStore.getState().getCached('preflop', 0);
    expect(cached?.outcomes.win).toBe(50);
  });
});
