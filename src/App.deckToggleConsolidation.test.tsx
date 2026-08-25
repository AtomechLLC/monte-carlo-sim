import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
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
import { drawN } from './engine/rng';
import type { ProgressSnapshot } from './worker/protocol';
import type { BlackjackProgressSnapshot } from './worker/blackjackProtocol';
import type { ConditionedState } from './engine/equity';
import type { BlackjackConditionedState } from './engine/blackjackEquity';
import type { DeckCount } from './engine/shoe';
import type { Card } from '@poker-apprentice/types';

// Phase 8 CROSS-GAME consolidation suite: one describe per ROADMAP success criterion (SC1,
// SC2, SC3), each exercising BOTH games THROUGH the one shared <DeckCountToggle />, plus a
// fourth block re-proving each game's locked guard at the consolidated control.
//
// This suite ASSERTS SHIPPED BEHAVIOR and changes no logic (08-CONTEXT D-04): blackjack's
// synchronous reset + same-cards re-run (06 A3) and Hold'em's fresh-deal path (07 D-02 +
// CR-02 dealNonce guard + D-03 cache clear) both shipped before Phase 8 — what is new here is
// that DECK-02's second clause ("changing it cancels any in-flight simulation and recomputes
// all odds under the new shoe") is finally asserted as ONE contract through ONE control
// instead of twice, per game, against two inline toggles.
//
// SC1's proof is deliberately in THREE parts and only one of them is here. The other two:
//   - src/App.modeShell.guard.test.ts — the SOURCE-IDENTITY half (08-UI-SPEC A3): both call
//     sites import and render the shared module, neither retains the inline segmented markup,
//     and exactly one non-test src/ui component contains the group markup.
//   - src/App.deckToggleDom.golden.test.tsx — the BYTE-IDENTITY half (08-UI-SPEC A2): the
//     nine-state outerHTML golden captured against the PRE-extraction inline toggles.
// This file carries the RENDERED-CONTRACT half. Naming both files explicitly so the split is
// never mistaken for a gap.
//
// Deliberately a NEW sibling file: the five frozen v1 suites (App.test.tsx,
// App.acceptance.test.tsx, App.phase3.acceptance.test.tsx, App.modeErrorBanner.test.tsx,
// App.modeSwitchRace.test.tsx) and App.holdemCachePoison.test.tsx must not be edited (D-08 /
// D-11) — same precedent as App.modeIsolation.test.tsx and App.holdemDeckToggle.test.tsx.
//
// jsdom forces prefers-reduced-motion: reduce, so a toggle-triggered re-deal completes
// synchronously inside the userEvent click — every assertion below is an END STATE, never a
// frame.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Both services are mocked because <App /> reaches both games' import graphs whichever
// mode is on screen.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

// Deterministic blackjack deals over the REAL store actions (App.blackjackLoop.test.tsx's
// convention): an unscripted Deal lands a natural ~4.8% of the time, which would silently turn
// "the toggle starts one run" into "starts zero runs" (T-08-14).
vi.mock('./engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine/rng')>();
  return {
    ...actual,
    drawN: vi.fn(actual.drawN),
  };
});

const actualRng = await vi.importActual<typeof import('./engine/rng')>('./engine/rng');
const drawNMock = vi.mocked(drawN);

const startSim = vi.mocked(simulationService.startSimulation);
const startBlackjack = vi.mocked(blackjackSimulationService.startBlackjackSimulation);

/** Locked title copy, asserted verbatim below (08-UI-SPEC Copywriting Contract). */
const FRESH_DEAL_TITLE = 'Switching the shoe deals a fresh hand';
const DUPLICATE_PICK_GUARD_TITLE =
  'Your picked cards include a duplicate — impossible with one deck';
const BLACKJACK_DUPLICATE_GUARD_TITLE =
  'The dealt cards include a duplicate — impossible with one deck';

/** The em dash every pending/zero-trials stat renders (formatPct/formatEv convention). */
const DASH = '—';

