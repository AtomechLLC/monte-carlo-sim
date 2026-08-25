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
import type { DeckCount } from './engine/shoe';
import type { Card } from '@poker-apprentice/types';

// Phase 7 D-03 cache guard plus the full deck-toggle behavioral suite (07-05, HE2-01).
//
// D-03 (07-CONTEXT): the Hold'em odds cache key carries NO deckCount dimension — the key stays
// `${street}|${revealedMask}`. That is only sound because a deck toggle ALWAYS passes through
// deal()'s cache clear: toggle -> fresh deal -> cache cleared makes the key unambiguous within
// a hand. The load-bearing tests below pin exactly that, in BOTH toggle directions — if any
// path ever lets a toggle skip deal(), a 1-deck settled entry becomes servable at 2 decks (or
// vice versa), and a cache-served number is otherwise indistinguishable from a fresh one
// (T-07-24). The rest of the file pins the D-02 lifecycle (idle set / mid-hand fresh deal /
// already-active no-op) and the A2/A3/A4 affordances row by row from the 07-UI-SPEC contract.
//
// Deliberately a NEW sibling file: the five frozen v1 suites (App.test.tsx,
// App.acceptance.test.tsx, App.phase3.acceptance.test.tsx, App.modeErrorBanner.test.tsx,
// App.modeSwitchRace.test.tsx) and App.holdemCachePoison.test.tsx must not be edited (D-11) —
// same precedent as App.modeIsolation.test.tsx.
//
// jsdom forces prefers-reduced-motion: reduce, so every toggle-triggered re-deal completes
// synchronously inside the userEvent click — tests assert END STATES only, never frames.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.holdemCachePoison.test.tsx's mocks.
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

/** Locked A3/A4 title copy (07-UI-SPEC Copywriting Contract — verbatim). */
const FRESH_DEAL_TITLE = 'Switching the shoe deals a fresh hand';
const DUPLICATE_PICK_GUARD_TITLE =
  'Your picked cards include a duplicate — impossible with one deck';

/** Bumped per default-implementation call so each run's settled win count is recognisably
 * distinct — a cache-served value is distinguishable from a coincidentally-identical fresh
 * run (the App.holdemCachePoison.test.tsx harness convention). */
let callIndex = 0;

/** Internally consistent settled snapshot (category and outcome sums both equal
 * trialsCompleted, so the dev-only store consistency guard stays silent).
 *
 * The length asymmetry IS the contract (plan 07-03's grow-on-merge behaviour): a 1-deck run's
 * categoryCounts is TEN entries long, a 2-deck run's is ELEVEN (index 10 = Five of a Kind) —
 * the widened dev guard accepts exactly this two-member family, and a fixture of the wrong
 * length for its deck count would misrepresent what the worker actually emits. */
function settledSnapshot(win: number, deckCount: DeckCount = 1): ProgressSnapshot {
  const categoryCounts =
    deckCount === 2
      ? [99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
      : [100, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return {
    requestId: 1,
    categoryCounts,
    outcomes: { win, tie: 0, lose: 100 - win },
    trialsCompleted: 100,
    done: true,
  };
}

function resetStores() {
  // deckCount: 1 belongs in this reset (unlike older App-level harnesses): this file drives
  // the deck count in almost every test, and pickerStore picks in the A4 tests — leakage of
  // either across tests would be silent and profoundly confusing (a 2-deck leak makes every
  // 1-deck assertion wrong while looking like a flake). clearAll() below covers the picks.
  useGameStore.setState({
    runout: null,
    street: 'preflop',
    revealedMask: 0,
    dealNonce: 0,
    deckCount: 1,
  });
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
    async (conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      onProgress(settledSnapshot(50 + callIndex++, conditioned.deckCount ?? 1));
    },
  );
}

beforeEach(() => {
  resetStores();
});

describe('D-03 cache guard: a deck toggle always passes through deal()\'s cache clear', () => {
  it('1 -> 2: no path may reuse a 1-deck settled entry in 2-deck mode (D-03)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Deal at 1 deck and let the mocked run settle: win 50 (call index 0) is displayed AND
    // cached under the preflop|0 knowledge key.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(startSim).toHaveBeenCalledTimes(1);
    expect(useOddsStore.getState().outcomes.win).toBe(50);
    expect(useOddsStore.getState().getCached('preflop', 0)?.outcomes.win).toBe(50);

    // Toggle to 2 decks mid-hand. A path that skipped deal()'s cache clear would hit the
    // 1-deck settled entry at the SAME preflop|0 key, display win 50, and start NO run —
    // silently serving 1-deck odds for a 2-deck shoe.
    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    expect(startSim).toHaveBeenCalledTimes(2);
    // The displayed numbers are the FRESH run's distinct values (call index 1 -> win 51),
    // never the settled 1-deck values.
    expect(useOddsStore.getState().outcomes.win).toBe(51);
    // And the cache entry under the same key is the fresh run's, not the 1-deck entry's.
    const cached = useOddsStore.getState().getCached('preflop', 0);
    expect(cached?.outcomes.win).toBe(51);
    expect(cached?.outcomes.win).not.toBe(50);
    // The fresh entry carries the 2-deck histogram shape — proof the run was conditioned on
    // the new shoe, not replayed from the old one.
    expect(cached?.categoryCounts).toHaveLength(11);
  });

  it('2 -> 1: no path may reuse a 2-deck settled entry in 1-deck mode (D-03, mirrored)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Reach 2 decks via the UI's own idle path (D-02: silent field set, no run), then deal.
    await user.click(screen.getByTestId('holdem-deck-toggle-2'));
    expect(startSim).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(startSim).toHaveBeenCalledTimes(1);
    expect(useOddsStore.getState().outcomes.win).toBe(50);
    expect(useOddsStore.getState().getCached('preflop', 0)?.categoryCounts).toHaveLength(11);

    // Toggle back down to 1 deck mid-hand — the same guard must hold in this direction.
    await user.click(screen.getByTestId('holdem-deck-toggle-1'));

    expect(startSim).toHaveBeenCalledTimes(2);
    expect(useOddsStore.getState().outcomes.win).toBe(51);
    const cached = useOddsStore.getState().getCached('preflop', 0);
    expect(cached?.outcomes.win).toBe(51);
    expect(cached?.outcomes.win).not.toBe(50);
    expect(cached?.categoryCounts).toHaveLength(10);
  });
});

