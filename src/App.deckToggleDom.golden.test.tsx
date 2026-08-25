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

// ============================================================================
// BYTE-FROZEN NINE-STATE DOM GOLDEN — DO NOT REGENERATE (08-CONTEXT D-06,
// 08-UI-SPEC A2).
//
// Captured at commit b44f6c6, on the tree that still contained BOTH inline deck
// toggles (the pre-extraction BlackjackControls.tsx and HoldemGame.tsx). Every
// frozen constant below is a verbatim transcription of
// `screen.getByTestId('{prefix}').outerHTML` as the SHIPPED INLINE markup
// serialized it — captured from a live run, never authored by hand.
//
// A failure in this file means the rendered toggle DOM changed: a D-06
// ("renders byte-identical DOM per game") / UI-SPEC A2 ("per-state outerHTML
// equivalence, including attribute order") violation. Regenerating the
// constants to make this suite pass is PROHIBITED — fix the component so it
// renders the frozen bytes instead. This file is the permanent drift detector
// for the Phase 8 extraction: it was committed GREEN against the inline
// toggles BEFORE the shared component existed, so it pins what the old code
// did, not what the new code happens to do.
//
// The guard titles contain U+2014 EM DASH — the character is load-bearing and
// must never be retyped as a hyphen.
// ============================================================================

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.holdemDeckToggle.test.tsx's mocks.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

// Same explicit-factory rationale: <App /> reaches the blackjack service through
// <BlackjackGame />'s import graph even while mode stays 'holdem', and the blackjack golden
// states below genuinely mount <BlackjackGame /> with a live round.
vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const startSim = vi.mocked(simulationService.startSimulation);

/** Locked Hold'em fresh-deal title (07-UI-SPEC Copywriting Contract — verbatim). State 9's
 * explicit absence assertion names this string so a precedence regression names itself. */
const FRESH_DEAL_TITLE = 'Switching the shoe deals a fresh hand';

let callIndex = 0;

/** Internally consistent settled snapshot (category and outcome sums both equal
 * trialsCompleted, so the dev-only store consistency guard stays silent). 10-entry
 * categoryCounts at 1 deck, 11 at 2 decks — the shipped length contract. */
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
  // deckCount: 1 belongs in BOTH game-store resets: this file drives the deck count in every
  // test, and a 2-deck leak across tests would make a 1-deck golden comparison wrong while
  // looking like a flake (the App.holdemDeckToggle.test.tsx harness rationale, copied).
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

// ============================================================================
// The nine frozen constants. CAPTURED, not authored (see the file header):
// transcribed verbatim from a `console.log(outerHTML)` run against the inline
// toggles at commit b44f6c6, logs then removed. Wrapper serializes
// `data-testid`, `role`, `aria-label` in that order; each segment serializes
// `type`, `data-testid`, `aria-pressed`, then `disabled` only when disabled,
// then `title` only when present. React omits `disabled`/`title` entirely for
// `false`/`undefined`; JSX collapses the multi-line label children to exactly
// `1 deck` / `2 decks` with no whitespace text nodes between the two buttons.
// ============================================================================

/** State 1 — Blackjack idle at 1 deck (`round: null`, `deckCount: 1`). */
const BJ_IDLE_1_DECK =
  '<div data-testid="blackjack-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="blackjack-deck-toggle-1" aria-pressed="true">1 deck</button><button type="button" data-testid="blackjack-deck-toggle-2" aria-pressed="false">2 decks</button></div>';

/** State 2 — Blackjack idle at 2 decks (`round: null`, `deckCount: 2`). */
const BJ_IDLE_2_DECKS =
  '<div data-testid="blackjack-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="blackjack-deck-toggle-1" aria-pressed="false">1 deck</button><button type="button" data-testid="blackjack-deck-toggle-2" aria-pressed="true">2 decks</button></div>';

/** State 3 — Blackjack A3 guard tripped at 2 decks (hidden-hole duplicate fixture): segment 1
 * serializes `disabled=""` plus the locked blackjack guard title; segment 2 serializes
 * neither `disabled` nor `title`. */
const BJ_GUARD_2_DECKS =
  '<div data-testid="blackjack-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="blackjack-deck-toggle-1" aria-pressed="false" disabled="" title="The dealt cards include a duplicate — impossible with one deck">1 deck</button><button type="button" data-testid="blackjack-deck-toggle-2" aria-pressed="true">2 decks</button></div>';

/** State 4 — Hold'em idle at 1 deck: no title on either segment. */
const HE_IDLE_1_DECK =
  '<div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="holdem-deck-toggle-1" aria-pressed="true">1 deck</button><button type="button" data-testid="holdem-deck-toggle-2" aria-pressed="false">2 decks</button></div>';

/** State 5 — Hold'em idle at 2 decks: no title on either segment. */
const HE_IDLE_2_DECKS =
  '<div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="holdem-deck-toggle-1" aria-pressed="false">1 deck</button><button type="button" data-testid="holdem-deck-toggle-2" aria-pressed="true">2 decks</button></div>';

/** State 6 — Hold'em mid-hand at 1 deck: the inactive segment 2 carries the fresh-deal title,
 * segment 1 carries none (07 A3). */
const HE_MID_HAND_1_DECK =
  '<div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="holdem-deck-toggle-1" aria-pressed="true">1 deck</button><button type="button" data-testid="holdem-deck-toggle-2" aria-pressed="false" title="Switching the shoe deals a fresh hand">2 decks</button></div>';

