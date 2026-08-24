import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { HOLDEM_ONLY_TESTIDS } from './test/holdemTestids';
import { BLACKJACK_ONLY_TESTIDS } from './test/blackjackTestids';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';
import type { BlackjackProgressSnapshot } from './worker/blackjackProtocol';
import type { BlackjackConditionedState } from './engine/blackjackEquity';
import type { Card } from '@poker-apprentice/types';

// Phase 5 Plan 02 isolation proof (D-04/D-05/D-06/D-07). A failure ANYWHERE in this file means
// Plan 01's production code (src/App.tsx's mode-scoped odds effect and JSX fork, or
// gameModeStore.ts) is wrong — the fix belongs there, this assertion must NOT be relaxed to make
// it pass. This file proves isolation from three of the four angles CONTEXT's <specifics>
// section demands: store-observable (D-06: gameStore/pickerStore snapshot equality across a
// switch round trip, plus oddsStore.settledCache key-set stability), DOM-observable (D-04: every
// Hold'em testid is DOM-absent while mode is blackjack, even after a deal and an open card
// picker), and persistence (D-07: Hold'em state and settled odds survive the round trip with no
// re-simulation — a cache hit, not a coincidentally-identical fresh run). The fourth angle — the
// switch-mid-deal race (D-08) — lives in the sibling App.modeSwitchRace.test.tsx, which needs a
// file-scoped real-motion vi.mock this file must NOT carry (see that file's own top comment).
// Sibling to App.test.tsx/App.acceptance.test.tsx/App.phase3.acceptance.test.tsx, deliberately
// not an edit to any of them (D-09) — same precedent as Phase 4's shoePath.guard.test.ts.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's/App.acceptance.test.tsx's existing mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

// Same explicit-factory rationale, for the blackjack transport (06-07): <App /> now reaches
// the blackjack service through <BlackjackGame />, and this file's new mirror-image sweep
// seeds player-turn rounds whose odds effect genuinely starts runs — the factory lists BOTH
// exports so no real Comlink call (or Worker construction) is ever attempted under jsdom.
vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

/** Bumped on every mocked `startSimulation` call so each call's streamed snapshot is
 * recognisably distinct (win% climbs by 1 each call) — lets a cache-hit assertion prove "no NEW
 * call happened" rather than merely "the call count didn't change by coincidence". Mirrors
 * App.acceptance.test.tsx's own harness. */
let callIndex = 0;

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  // The blackjack round store resets alongside the Hold'em one (06-07): back to its exact
  // initial shape, BEFORE resetAnimations() below for the same reason as gameStore.
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
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
  usePickerStore.getState().clearAll();
  useGameModeStore.setState({ mode: 'holdem' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockReset();
  vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mockReset();
  callIndex = 0;

  // Records a per-call-distinct win% (climbing by 1 each call) and immediately streams ONE
  // settled (done: true) snapshot, so a served cached value is distinguishable from a
  // coincidentally-identical fresh run.
  vi.mocked(simulationService.startSimulation).mockImplementation(
    async (_conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      const index = callIndex++;
      const win = 50 + index;
      const lose = 50 - index;
      onProgress({
        requestId: 1,
        categoryCounts: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        outcomes: { win, tie: 0, lose },
        trialsCompleted: 100,
        done: true,
      });
    },
  );

  // The blackjack mirror: one settled, internally-consistent snapshot per call (every tally
  // group sums to trialsCompleted, so the dev-only store consistency guard stays silent).
  vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockImplementation(
    async (
      _conditioned: BlackjackConditionedState,
      onProgress: (snapshot: BlackjackProgressSnapshot) => void,
    ) => {
      onProgress({
        requestId: 1,
        dealerOutcomeCounts: [40, 10, 10, 10, 10, 10, 10],
        bustIfHitCount: 30,
        standOutcomes: { win: 50, push: 10, lose: 40 },
        hitOutcomes: { win: 45, push: 5, lose: 50 },
        trialsCompleted: 100,
        done: true,
      });
    },
  );
}

/** Clicks Deal and lets the settled-snapshot mock implementation flush synchronously — mirrors
 * every existing App-level acceptance test's flow (no extra `waitFor` needed since the mock
 * calls `onProgress` before its first `await`). */
async function dealAndSettle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^deal$/i }));
}

// The HOLDEM_ONLY_TESTIDS list swept below now lives in src/test/holdemTestids.ts (D-07,
// 05-REVIEW IN-02): one exported source of truth shared with App.modeSwitch.test.tsx, so the
// two sweeps can never diverge again. `empty-hand-state` remains the one entry whose presence
// condition is mutually exclusive with every other entry — see the conditional setup in the
// sweep below.

