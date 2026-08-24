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

const BLACKJACK_HEADING = 'The Blackjack table deals next';
const BLACKJACK_BODY =
  "Player hand, dealer upcard, live bust and outcome odds, and Stand-vs-Hit choices land here next. Switch back to Hold'em to keep watching odds converge now.";

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

describe('App mode switch — clicking Blackjack mounts the honest placeholder (D-03)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('mounts blackjack-scene and blackjack-empty-state with the exact locked copy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const scene = screen.getByTestId('blackjack-scene');
    expect(scene).toBeInTheDocument();
    const emptyState = screen.getByTestId('blackjack-empty-state');
    expect(emptyState).toBeInTheDocument();

    const heading = emptyState.querySelector('h2');
    const body = emptyState.querySelector('p');
    expect(heading).not.toBeNull();
    expect(body).not.toBeNull();
    expect(heading?.textContent).toBe(BLACKJACK_HEADING);
    expect(body?.textContent).toBe(BLACKJACK_BODY);
  });

  it('the blackjack-scene subtree contains zero <button> elements', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    const scene = screen.getByTestId('blackjack-scene');
    expect(scene.querySelectorAll('button')).toHaveLength(0);
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

  it('the Deal button (no testid of its own, queried by accessible name) is absent while mode is blackjack', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.queryByRole('button', { name: /^deal$/i })).not.toBeInTheDocument();
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