/** All 13 value cells of the blackjack odds cluster (the trial counter is asserted separately). */
const STAT_CELL_TESTIDS = [
  'blackjack-bust-pct',
  'blackjack-stand-win-pct',
  'blackjack-stand-push-pct',
  'blackjack-stand-lose-pct',
  'blackjack-ev-stand',
  'blackjack-ev-hit',
  'blackjack-dealer-pct-17',
  'blackjack-dealer-pct-18',
  'blackjack-dealer-pct-19',
  'blackjack-dealer-pct-20',
  'blackjack-dealer-pct-21',
  'blackjack-dealer-pct-natural',
  'blackjack-dealer-pct-bust',
] as const;

const TRIALS = 1000;

/** Hold'em: bumped per mocked run so each run's settled win count is recognisably distinct — a
 * cache-served number is then distinguishable from a coincidentally-identical fresh one
 * (App.holdemDeckToggle.test.tsx / App.holdemCachePoison.test.tsx convention, T-08-09). */
let callIndex = 0;

/** Blackjack: the same distinct-per-call convention on the other side (stand win% climbs by
 * 0.1pp per call), from App.blackjackLoop.test.tsx. */
let bjCallIndex = 0;

/** Internally consistent Hold'em snapshot (category and outcome sums both equal
 * trialsCompleted, so the dev-only store consistency guard stays silent).
 *
 * The length asymmetry IS the contract (07-03's grow-on-merge behaviour): a 1-deck run's
 * categoryCounts is TEN entries long, a 2-deck run's is ELEVEN (index 10 = Five of a Kind) —
 * which doubles as independent proof of WHICH SHOE a run was conditioned on. */
