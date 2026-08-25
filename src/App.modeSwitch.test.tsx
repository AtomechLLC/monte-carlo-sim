import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';
import { HOLDEM_ONLY_TESTIDS } from './test/holdemTestids';

// End-to-end happy-path proof of the Phase 5 mode switch (D-01/D-03/D-04). This file protects:
//   D-01 — a segmented two-button `game-mode-switcher` control, visible in BOTH modes, with
//          `aria-pressed` (not a disabled state) carrying which game is active.
//   D-03 — Blackjack mode shows only the honest `blackjack-empty-state` placeholder with zero
//          interactive gameplay controls.
//   D-04 — while `mode === 'blackjack'`, NOT ONE Hold'em testid (nor the untestid'd Deal button)
//          may exist anywhere in the DOM — the Hold'em subtree is unmounted, not merely hidden.
// Sibling to App.test.tsx, deliberately not an edit to it (D-09 keeps the v1 acceptance suites as
// the untouched regression harness for "Hold'em works identically").

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's existing mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

// Same explicit-factory rationale as above, for the OTHER game's transport (06-07): from this
// plan onward <App /> reaches the blackjack service through <BlackjackGame />, so mounting App
// with only the poker mock would import the real blackjack service — and, through it,
// workerClient. 06-03's lazy construction keeps that import side-effect-free, but the mock is
// still required so no real Comlink call is ever attempted if the blackjack odds effect runs.
vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useGameModeStore.setState({ mode: 'holdem' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

// The D-04 sweep below runs against the shared HOLDEM_ONLY_TESTIDS list from
// src/test/holdemTestids.ts (D-07, 05-REVIEW IN-02 — this file previously carried a stale
// 12-entry subset of App.modeIsolation.test.tsx's 29-entry list). This file's sweep never
// deals a hand or opens the picker, so entries requiring a dealt hand are vacuously absent
// here — it is deliberately an absence-only SMOKE sweep of the pre-deal switch path;
// App.modeIsolation.test.tsx owns the non-vacuous present-then-absent proof for every entry.

// RETARGETED (06-07, D-03 -> D-13): these constants pinned the Phase 5 placeholder copy; the
// placeholder is retired, so they now pin the Phase 6 A10 idle block's locked copy (the
// retained `blackjack-empty-state` testid, new copy and page-level placement per 06-UI-SPEC).
const BLACKJACK_IDLE_HEADING = 'No round dealt yet';
const BLACKJACK_IDLE_BODY =
  'Click Deal to start a round. Switch the shoe between 1 and 2 decks to see the odds shift.';

describe("App mode switch — default mode is Hold'em with the switcher visible (D-01)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("renders the switcher pinned to Hold'em and the Hold'em tree mounted, with Blackjack absent", () => {
    render(<App />);

    expect(screen.getByTestId('game-mode-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('table-scene')).toBeInTheDocument();
    expect(screen.getByTestId('odds-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('blackjack-scene')).not.toBeInTheDocument();
  });

  it('the switcher wrapper carries role="group" and aria-label="Game mode", and neither button is disabled', () => {
    render(<App />);

    const wrapper = screen.getByTestId('game-mode-switcher');
    expect(wrapper).toHaveAttribute('role', 'group');
    expect(wrapper).toHaveAttribute('aria-label', 'Game mode');
    expect(screen.getByTestId('game-mode-switch-holdem')).not.toBeDisabled();
    expect(screen.getByTestId('game-mode-switch-blackjack')).not.toBeDisabled();
  });
});

describe('App mode switch — clicking Blackjack mounts the real Blackjack tree with the idle state (D-03 -> D-13)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('mounts blackjack-scene and the page-level blackjack-empty-state with the exact locked copy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const scene = screen.getByTestId('blackjack-scene');
    expect(scene).toBeInTheDocument();
    // A10 (06-07): the retained testid, its copy and placement replaced — the idle block now
    // lives page-level (OUTSIDE the felt, in the empty-hand-state document slot), so it is
    // deliberately NOT queried as a child of the scene any more.
    const emptyState = screen.getByTestId('blackjack-empty-state');
    expect(emptyState).toBeInTheDocument();

    const heading = emptyState.querySelector('h2');
    const body = emptyState.querySelector('p');
    expect(heading).not.toBeNull();
    expect(body).not.toBeNull();
    expect(heading?.textContent).toBe(BLACKJACK_IDLE_HEADING);
    expect(body?.textContent?.replace(/\s+/g, ' ').trim()).toBe(BLACKJACK_IDLE_BODY);
  });

  it('the blackjack-scene subtree contains exactly the on-felt controls: the hole reveal and the floating action cluster', async () => {
    // RETARGETED TWICE, never deleted (the guard file's standing rule applied to a behavioural
    // suite). Round one (06-07): the original zero-<button> assertion encoded Phase 5's D-03
    // ("the placeholder has no controls"), which Phase 6's D-13 superseded BY DESIGN — the real
    // table HAS controls — so it became "exactly ONE button, the hole reveal", with
    // Deal/Hit/Stand and the deck toggle asserted to live in the control bar OUTSIDE the scene.
    //
    // Round two (260825), the reason for this edit: the user asked to "move the action buttons
    // to float over the bottom left of the table". `.felt` is the positioning ancestor every
    // on-table element is anchored against, so floating ON the table means being a DOM CHILD of
    // this subtree — Deal/Hit/Stand moved inside it, and the census went 1 -> 4.
    //
    // What this test is FOR survives intact and is deliberately still an EXACT census rather
    // than a relaxed `toBeGreaterThan`: the felt subtree must contain precisely the controls
    // that belong on the table and nothing else. The shoe toggle in particular must NOT be here
    // — it is session context, it stays above the felt, and the explicit absence assertion
    // below is what keeps this retarget from quietly becoming "any number of buttons".
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const scene = screen.getByTestId('blackjack-scene');
    const sceneButtons = Array.from(scene.querySelectorAll('button'));
    expect(sceneButtons.map((button) => button.getAttribute('data-testid'))).toEqual([
      'blackjack-hole-reveal',
      'blackjack-deal-button',
      'blackjack-hit-button',
      'blackjack-stand-button',
    ]);

    // The session controls stay OFF the felt, above it — the other half of the user's split.
    expect(scene.contains(screen.getByTestId('blackjack-deck-toggle'))).toBe(false);
    expect(scene.contains(screen.getByTestId('game-mode-switcher'))).toBe(false);
    expect(screen.getByTestId('blackjack-deck-toggle')).toBeInTheDocument();
  });

  it('the switcher stays visible and aria-pressed flips to Blackjack', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.getByTestId('game-mode-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('game-mode-switch-holdem')).toBeInTheDocument();
    expect(screen.getByTestId('game-mode-switch-blackjack')).toBeInTheDocument();
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe("App mode switch — every Hold'em testid is DOM-absent in Blackjack mode (D-04)", () => {
  beforeEach(() => {
    resetStores();
  });

  it.each(HOLDEM_ONLY_TESTIDS)('%s is absent from the DOM while mode is blackjack', async (testid) => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
  });

  it("the untestid'd Hold'em Deal button is absent while mode is blackjack — every Deal-named button is Blackjack's own", async () => {
    // RETARGETED (06-07, D-04 -> D-13/BJ-05): Blackjack now legitimately owns a Deal button
    // with the same accessible name, so "no button named Deal exists" can no longer express
    // D-04. The Hold'em Deal button is identifiable by its LACK of a data-testid — asserting
    // every Deal-named button carries the blackjack testid proves the untestid'd Hold'em one
    // is unmounted, which is exactly what the original assertion pinned.
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const dealButtons = screen.getAllByRole('button', { name: /^deal$/i });
    expect(dealButtons).toHaveLength(1);
    expect(dealButtons[0]).toHaveAttribute('data-testid', 'blackjack-deal-button');
  });
});

describe("App mode switch — switching back to Hold'em restores the Hold'em tree (D-01/D-04)", () => {
  beforeEach(() => {
    resetStores();
  });

  it('restores table-scene and odds-panel and unmounts blackjack-scene', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    expect(screen.getByTestId('blackjack-scene')).toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(screen.getByTestId('table-scene')).toBeInTheDocument();
    expect(screen.getByTestId('odds-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('blackjack-scene')).not.toBeInTheDocument();
  });

  it("aria-pressed flips back to Hold'em and both switcher buttons remain in the document", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(screen.getByTestId('game-mode-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'false');
  });
});