describe('D-02 lifecycle: idle set, mid-hand fresh deal, already-active no-op', () => {
  it('an idle click flips aria-pressed, leaves dealNonce unchanged, and starts no run', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(useGameStore.getState().dealNonce).toBe(0);
    expect(startSim).not.toHaveBeenCalled();
  });

  it('a mid-hand click bumps dealNonce by exactly 1, resets to preflop with mask 0, empties the cache, and starts a new run', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Build a non-trivial knowledge state first: deal, advance to the flop, reveal opponent 0
    // — three runs (preflop|0, flop|0, flop|1), three settled cache entries.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('opponent-seat-0'));
    expect(startSim).toHaveBeenCalledTimes(3);
    expect(useGameStore.getState().dealNonce).toBe(1);
    expect(useGameStore.getState().street).toBe('flop');
    expect(useGameStore.getState().revealedMask).toBe(1);
    expect(useOddsStore.getState().settledCache.size).toBe(3);

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    // The full D-02 fresh-deal choreography, asserted as end states: dealNonce +1 exactly,
    // street back to preflop, reveal mask 0, the settled cache emptied by deal() and holding
    // only the fresh hand's new preflop entry, and a NEW run started.
    expect(useGameStore.getState().dealNonce).toBe(2);
    expect(useGameStore.getState().street).toBe('preflop');
    expect(useGameStore.getState().revealedMask).toBe(0);
    expect(startSim).toHaveBeenCalledTimes(4);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
    expect(useOddsStore.getState().getCached('preflop', 0)?.outcomes.win).toBe(53);
  });

  it('clicking the already-active segment changes nothing — reference-identical store state, no new run', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(startSim).toHaveBeenCalledTimes(1);
    const stateBefore = useGameStore.getState();

    await user.click(screen.getByTestId('holdem-deck-toggle-1'));

    // The store's same-value early return means NO set() ran — the whole store object is
    // reference-identical, which subsumes every field-level "unchanged" assertion.
    expect(useGameStore.getState()).toBe(stateBefore);
    expect(useGameStore.getState().dealNonce).toBe(1);
    expect(startSim).toHaveBeenCalledTimes(1);
  });
});