function settledSnapshot(win: number, deckCount: DeckCount = 1): ProgressSnapshot {
  const categoryCounts =
    deckCount === 2 ? [99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] : [100, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return {
    requestId: 1,
    categoryCounts,
    outcomes: { win, tie: 0, lose: 100 - win },
    trialsCompleted: 100,
    done: true,
  };
}

/** Internally consistent blackjack snapshot: every tally group sums to trialsCompleted. Call
 * 0 renders bust 25.0%, stand 42.0/9.0/49.0%, EV(stand) −0.07, EV(hit) −0.10. */
function snapshotForCall(index: number): BlackjackProgressSnapshot {
  return {
    requestId: 1,
    dealerOutcomeCounts: [170 - index, 150, 130, 110, 90, 50 + index, 300],
    bustIfHitCount: 250,
    standOutcomes: { win: 420 + index, push: 90, lose: 490 - index },
    hitOutcomes: { win: 400, push: 100, lose: 500 },
    trialsCompleted: TRIALS,
    done: true,
  };
}

function resetStores() {
  // deckCount: 1 is explicit in BOTH game stores: this file drives the deck count in nearly
  // every test and the picks in the A4 guard cases — leakage of either would be silent and
  // profoundly confusing (a 2-deck leak makes every 1-deck assertion wrong while looking
  // like a flake).
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
  // Placed AFTER the store resets (mirrors every existing App-level harness): a reset must
  // never leave a stale armed count behind from a previous test.
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
  usePickerStore.getState().clearAll();
  // Hold'em is the app's default mode; the blackjack cases flip it explicitly before render
  // (renderInBlackjack) or drive the real switcher (the SC1 cross-game case).
  useGameModeStore.setState({ mode: 'holdem' });
  startSim.mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  startBlackjack.mockReset();
  vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mockReset();
  callIndex = 0;
  bjCallIndex = 0;
  startSim.mockImplementation(
    async (conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      onProgress(settledSnapshot(50 + callIndex++, conditioned.deckCount ?? 1));
    },
  );
  startBlackjack.mockImplementation(
    async (
      _conditioned: BlackjackConditionedState,
      onProgress: (snapshot: BlackjackProgressSnapshot) => void,
    ) => {
      onProgress(snapshotForCall(bjCallIndex++));
    },
  );
  drawNMock.mockReset();
  drawNMock.mockImplementation(actualRng.drawN);
}

/** Scripts the next blackjack deal() draw: [player0, player1, upcard, hole]. */
function scriptDeal(cards: [Card, Card, Card, Card]) {
  drawNMock.mockReturnValueOnce(cards);
}

/** Non-natural on both sides: player 9h+9c (18), dealer 7d up / 6s hole (13). */
const PLAIN_DEAL: [Card, Card, Card, Card] = ['9h', '9c', '7d', '6s'];
/** Player Kh+Qc (20) vs dealer Ts up / 7c hole — a 2-card 17 that stands immediately under
 * S17, so the playout draws nothing and Stand resolves deterministically. */
const STAND_DEAL: [Card, Card, Card, Card] = ['Kh', 'Qc', 'Ts', '7c'];

async function dealBlackjack(
  user: ReturnType<typeof userEvent.setup>,
  cards: [Card, Card, Card, Card],
) {
  scriptDeal(cards);
  await user.click(screen.getByTestId('blackjack-deal-button'));
}

/** Blackjack mode is selected BEFORE the first render (no gate arming, no mode-switch round
 * trip) everywhere except the SC1 cross-game case, which drives the real switcher on purpose. */
function renderInBlackjack() {
  useGameModeStore.setState({ mode: 'blackjack' });
  return render(<App />);
}

beforeEach(() => {
  resetStores();
});

describe("SC1: one shared control in both bars, always reflecting the ACTIVE game's deck count", () => {
  it("Hold'em mode renders the shared control with the Hold'em prefix, locked group semantics, locked labels and gameStore's count", () => {
    useGameStore.setState({ deckCount: 2 });
    render(<App />);

    const wrapper = screen.getByTestId('holdem-deck-toggle');
    expect(wrapper).toHaveAttribute('role', 'group');
    expect(wrapper).toHaveAttribute('aria-label', 'Deck count');
    expect(screen.getByTestId('holdem-deck-toggle-1').textContent).toBe('1 deck');
    expect(screen.getByTestId('holdem-deck-toggle-2').textContent).toBe('2 decks');
    // aria-pressed mirrors THIS game's store value, both segments serialized.
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    expect(useGameStore.getState().deckCount).toBe(2);
  });

  it("Blackjack mode renders the same shared control with the blackjack prefix and blackjackStore's count", () => {
    useBlackjackStore.setState({ deckCount: 2 });
    renderInBlackjack();

    const wrapper = screen.getByTestId('blackjack-deck-toggle');
    expect(wrapper).toHaveAttribute('role', 'group');
    expect(wrapper).toHaveAttribute('aria-label', 'Deck count');
    expect(screen.getByTestId('blackjack-deck-toggle-1').textContent).toBe('1 deck');
    expect(screen.getByTestId('blackjack-deck-toggle-2').textContent).toBe('2 decks');
    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    expect(useBlackjackStore.getState().deckCount).toBe(2);
  });

  it('with the two stores holding CONTRADICTING counts, each mode shows its own — and the other game\'s three testids are DOM-absent (D-02)', async () => {
    // The load-bearing cross-game case (T-08-11): one shared component, two instances that
    // never co-exist and never cross-read. If either instance ever read the other game's
    // store, one of the four aria-pressed values below would flip.
    const user = userEvent.setup();
    useGameStore.setState({ deckCount: 1 });
    useBlackjackStore.setState({ deckCount: 2 });
    render(<App />);

    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'false');
    for (const testid of [
      'blackjack-deck-toggle',
      'blackjack-deck-toggle-1',
      'blackjack-deck-toggle-2',
    ]) {
      expect(screen.queryByTestId(testid), `${testid} must be DOM-absent in Hold'em mode`).toBeNull();
    }

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    for (const testid of ['holdem-deck-toggle', 'holdem-deck-toggle-1', 'holdem-deck-toggle-2']) {
      expect(screen.queryByTestId(testid), `${testid} must be DOM-absent in Blackjack mode`).toBeNull();
    }

    // Round trip: Hold'em still shows ITS own count, unchanged by the visit next door.
    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'false');
    expect(useGameStore.getState().deckCount).toBe(1);
    expect(useBlackjackStore.getState().deckCount).toBe(2);
  });
});