describe("gameStore & pickerStore snapshot equality across a Hold'em -> Blackjack -> Hold'em round trip (D-06)", () => {
  beforeEach(() => {
    resetStores();
  });

  it('gameStore and pickerStore state is toEqual its pre-switch snapshot after the round trip', async () => {
    const user = userEvent.setup();
    render(<App />);

    await dealAndSettle(user);
    // Guard: a hand genuinely settled before capturing the "before" snapshot — otherwise the
    // equality check below would be comparing two empty/default states, which proves nothing.
    expect(screen.getByTestId('win-pct')).toBeInTheDocument();

    const gameStoreSnapshotBefore = useGameStore.getState();
    const pickerStoreSnapshotBefore = usePickerStore.getState();

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    // Whole-object toEqual (not a field-by-field comparison): D-06's bar is that switching modes
    // never mutates gameStore/pickerStore at all, not merely that the fields we happened to think
    // to check are unchanged.
    expect(useGameStore.getState()).toEqual(gameStoreSnapshotBefore);
    expect(usePickerStore.getState()).toEqual(pickerStoreSnapshotBefore);
  });
});

describe('oddsStore.settledCache gains no new key while mode is blackjack, and no re-simulation happens (D-05/D-06)', () => {
  beforeEach(() => {
    resetStores();
  });

  // Deliberately NOT a whole-object toEqual on oddsStore's state (unlike gameStore/pickerStore
  // above): settledCache is a Map replaced copy-on-write on every cacheIfSettled() call
  // (oddsStore.ts), so comparing Map object identity or a snapshot of the whole store (including
  // the live-display fields, which legitimately reset to zero on every re-mount-free rerender)
  // would be meaningless. Comparing the sorted key SET is exactly D-06's stated bar: "no
  // oddsStore cache key is written while in blackjack mode."
  it('the settledCache key set is byte-identical before, during, and after a full Blackjack dwell', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    await dealAndSettle(user);
    expect(useGameStore.getState().runout).not.toBeNull();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    const callsBeforeSwitch = vi.mocked(simulationService.startSimulation).mock.calls.length;
    const keysBeforeSwitch = [...useOddsStore.getState().settledCache.keys()].sort();
    // Guard: cacheIfSettled() is a write-gate that no-ops on unsettled snapshots — this proves it
    // actually wrote a key, so the "unchanged" assertions below are non-vacuous.
    expect(keysBeforeSwitch.length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeSwitch);
    expect([...useOddsStore.getState().settledCache.keys()].sort()).toEqual(keysBeforeSwitch);

    // A rerender with unchanged store dependencies must not fire the odds effect either — the
    // mode gate is not merely "skips once right after the click", it holds for the entire time
    // spent in Blackjack mode.
    rerender(<App />);
    await act(async () => {});

    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeSwitch);
    expect([...useOddsStore.getState().settledCache.keys()].sort()).toEqual(keysBeforeSwitch);

    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    // Returning to Hold'em at the exact same (street, revealedMask) is a cache hit: still no new
    // call, still no new key beyond the pre-switch set.
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeSwitch);
    expect([...useOddsStore.getState().settledCache.keys()].sort()).toEqual(keysBeforeSwitch);
  });
});

describe('DOM-absence sweep — every Hold\'em testid is gone from the DOM once mode is blackjack, even after a deal and an open card picker (D-04)', () => {
  beforeEach(() => {
    resetStores();
  });

  it.each(HOLDEM_ONLY_TESTIDS)(
    "%s is present in Hold'em mode before the switch and absent from the DOM once mode is blackjack",
    async (testid) => {
      const user = userEvent.setup();
      render(<App />);

      if (testid === 'empty-hand-state') {
        // The one entry whose presence condition requires NO deal — every other entry below
        // requires a completed deal (and, for board-cards specifically, an advanced street) to be
        // non-vacuously present.
      } else {
        await dealAndSettle(user);
        // Advances past pre-flop so 'board-cards' (not 'board-empty-state') is genuinely on
        // screen — otherwise its absence assertion after switching would be vacuously true.
        await user.click(screen.getByTestId('advance-button'));
        // Opens the card-picker disclosure (D-04's action instruction) — otherwise 'card-picker',
        // 'picker-panel', and the picker-slot/-clear testids would never have existed in the DOM
        // in the first place, making their absence in Blackjack mode prove nothing.
        await user.click(screen.getByTestId('set-up-scenario-button'));
      }

      expect(
        screen.getByTestId(testid),
        `expected ${testid} to be present in Hold'em mode before switching to Blackjack — an absence assertion against a testid that was never present proves nothing`,
      ).toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-blackjack'));

      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    },
  );

  it("the untestid'd Hold'em Deal button is present before the switch, and every Deal-named button in Blackjack mode is Blackjack's own", async () => {
    // RETARGETED (06-07, D-04 -> D-13/BJ-05): Blackjack now legitimately owns a Deal button
    // with the same accessible name, so "no button named Deal exists" can no longer express
    // D-04. The Hold'em Deal button is identifiable by its LACK of a data-testid — asserting
    // every Deal-named button carries the blackjack testid proves the untestid'd Hold'em one
    // is unmounted, which is exactly what the original assertion pinned.
    const user = userEvent.setup();
    render(<App />);

    const holdemDeal = screen.getByRole('button', { name: /^deal$/i });
    expect(holdemDeal).toBeInTheDocument();
    expect(holdemDeal).not.toHaveAttribute('data-testid');

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const dealButtons = screen.getAllByRole('button', { name: /^deal$/i });
    expect(dealButtons).toHaveLength(1);
    expect(dealButtons[0]).toHaveAttribute('data-testid', 'blackjack-deal-button');
  });
});