/** State 7 — Hold'em mid-hand at 2 decks: the inactive segment 1 carries the fresh-deal title,
 * segment 2 carries none (07 A3, roles swapped). */
const HE_MID_HAND_2_DECKS =
  '<div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="holdem-deck-toggle-1" aria-pressed="false" title="Switching the shoe deals a fresh hand">1 deck</button><button type="button" data-testid="holdem-deck-toggle-2" aria-pressed="true">2 decks</button></div>';

/** States 8 AND 9 — Hold'em duplicate picks at 2 decks, idle (8) and MID-HAND (9). One shared
 * constant is the point: state 9's byte-for-byte equality with state 8 IS the A4-beats-A3
 * precedence proof — the fresh-deal title must NOT appear on the guarded segment 1, and
 * segment 2 gets no title because `deckCount === 2`. */
const HE_PICKS_GUARD_2_DECKS =
  '<div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count"><button type="button" data-testid="holdem-deck-toggle-1" aria-pressed="false" disabled="" title="Your picked cards include a duplicate — impossible with one deck">1 deck</button><button type="button" data-testid="holdem-deck-toggle-2" aria-pressed="true">2 decks</button></div>';

describe('blackjack deck-toggle DOM golden (states 1-3)', () => {
  it('state 1: idle at 1 deck renders the frozen bytes', () => {
    useGameModeStore.setState({ mode: 'blackjack' });
    render(<App />);

    const html = screen.getByTestId('blackjack-deck-toggle').outerHTML;
    expect(html).toBe(BJ_IDLE_1_DECK);
  });

  it('state 2: idle at 2 decks renders the frozen bytes', () => {
    useGameModeStore.setState({ mode: 'blackjack' });
    useBlackjackStore.setState({ deckCount: 2 });
    render(<App />);

    const html = screen.getByTestId('blackjack-deck-toggle').outerHTML;
    expect(html).toBe(BJ_IDLE_2_DECKS);
  });

  it('state 3: hidden-hole duplicate guard at 2 decks renders the frozen bytes', () => {
    useGameModeStore.setState({ mode: 'blackjack' });
    // The 06-REVIEW WR-01 hidden-hole fixture (App.blackjackLoop.test.tsx precedent): player
    // 5c 8d, upcard 9s, hole 5c (hidden) — no VISIBLE duplicate, yet "1 deck" must disable
    // because the hole is a real dealt card. Seeded BEFORE render so the felt mounts with it.
    useBlackjackStore.setState({
      round: { dealerUpcard: '9s' as Card, dealerHole: '5c' as Card },
      playerHand: ['5c', '8d'] as Card[],
      dealerPlayoutCards: [] as Card[],
      roundPhase: 'player-turn',
      revealedHole: false,
      outcome: null,
      playerNaturalWin: false,
      deckCount: 2,
      roundNonce: 1,
    });
    render(<App />);

    const html = screen.getByTestId('blackjack-deck-toggle').outerHTML;
    expect(html).toBe(BJ_GUARD_2_DECKS);
  });
});

describe("Hold'em deck-toggle DOM golden (states 4-9)", () => {
  it('state 4: idle at 1 deck renders the frozen bytes', () => {
    render(<App />);

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    expect(html).toBe(HE_IDLE_1_DECK);
  });

  it('state 5: idle at 2 decks renders the frozen bytes', () => {
    render(<App />);
    act(() => {
      useGameStore.setState({ deckCount: 2 });
    });

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    expect(html).toBe(HE_IDLE_2_DECKS);
  });

  it('state 6: mid-hand at 1 deck renders the frozen bytes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    expect(html).toBe(HE_MID_HAND_1_DECK);
  });

  it('state 7: mid-hand at 2 decks renders the frozen bytes', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => {
      useGameStore.setState({ deckCount: 2 });
    });

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    expect(html).toBe(HE_MID_HAND_2_DECKS);
  });

  it('state 8: duplicate picks at 2 decks, idle, renders the frozen bytes', () => {
    render(<App />);

    // FIRST move the store to 2 decks — the harness resets deckCount to 1, and setPick's
    // third argument alone does not move the store (checker MINOR-1). THEN pick two copies
    // of the same value, which is legal at 2 decks and the only state that can make one
    // deck impossible.
    act(() => {
      useGameStore.setState({ deckCount: 2 });
    });
    act(() => {
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('hero-1', 'As', 2);
    });

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    expect(html).toBe(HE_PICKS_GUARD_2_DECKS);
  });

  it('state 9: duplicate picks at 2 decks MID-HAND renders byte-identically to state 8 — the A4-beats-A3 precedence proof', async () => {
    const user = userEvent.setup();
    render(<App />);

    act(() => {
      useGameStore.setState({ deckCount: 2 });
    });
    act(() => {
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('hero-1', 'As', 2);
    });
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const html = screen.getByTestId('holdem-deck-toggle').outerHTML;
    // Byte-for-byte the SAME constant as state 8: mid-hand changes nothing, because the A4
    // guard title takes precedence over the A3 fresh-deal title on segment 1, and segment 2
    // carries no title while it is the active segment (deckCount === 2).
    expect(html).toBe(HE_PICKS_GUARD_2_DECKS);
    // Explicit precedence tripwire: if a regression ever swapped the A4/A3 precedence, the
    // fresh-deal title would appear here and this assertion would name it directly.
    expect(html).not.toContain(FRESH_DEAL_TITLE);
  });
});