describe('SC2: a toggle through the shared segments cancels the in-flight run and recomputes under the new shoe, leaving no stale number (DECK-02, D-04)', () => {
  it('blackjack mid-round: the counter blanks to 0 and all 13 stats blank to the em dash in the same frame, then a NEW run goes out over the same cards under the new shoe', async () => {
    const user = userEvent.setup();
    renderInBlackjack();

    await dealBlackjack(user, PLAIN_DEAL);
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(TRIALS.toLocaleString());
    expect(screen.getByText('Given the cards you can see · 1-deck shoe')).toBeInTheDocument();

    // The restarted run HANGS so the synchronous blank-out (06 A3: reset in the same frame as
    // the click) is observable rather than instantly overwritten by the mock's settled
    // snapshot — the "cancels in-flight, recomputes" clause made visible.
    startBlackjack.mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByTestId('blackjack-deck-toggle-2'));

    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe('0');
    for (const testid of STAT_CELL_TESTIDS) {
      expect(
        screen.getByTestId(testid).textContent,
        `${testid} must blank on a mid-round toggle through the shared segment`,
      ).toBe(DASH);
    }
    // The subtitle moves in the same frame — the numbers and the shoe they belong to never
    // disagree on screen.
    expect(screen.getByText('Given the cards you can see · 2-deck shoe')).toBeInTheDocument();
    expect(
      screen.queryByText('Given the cards you can see · 1-deck shoe'),
    ).not.toBeInTheDocument();

    // Read the PAYLOAD that actually crossed the worker boundary, never a store field that
    // might coincidentally agree with it: 104 − 3 visible = 101, same two player cards.
    expect(startBlackjack).toHaveBeenCalledTimes(2);
    expect(startBlackjack.mock.calls[1][0].deckCount).toBe(2);
    expect(startBlackjack.mock.calls[1][0].playerHand).toEqual(['9h', '9c']);
    expect(startBlackjack.mock.calls[1][0].dealerUpcard).toBe('7d');
    expect(startBlackjack.mock.calls[1][0].remainingDeck).toHaveLength(101);
  });

  it('blackjack resolved: the same click sets the pending count ONLY — no new run, subtitle unchanged, every retained number byte-identical (06 A3/A16)', async () => {
    const user = userEvent.setup();
    renderInBlackjack();

    await dealBlackjack(user, STAND_DEAL);
    await user.click(screen.getByTestId('blackjack-stand-button'));
    expect(startBlackjack).toHaveBeenCalledTimes(1);

    // Capture the trial counter and all 13 cells character-for-character BEFORE the toggle.
    const before = new Map<string, string | null>();
    before.set(
      'blackjack-trial-counter',
      screen.getByTestId('blackjack-trial-counter').textContent,
    );
    for (const testid of STAT_CELL_TESTIDS) {
      const text = screen.getByTestId(testid).textContent;
      expect(text, `${testid} must show a retained value while resolved (A16), not the dash`).not.toBe(
        DASH,
      );
      before.set(testid, text);
    }

    await user.click(screen.getByTestId('blackjack-deck-toggle-2'));

    // The pending selection flips for the NEXT deal…
    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(useBlackjackStore.getState().deckCount).toBe(2);
    // …and nothing else moves: no cancel-and-recompute where there is nothing in flight, and
    // the compare-your-EV-to-the-outcome moment survives byte-identically.
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Given the cards you can see · 1-deck shoe')).toBeInTheDocument();
    expect(
      screen.queryByText('Given the cards you can see · 2-deck shoe'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(
      before.get('blackjack-trial-counter'),
    );
    for (const testid of STAT_CELL_TESTIDS) {
      expect(
        screen.getByTestId(testid).textContent,
        `${testid} must retain its exact pre-toggle text while resolved (A3/A16)`,
      ).toBe(before.get(testid));
    }
  });

  it("Hold'em mid-hand: the same click bumps dealNonce, clears the cache, restarts the counter and starts a run carrying the new deckCount", async () => {
    const user = userEvent.setup();
    render(<App />);

    // A non-trivial knowledge state first: deal, advance to the flop, reveal opponent 0 —
    // three runs (preflop|0, flop|0, flop|1), three settled cache entries.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('opponent-seat-0'));
    expect(startSim).toHaveBeenCalledTimes(3);
    expect(useOddsStore.getState().settledCache.size).toBe(3);
    // The pre-toggle displayed value (call index 2 -> win 52) — the number that must NOT
    // survive the toggle.
    const winPctBefore = screen.getByTestId('win-pct').textContent;
    expect(winPctBefore).toBe('52.0%');

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    // The full D-02 fresh-deal choreography as end states: cancel via deal()'s CR-02
    // generation bump, cache cleared, hand restarted from preflop.
    expect(useGameStore.getState().dealNonce).toBe(2);
    expect(useGameStore.getState().street).toBe('preflop');
    expect(useGameStore.getState().revealedMask).toBe(0);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
    expect(startSim).toHaveBeenCalledTimes(4);

    // No stale numbers: every post-toggle value is the FRESH run's distinct value (call index
    // 3 -> win 53), never the pre-toggle run's 52 (T-08-09).
    const cached = useOddsStore.getState().getCached('preflop', 0);
    expect(cached?.outcomes.win).toBe(53);
    expect(cached?.outcomes.win).not.toBe(52);
    expect(useOddsStore.getState().outcomes.win).toBe(53);
    expect(screen.getByTestId('win-pct').textContent).toBe('53.0%');
    expect(screen.getByTestId('win-pct').textContent).not.toBe(winPctBefore);

    // The payload that crossed the worker boundary carries the NEW shoe…
    expect(startSim.mock.calls[3][0].deckCount).toBe(2);
    // …and the histogram shape is the independent proof of which shoe conditioned the run:
    // eleven entries only exist at two decks (index 10 = Five of a Kind), and the extended
    // row is on screen with the fresh run's value.
    expect(cached?.categoryCounts).toHaveLength(11);
    expect(screen.getByTestId('category-pct-10').textContent).toBe('1.0%');
  });

  it("Hold'em idle: with no in-flight simulation to cancel, the click only flips the selection — no deal, no run", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(useGameStore.getState().runout).toBeNull();

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    expect(useGameStore.getState().deckCount).toBe(2);
    expect(useGameStore.getState().dealNonce).toBe(0);
    expect(startSim).not.toHaveBeenCalled();
  });
});