describe('Mirror-image DOM-absence sweep — every blackjack-* testid is gone from the DOM once mode is holdem (D-04/D-14, BJ-01 symmetry)', () => {
  beforeEach(() => {
    resetStores();
  });

  /** A deterministic mid-round (player-turn) blackjack state, seeded directly BEFORE the
   * switch to Blackjack so the felt mounts with it (no store action fires, so no gate unit is
   * armed and BlackjackTable's prevRef release initialises to these values — nothing to
   * steal). Kh/Qc vs 9d upcard: no natural on either side, so the odds effect genuinely runs
   * against the mocked service. */
  function seedPlayerTurn(overrides: Partial<ReturnType<typeof useBlackjackStore.getState>> = {}) {
    useBlackjackStore.setState({
      round: { dealerUpcard: '9d' as Card, dealerHole: '6s' as Card },
      playerHand: ['Kh', 'Qc'] as Card[],
      dealerPlayoutCards: [] as Card[],
      roundPhase: 'player-turn',
      revealedHole: false,
      outcome: null,
      playerNaturalWin: false,
      deckCount: 1,
      roundNonce: 1,
      ...overrides,
    });
  }

  it.each(BLACKJACK_ONLY_TESTIDS)(
    "%s is present in Blackjack mode before the switch and absent from the DOM once mode is holdem",
    async (testid) => {
      const user = userEvent.setup();
      render(<App />);

      // Present-then-absent structure mirroring the Hold'em sweep above: each entry's
      // presence precondition is established first, so no absence check is vacuous.
      if (testid === 'blackjack-empty-state') {
        // The one entry whose presence condition requires roundPhase === 'idle' — mutually
        // exclusive with every seeded-round entry below (the A10 idle block).
      } else if (testid === 'blackjack-outcome-banner') {
        // The banner renders only while resolved with the gate clear — a seeded resolved
        // round (stand-shaped: hole revealed, outcome set) makes it genuinely present.
        seedPlayerTurn({ roundPhase: 'resolved', revealedHole: true, outcome: 'win' });
      } else if (testid === 'blackjack-dealer-total') {
        // The dealer total is DOM-absent while the hole is hidden (A11) — seed a revealed
        // player-turn round so the span exists.
        seedPlayerTurn({ revealedHole: true });
      } else if (testid === 'blackjack-simulation-error' || testid === 'blackjack-simulation-error-detail') {
        // The error banner requires a failed run: the mocked service reports onError for
        // this test only, and the seeded player-turn round makes the odds effect start it.
        vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockImplementation(
          async (
            _conditioned: BlackjackConditionedState,
            _onProgress: (snapshot: BlackjackProgressSnapshot) => void,
            onError: (message: string) => void,
          ) => {
            onError('injected-crash');
          },
        );
        seedPlayerTurn();
      } else {
        // Every other entry (scene, areas, cards, labels, controls, panel, all 13 stat
        // cells, the trial counter, the deck origin, the reveal button, the toggle) is
        // present for any seeded player-turn round.
        seedPlayerTurn();
      }

      await user.click(screen.getByTestId('game-mode-switch-blackjack'));

      expect(
        screen.getByTestId(testid),
        `expected ${testid} to be present in Blackjack mode before switching to Hold'em — an absence assertion against a testid that was never present proves nothing`,
      ).toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-holdem'));

      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    },
  );
});

describe("Hold'em state persists across the round trip and settled odds are restored from the cache with no re-simulation (D-07)", () => {
  beforeEach(() => {
    resetStores();
  });

  it('runout/street/revealedMask/dealNonce and the displayed win% are unchanged, and startSimulation is not called again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await dealAndSettle(user);

    const gameStoreBefore = useGameStore.getState();
    const winPctBefore = screen.getByTestId('win-pct').textContent;
    const callsBefore = vi.mocked(simulationService.startSimulation).mock.calls.length;
    // Guard: a real run actually happened before the round trip — otherwise "call count
    // unchanged" would be trivially true.
    expect(callsBefore).toBeGreaterThan(0);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(useGameStore.getState().runout).toBe(gameStoreBefore.runout);
    expect(useGameStore.getState().street).toBe(gameStoreBefore.street);
    expect(useGameStore.getState().revealedMask).toBe(gameStoreBefore.revealedMask);
    expect(useGameStore.getState().dealNonce).toBe(gameStoreBefore.dealNonce);
    expect(screen.getByTestId('table-scene')).toBeInTheDocument();

    // A CACHE HIT, not merely "some number is on screen": because the mock's win% climbs by 1
    // every time startSimulation is actually called, an unchanged win-pct text combined with an
    // unchanged call count proves the odds effect served the settled cache rather than re-running.
    expect(screen.getByTestId('win-pct').textContent).toBe(winPctBefore);
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBefore);
  });
});