describe('A2/A3/A4 affordances: placement, fresh-deal disclosure, duplicate-pick guard', () => {
  // RETARGETED 2026-08-25 (control-bar reorganization) — never deleted, never weakened, per the
  // same standing rule App.modeShell.guard.test.ts states for its own pins.
  //
  // WHY: A2 pinned the toggle as `.control-bar`'s LAST ELEMENT CHILD, which was the only way to
  // say "the shoe control sits at the end of the context cluster" while the bar was ONE FLAT
  // ROW of five unrelated controls. The user asked for that row to be reorganized ("the
  // controls for running the simulator are haphazard, please reorganize the UI"), and then for
  // a specific placement: "leave the mode buttons above [the table]" while "the action buttons
  // ... float over the bottom left of the table". So the flat bar is gone. What is left above
  // the felt is the SESSION bar — the game-mode switcher and the shoe — and the toggle is still
  // its last child, still the trailing control of the "what am I playing" cluster, now pushed
  // to the far edge by the bar's space-between. Every semantic half of this assertion — role,
  // accessible name, both segment labels — is untouched below.
  //
  // This is the obsolete-by-intent case, not a drifted-implementation case: the assertion is
  // red because the user changed the design, and the retarget records that. It must NOT be
  // relaxed to a bare `toBeInTheDocument()` — placement is the whole point of A2.
  it("the toggle is the LAST child of the session bar above the felt, with the locked group semantics and labels (A2, retargeted)", () => {
    render(<App />);

    const toggle = screen.getByTestId('holdem-deck-toggle');
    const sessionBar = document.querySelector('.control-bar--session');
    expect(sessionBar).not.toBeNull();
    expect(sessionBar!.lastElementChild).toBe(toggle);
    // …and that bar really is ABOVE the felt, which is the other half of what the user asked
    // for. compareDocumentPosition is the honest form of "above" available in a harness that
    // lays nothing out: the bar must PRECEDE the table scene in document order.
    const scene = screen.getByTestId('table-scene');
    expect(
      sessionBar!.compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the session bar must come before the felt — "leave the mode buttons above it"',
    ).toBeTruthy();
    expect(toggle).toHaveAttribute('role', 'group');
    expect(toggle).toHaveAttribute('aria-label', 'Deck count');
    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveTextContent('1 deck');
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveTextContent('2 decks');
  });

  it('the fresh-deal title sits on the INACTIVE segment only while a hand is on the table (A3)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Idle: NO title on either segment.
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute('title');

    // Mid-hand at 1 deck: the inactive "2 decks" segment carries the disclosure, the active
    // segment carries none.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('title', FRESH_DEAL_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');

    // After switching (fresh deal, now mid-hand at 2 decks): the roles swap.
    await user.click(screen.getByTestId('holdem-deck-toggle-2'));
    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('title', FRESH_DEAL_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute('title');
  });

  it('duplicated picks disable the 1-deck segment with the guard title, never touching the picks (A4)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));
    // Two copies of the same value at 2 decks — the only state that can make one deck
    // impossible (the on-table hand never blocks; D-02's fresh deal discards it).
    act(() => {
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('hero-1', 'As', 2);
    });

    const segmentOne = screen.getByTestId('holdem-deck-toggle-1');
    expect(segmentOne).toBeDisabled();
    expect(segmentOne).toHaveAttribute('title', DUPLICATE_PICK_GUARD_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toBeDisabled();
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute(
      'title',
      DUPLICATE_PICK_GUARD_TITLE,
    );

    // An attempted click on the disabled segment modifies nothing: same picks (by reference
    // AND value), same deck count, no deal, no run.
    const picksBefore = usePickerStore.getState().picks;
    await user.click(segmentOne);
    expect(usePickerStore.getState().picks).toBe(picksBefore);
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
    expect(usePickerStore.getState().picks['hero-1']).toBe('As');
    expect(useGameStore.getState().deckCount).toBe(2);
    expect(useGameStore.getState().dealNonce).toBe(0);
    expect(startSim).not.toHaveBeenCalled();

    // Clearing the duplicate re-enables the segment in the same render.
    act(() => {
      usePickerStore.getState().clearSlot('hero-1');
    });
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toBeDisabled();
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');
  });
});

describe('conditioned payload: the effect hands deckCount and the 102-card shoe to the worker boundary', () => {
  it('at 2 decks, startSimulation\'s first argument carries deckCount: 2 and a 102-card remainingDeck at preflop with no reveals', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(startSim).toHaveBeenCalledTimes(1);
    // Read the mocked call's FIRST ARGUMENT — the payload that actually crosses the worker
    // boundary — never a store field that might coincidentally agree with it.
    const conditioned = startSim.mock.calls[0][0];
    expect(conditioned.deckCount).toBe(2);
    // 104-card shoe minus the 2 known hero hole cards; hidden board and hidden opponent
    // holes stay in the unknown pool at preflop with no reveals.
    expect(conditioned.remainingDeck).toHaveLength(102);
    expect(conditioned.knownBoard).toHaveLength(0);
    expect(conditioned.knownOpponentHoles).toEqual([null, null, null]);
  });
});

describe('focus and keyboard', () => {
  it('a segment activates from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);

    act(() => {
      screen.getByTestId('holdem-deck-toggle-2').focus();
    });
    await user.keyboard('{Enter}');

    expect(useGameStore.getState().deckCount).toBe(2);
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
  });

  it('focus stays on the clicked segment across the fresh deal it triggers — no forced focus movement', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    const segmentTwo = screen.getByTestId('holdem-deck-toggle-2');

    await user.click(segmentTwo);

    // The fresh deal really happened...
    expect(useGameStore.getState().dealNonce).toBe(2);
    // ...and the clicked segment kept focus through it (the control bar is stable across
    // deals — only the felt re-mounts).
    expect(document.activeElement).toBe(segmentTwo);
  });
});