describe('SC3: no disruptive mid-hand mutation — recorded satisfied-by-interpretation (08-CONTEXT D-05)', () => {
  // D-05, recorded here in substance: SC3 is interpreted against the SHIPPED locked semantics,
  // which post-date the roadmap wording. Neither game silently mutates a hand in place —
  // blackjack re-runs the odds over the SAME visible cards, and Hold'em visibly REPLACES the
  // hand with the full fresh-deal choreography plus a pre-click title disclosure. No assertion
  // in this block may force a literal "the new deck count takes effect on the next deal only"
  // reading: that would undo Phase 6's locked, shipped, verified BJ-07 findability behavior
  // (the mid-round re-run IS the feature). The two cases below are the positive evidence
  // (T-08-12), one per game.

  it('blackjack re-runs over the SAME visible cards: same roundNonce, same hand, same upcard, hole still face-down', async () => {
    const user = userEvent.setup();
    renderInBlackjack();

    await dealBlackjack(user, PLAIN_DEAL);
    const roundNonceBefore = useBlackjackStore.getState().roundNonce;
    expect(useBlackjackStore.getState().playerHand).toEqual(['9h', '9c']);

    await user.click(screen.getByTestId('blackjack-deck-toggle-2'));

    // The numbers changed; the HAND did not. No re-deal, no reshuffle, nothing withdrawn.
    expect(useBlackjackStore.getState().roundNonce).toBe(roundNonceBefore);
    expect(useBlackjackStore.getState().playerHand).toEqual(['9h', '9c']);
    expect(useBlackjackStore.getState().round?.dealerUpcard).toBe('7d');
    expect(useBlackjackStore.getState().revealedHole).toBe(false);
    expect(useBlackjackStore.getState().roundPhase).toBe('player-turn');
    // The same claim at the rendered level: the same two player cards, the same upcard, and
    // the hole-reveal control still carrying its hidden-state accessible name.
    const playerCards = within(screen.getByTestId('blackjack-player-cards'));
    expect(playerCards.getAllByRole('img')).toHaveLength(2);
    expect(playerCards.getByAltText('Nine of Hearts')).toBeInTheDocument();
    expect(playerCards.getByAltText('Nine of Clubs')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('blackjack-dealer-cards')).getByAltText('Seven of Diamonds'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('blackjack-hole-reveal')).toHaveAttribute(
      'aria-label',
      "Reveal the dealer's hole card",
    );
    expect(screen.queryByAltText('Six of Spades')).not.toBeInTheDocument();
  });

  it("Hold'em visibly REPLACES the hand, and says so before the click: the inactive segment carries the fresh-deal title, the active segment none", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Idle: no disclosure anywhere — there is nothing to replace yet (07 A3).
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute('title');

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    const dealNonceBefore = useGameStore.getState().dealNonce;

    // The honesty affordance is what makes the replacement non-disruptive: it is announced
    // BEFORE the click, on the segment that would cause it, and never on the active one.
    expect(screen.getByTestId('holdem-deck-toggle-2')).toHaveAttribute('title', FRESH_DEAL_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));

    // The hand is REPLACED through the full deal path — announced by the choreography, never
    // applied silently under the old cards.
    expect(useGameStore.getState().dealNonce).toBe(dealNonceBefore + 1);
    expect(useGameStore.getState().street).toBe('preflop');
    expect(useGameStore.getState().runout).not.toBeNull();
    // And the disclosure swaps to the newly inactive segment for the next switch.
    expect(screen.getByTestId('holdem-deck-toggle-1')).toHaveAttribute('title', FRESH_DEAL_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute('title');
  });
});

describe('Per-game guards through the shared control: both behave exactly as they did inline (D-03)', () => {
  it('blackjack: a HIDDEN hole duplicating a visible card disables only the "1 deck" segment, with the locked title verbatim (06 A3 as amended by 06-REVIEW WR-01)', () => {
    // The WR-01 convention carried into Phase 8 (recorded in the STATE.md blockers ledger as
    // the leak-acceptance entry): the guard counts the round's PHYSICAL cards INCLUDING the
    // face-down hole, which leaks ~one bit about a hidden card — accepted, because a
    // visible-cards-only guard would let the toggle build an impossible one-deck table (two
    // physical 5c) with a silently corrupted 53-card ledger. 2-deck round: player 5c 8d,
    // upcard 9s, hole 5c (hidden) — no VISIBLE duplicate at all.
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
    renderInBlackjack();

    const oneDeck = screen.getByTestId('blackjack-deck-toggle-1');
    expect(oneDeck).toBeDisabled();
    expect(oneDeck).toHaveAttribute('title', BLACKJACK_DUPLICATE_GUARD_TITLE);
    // Only that segment: the active "2 decks" segment stays operable and title-free, exactly
    // as the shared component's binding rule 6 requires.
    expect(screen.getByTestId('blackjack-deck-toggle-2')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-deck-toggle-2')).not.toHaveAttribute('title');
  });

  it("Hold'em mid-hand: the picks-guard title WINS over the fresh-deal title, and a click on the disabled segment changes nothing (07 A4 beats A3)", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('holdem-deck-toggle-2'));
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(useGameStore.getState().runout).not.toBeNull();
    expect(startSim).toHaveBeenCalledTimes(1);

    // Two copies of one value at 2 decks — the only state that can make one deck impossible
    // (the on-table hand never blocks a switch; D-02's fresh deal discards it).
    act(() => {
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('hero-1', 'As', 2);
    });

    const segmentOne = screen.getByTestId('holdem-deck-toggle-1');
    expect(segmentOne).toBeDisabled();
    // A4-beats-A3 precedence, now a CALL-SITE responsibility (the shared component receives
    // one pre-computed title): with a hand on the table this segment would otherwise carry
    // the fresh-deal disclosure — the guard title displaces it entirely.
    // COLLAPSED (08-REVIEW IN-02): one exact-value assertion, which excludes FRESH_DEAL_TITLE
    // by construction. It replaces the previous exact-value line plus a
    // `not.toHaveAttribute('title', FRESH_DEAL_TITLE)` that could never fail here — the
    // negated two-argument matcher passes whenever the attribute is absent OR holds any other
    // value, so directly after an exact-value check it added no coverage while reading like a
    // second, independent precedence check. Coverage is unchanged; the misleading line is not.
    expect(segmentOne.getAttribute('title')).toBe(DUPLICATE_PICK_GUARD_TITLE);
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toBeDisabled();

    // A click on the disabled segment modifies nothing: same picks by reference AND value,
    // same deck count, no fresh deal, no new run.
    const picksBefore = usePickerStore.getState().picks;
    const dealNonceBefore = useGameStore.getState().dealNonce;
    await user.click(segmentOne);
    expect(usePickerStore.getState().picks).toBe(picksBefore);
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
    expect(usePickerStore.getState().picks['hero-1']).toBe('As');
    expect(useGameStore.getState().deckCount).toBe(2);
    expect(useGameStore.getState().dealNonce).toBe(dealNonceBefore);
    expect(startSim).toHaveBeenCalledTimes(1);

    // Clearing the duplicate re-enables the segment in the same render — and because a hand
    // IS on the table, the fresh-deal disclosure is what comes back (07 A3): the guard title
    // is gone, no title is left behind.
    act(() => {
      usePickerStore.getState().clearSlot('hero-1');
    });
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toBeDisabled();
    // COLLAPSED (08-REVIEW IN-02), same shape as above: one exact-value assertion, which
    // excludes DUPLICATE_PICK_GUARD_TITLE by construction, in place of the exact-value line
    // plus its tautological negated twin.
    expect(screen.getByTestId('holdem-deck-toggle-1').getAttribute('title')).toBe(FRESH_DEAL_TITLE);
  });

  it("Hold'em idle: clearing the duplicate pick re-enables the segment with NO title attribute left behind (07 A4)", () => {
    render(<App />);

    act(() => {
      useGameStore.getState().setDeckCount(2);
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('hero-1', 'As', 2);
    });

    const segmentOne = screen.getByTestId('holdem-deck-toggle-1');
    expect(segmentOne).toBeDisabled();
    expect(segmentOne).toHaveAttribute('title', DUPLICATE_PICK_GUARD_TITLE);

    act(() => {
      usePickerStore.getState().clearSlot('hero-1');
    });

    // Idle (runout === null), so no disclosure applies either: the attribute is ABSENT, not
    // an empty string (the component omits it when the prop is undefined — binding rule 5).
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toBeDisabled();
    expect(screen.getByTestId('holdem-deck-toggle-1')).not.toHaveAttribute('title');
    expect(screen.getByTestId('holdem-deck-toggle-2')).not.toHaveAttribute('title');
  });
});
