import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import type { BlackjackProgressSnapshot } from './worker/blackjackProtocol';
import type { BlackjackConditionedState } from './engine/blackjackEquity';
import type { Card } from '@poker-apprentice/types';

// Phase 6 end-to-end acceptance evidence for BJ-02..BJ-07 (ROADMAP Phase 6 success criteria
// 1-5), over the REAL component tree (App -> BlackjackGame -> controls/table/panel) with only
// the worker transport mocked. One describe per requirement ID, so a failure names the
// requirement it broke. Plan 06-08's browser checkpoint reads this suite's result as the
// automated half of the phase's acceptance. jsdom forces reduced motion (src/test/setup.ts),
// so no assertion here makes any animation-timing or CSS claim — a green run proves wiring
// and gate accounting, not choreography.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's/App.modeIsolation.test.tsx's existing mock.
// The Hold'em service is mocked too because the mode-isolation round trip mounts <HoldemGame />.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

// Same explicit-factory rationale, for the blackjack transport (06-07): this suite's deals
// genuinely run the odds effect, so the factory must intercept both exports before any real
// Comlink call could be attempted.
vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

// Deterministic deals over the REAL store actions (the blackjackStore.test.ts precedent):
// drawN is wrapped in a spy-able vi.fn that defaults to the real implementation, so
// mockReturnValueOnce can script exact deals for the click-driven paths. A genuinely random
// Deal click would land a natural ~4.8% of the time, silently flipping "starts one run" into
// "starts zero runs" — the scripted deal removes that flake class without touching any
// engine file.
vi.mock('./engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine/rng')>();
  return {
    ...actual,
    drawN: vi.fn(actual.drawN),
  };
});

const actualRng = await vi.importActual<typeof import('./engine/rng')>('./engine/rng');
const drawNMock = vi.mocked(drawN);

/** The em dash every pending/zero-trials stat renders (formatPct/formatEv convention). */
const DASH = '—';
/** U+2212 MINUS SIGN — formatEv's locked A8 sign character, never the ASCII hyphen. */
const MINUS = '−';

/** All 13 value cells of the odds cluster (the trial counter is asserted separately). */
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

/** Bumped on every mocked `startBlackjackSimulation` call so each call's streamed snapshot is
 * recognisably distinct (stand win% climbs by 0.1pp per call) — lets a cache-hit assertion
 * prove "no NEW call happened" rather than merely "the call count didn't change by
 * coincidence". Mirrors App.modeIsolation.test.tsx's own harness. */
let bjCallIndex = 0;

/** Internally consistent per-call snapshot: every tally group sums to trialsCompleted, so the
 * dev-only store consistency guard stays silent. Call 0's expected renderings:
 * bust 25.0%, stand 42.0/9.0/49.0%, EV(stand) −0.07, EV(hit) −0.10,
 * dealer buckets 17.0/15.0/13.0/11.0/9.0/5.0/30.0%. */
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

const startBlackjack = vi.mocked(blackjackSimulationService.startBlackjackSimulation);
const cancelBlackjack = vi.mocked(blackjackSimulationService.cancelBlackjackSimulation);

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
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
  usePickerStore.getState().clearAll();
  // This suite lives in Blackjack mode; the mode-isolation cases drive the round trip
  // through real switcher clicks from here.
  useGameModeStore.setState({ mode: 'blackjack' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  startBlackjack.mockReset();
  cancelBlackjack.mockReset();
  bjCallIndex = 0;
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

/** Scripts the next deal() draw: [player0, player1, upcard, hole] — deal() destructures the
 * single drawN call in exactly this order. */
function scriptDeal(cards: [Card, Card, Card, Card]) {
  drawNMock.mockReturnValueOnce(cards);
}

/** Non-natural on both sides: player 9h+9c (18), dealer 7d up / 6s hole (13). */
const PLAIN_DEAL: [Card, Card, Card, Card] = ['9h', '9c', '7d', '6s'];
/** Known stand comparison: player Kh+Qc (20) vs dealer Ts up / 7c hole — a 2-card 17 that
 * stands immediately under S17, so the playout draws NOTHING and the outcome is
 * deterministic without any further scripting. */
const STAND_DEAL: [Card, Card, Card, Card] = ['Kh', 'Qc', 'Ts', '7c'];
/** Player natural (Ah+Kc), dealer 9d/6s — resolves at deal (D-03, D-03a). */
const NATURAL_DEAL: [Card, Card, Card, Card] = ['Ah', 'Kc', '9d', '6s'];

async function deal(user: ReturnType<typeof userEvent.setup>, cards: [Card, Card, Card, Card]) {
  scriptDeal(cards);
  await user.click(screen.getByTestId('blackjack-deal-button'));
}

beforeEach(() => {
  resetStores();
});

describe('BJ-02: dealing a round starts a streamed Monte Carlo run whose numbers land on screen', () => {
  it('renders two player cards, the face-up upcard and a face-down hole, and starts exactly one run', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);

    const playerCards = within(screen.getByTestId('blackjack-player-cards')).getAllByRole('img');
    expect(playerCards).toHaveLength(2);
    expect(within(screen.getByTestId('blackjack-player-cards')).getByAltText('Nine of Hearts')).toBeInTheDocument();
    expect(within(screen.getByTestId('blackjack-player-cards')).getByAltText('Nine of Clubs')).toBeInTheDocument();
    expect(within(screen.getByTestId('blackjack-dealer-cards')).getByAltText('Seven of Diamonds')).toBeInTheDocument();

    // Face-down hole: the reveal button still carries its hidden-state label, and the hole
    // card's identity exists NOWHERE in the DOM (T-06-24, D-02's UI face).
    expect(screen.getByTestId('blackjack-hole-reveal')).toHaveAttribute(
      'aria-label',
      "Reveal the dealer's hole card",
    );
    expect(screen.queryByAltText('Six of Spades')).not.toBeInTheDocument();

    expect(startBlackjack).toHaveBeenCalledTimes(1);
  });

  it('streams into a non-dash trial counter, bust stat and all seven dealer cells', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);

    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(TRIALS.toLocaleString());
    expect(screen.getByTestId('blackjack-bust-pct').textContent).not.toBe(DASH);
    for (const bucket of ['17', '18', '19', '20', '21', 'natural', 'bust']) {
      expect(
        screen.getByTestId(`blackjack-dealer-pct-${bucket}`).textContent,
        `dealer bucket ${bucket} must show a streamed value, not the pending dash`,
      ).not.toBe(DASH);
    }
  });

  it('conditions the run through the sole reader: the hidden hole stays in the trial pool (D-02)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);

    const conditioned = startBlackjack.mock.calls[0][0];
    expect(conditioned.playerHand).toEqual(['9h', '9c']);
    expect(conditioned.dealerUpcard).toBe('7d');
    expect(conditioned.deckCount).toBe(1);
    // 52 minus the 3 VISIBLE cards only — the predetermined hole is not excluded while
    // face-down, so trials keep resampling it as unknown (D-02, the dual-exclusion rule).
    expect(conditioned.remainingDeck).toHaveLength(49);
  });
});

describe('BJ-03: the dealer distribution and bust-if-hit render the expected percentages for a known tally', () => {
  it('renders every injected percentage exactly', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);

    expect(screen.getByTestId('blackjack-bust-pct').textContent).toBe('25.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-17').textContent).toBe('17.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-18').textContent).toBe('15.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-19').textContent).toBe('13.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-20').textContent).toBe('11.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-21').textContent).toBe('9.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-natural').textContent).toBe('5.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-bust').textContent).toBe('30.0%');
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');
    expect(screen.getByTestId('blackjack-stand-push-pct').textContent).toBe('9.0%');
    expect(screen.getByTestId('blackjack-stand-lose-pct').textContent).toBe('49.0%');
  });
});

describe('BJ-04: the EV tiles render the expected signed per-unit strings', () => {
  it('renders EV(Stand) and EV(Hit) with the locked formatEv shape and the visible sub-copy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);

    // (420 − 490) / 1000 and (400 − 500) / 1000 — typographic minus (U+2212), two decimals.
    expect(screen.getByTestId('blackjack-ev-stand').textContent).toBe(`${MINUS}0.07 units`);
    expect(screen.getByTestId('blackjack-ev-hit').textContent).toBe(`${MINUS}0.10 units`);
    // D-05: the single-draw basis is ALWAYS-visible DOM text, never a tooltip.
    expect(screen.getByText('hit once, then stand')).toBeInTheDocument();
  });
});

describe('BJ-05: hitting updates the hand and recomputes odds; standing plays the dealer out and shows the outcome', () => {
  it('Hit appends a third card and triggers a NEW simulation run (fresh, not cached)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');

    drawNMock.mockReturnValueOnce(['2c']);
    await user.click(screen.getByTestId('blackjack-hit-button'));

    const playerCards = within(screen.getByTestId('blackjack-player-cards')).getAllByRole('img');
    expect(playerCards).toHaveLength(3);
    expect(within(screen.getByTestId('blackjack-player-cards')).getByAltText('Two of Clubs')).toBeInTheDocument();
    // Per-call-distinct snapshot: 42.1% can ONLY come from a second real call — a cached or
    // stale value would still read 42.0%.
    expect(startBlackjack).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.1%');
  });

  it('Stand reveals the hole, disables both action buttons and shows the locked outcome banner', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, STAND_DEAL);
    expect(screen.getByTestId('blackjack-hit-button')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).not.toBeDisabled();

    await user.click(screen.getByTestId('blackjack-stand-button'));

    // Hole revealed as part of resolution: the button's label now names the card, and the
    // dealer total badge appears (A11). The 2-card 17 stands immediately under S17 (D-04),
    // so no playout draw is appended and the comparison is deterministic.
    expect(screen.getByTestId('blackjack-hole-reveal')).toHaveAttribute(
      'aria-label',
      "Dealer's hole card: Seven of Clubs",
    );
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('17');
    expect(screen.getByTestId('blackjack-hit-button')).toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).toBeDisabled();

    const banner = screen.getByTestId('blackjack-outcome-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(within(banner).getByText('You win')).toBeInTheDocument();
    expect(within(banner).getByText("Your 20 beats the dealer's 17.")).toBeInTheDocument();
    // A resolved round starts no NEW run (the roundPhase gate) — the deal's single run is
    // still the only one.
    expect(startBlackjack).toHaveBeenCalledTimes(1);
  });

  it('the disabled matrix follows the round phase: idle -> disabled, player-turn -> enabled, resolved -> disabled; Deal never disables', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Idle.
    expect(screen.getByTestId('blackjack-deal-button')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-hit-button')).toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).toBeDisabled();

    await deal(user, STAND_DEAL);
    expect(screen.getByTestId('blackjack-deal-button')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-hit-button')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).not.toBeDisabled();

    await user.click(screen.getByTestId('blackjack-stand-button'));
    expect(screen.getByTestId('blackjack-deal-button')).not.toBeDisabled();
    expect(screen.getByTestId('blackjack-hit-button')).toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).toBeDisabled();

    // A2: Deal mid-anything silently starts a new round — click it from resolved and a
    // fresh player-turn round mounts (roundNonce keying, no confirmation dialog).
    await deal(user, PLAIN_DEAL);
    expect(screen.getByTestId('blackjack-hit-button')).not.toBeDisabled();
    expect(screen.queryByTestId('blackjack-outcome-banner')).not.toBeInTheDocument();
  });
});

describe('BJ-06: revealing the hole card early reconditions every odds display on the newly known card', () => {
  it('flips the hole face-up, shows the dealer total and triggers a NEW run with the hole excluded from the pool', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('blackjack-dealer-total')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('blackjack-hole-reveal'));

    expect(screen.getByTestId('blackjack-hole-reveal')).toHaveAttribute(
      'aria-label',
      "Dealer's hole card: Six of Spades",
    );
    // 7d + 6s = 13 — the full 2-card dealer total, shown only once the hole is known (A11).
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('13');
    expect(startBlackjack).toHaveBeenCalledTimes(2);
    // Reconditioned: the run after the reveal excludes the now-known hole from the unknown
    // pool (48 = 52 − 4 known), where the pre-reveal run kept it in (49) — D-02's boundary
    // observed end to end.
    expect(startBlackjack.mock.calls[0][0].remainingDeck).toHaveLength(49);
    expect(startBlackjack.mock.calls[1][0].remainingDeck).toHaveLength(48);
    // 06-REVIEW CR-01: pool exclusion alone is NOT reconditioning — the revealed hole's
    // IDENTITY must reach the worker so every trial pins the dealer's hole to the real
    // card, not to "anything but the card face-up on the table".
    expect(startBlackjack.mock.calls[0][0].knownDealerHole).toBeUndefined();
    expect(startBlackjack.mock.calls[1][0].knownDealerHole).toBe('6s');
    // The reveal button is one-way per round: disabled after the reveal (A9).
    expect(screen.getByTestId('blackjack-hole-reveal')).toBeDisabled();
    // Fresh run, not cache: the per-call-distinct win% climbed.
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.1%');
  });
});

describe('BJ-07: the blackjack-local deck toggle restarts the run under the new shoe mid-turn, and preserves everything while resolved', () => {
  it('a player-turn toggle flips aria-pressed, blanks the stats, retitles the dealer table and starts a NEW run over the new shoe', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Given the cards you can see · 1-deck shoe')).toBeInTheDocument();

    // The restarted run HANGS for this test (no streamed snapshot), so the synchronous
    // blank-out (A3: reset in the same frame as the click) is observable rather than being
    // instantly overwritten by the mock's settled snapshot.
    startBlackjack.mockImplementationOnce(() => new Promise(() => {}));
    await user.click(screen.getByTestId('blackjack-deck-toggle-2'));

    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'false');
    // Zero-trials state: counter restarts from 0, every one of the 13 stat cells blanks.
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe('0');
    for (const testid of STAT_CELL_TESTIDS) {
      expect(screen.getByTestId(testid).textContent, `${testid} must blank on a mid-turn deck toggle`).toBe(DASH);
    }
    // The subtitle moves in the same frame (A3: a new run starts under the new shoe now).
    expect(screen.getByText('Given the cards you can see · 2-deck shoe')).toBeInTheDocument();
    expect(screen.queryByText('Given the cards you can see · 1-deck shoe')).not.toBeInTheDocument();
    // The new run really is over the new shoe with the SAME visible cards: 104 − 3 = 101.
    expect(startBlackjack).toHaveBeenCalledTimes(2);
    expect(startBlackjack.mock.calls[1][0].deckCount).toBe(2);
    expect(startBlackjack.mock.calls[1][0].playerHand).toEqual(['9h', '9c']);
    expect(startBlackjack.mock.calls[1][0].remainingDeck).toHaveLength(101);
  });

  it('a resolved toggle changes only the pending selection: no new run, subtitle unchanged, every retained number byte-identical (A3/A16)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, STAND_DEAL);
    await user.click(screen.getByTestId('blackjack-stand-button'));
    expect(startBlackjack).toHaveBeenCalledTimes(1);

    // A16: the resolved panel retains the last decision point's converged numbers — capture
    // ALL of them (trial counter + 13 cells) character-for-character before the toggle.
    const before = new Map<string, string | null>();
    before.set('blackjack-trial-counter', screen.getByTestId('blackjack-trial-counter').textContent);
    for (const testid of STAT_CELL_TESTIDS) {
      const text = screen.getByTestId(testid).textContent;
      expect(text, `${testid} must show a retained value while resolved (A16), not the dash`).not.toBe(DASH);
      before.set(testid, text);
    }

    await user.click(screen.getByTestId('blackjack-deck-toggle-2'));

    // The selection flips for the NEXT deal…
    expect(screen.getByTestId('blackjack-deck-toggle-2')).toHaveAttribute('aria-pressed', 'true');
    // …but nothing else moves: no new run, no re-subtitle, and the compare-your-EV-to-the-
    // outcome moment survives byte-identically (A3 snapshot rule, checker FLAG 1).
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Given the cards you can see · 1-deck shoe')).toBeInTheDocument();
    expect(screen.queryByText('Given the cards you can see · 2-deck shoe')).not.toBeInTheDocument();
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(before.get('blackjack-trial-counter'));
    for (const testid of STAT_CELL_TESTIDS) {
      expect(
        screen.getByTestId(testid).textContent,
        `${testid} must retain its exact pre-toggle text while resolved (A3/A16)`,
      ).toBe(before.get(testid));
    }
  });

  it('the A3 duplicate guard disables ONLY the "1 deck" segment, with the locked title, when the visible cards contain a duplicate', async () => {
    // Kh appears twice among the visible cards (player hand + upcard) — legal at 2 decks,
    // impossible at 1. Seeded BEFORE render so the felt mounts with it (no gate arming).
    useBlackjackStore.setState({
      round: { dealerUpcard: 'Kh' as Card, dealerHole: '6s' as Card },
      playerHand: ['Kh', 'Qc'] as Card[],
      dealerPlayoutCards: [] as Card[],
      roundPhase: 'player-turn',
      revealedHole: false,
      outcome: null,
      playerNaturalWin: false,
      deckCount: 2,
      roundNonce: 1,
    });
    render(<App />);

    const oneDeck = screen.getByTestId('blackjack-deck-toggle-1');
    expect(oneDeck).toBeDisabled();
    expect(oneDeck).toHaveAttribute('title', 'The dealt cards include a duplicate — impossible with one deck');
    // Only that segment: the active "2 decks" segment stays operable (A3/A4).
    expect(screen.getByTestId('blackjack-deck-toggle-2')).not.toBeDisabled();
  });

  it('clicking the already-active segment is a harmless no-op: no new run, no blank, no state change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    const winBefore = screen.getByTestId('blackjack-stand-win-pct').textContent;

    await user.click(screen.getByTestId('blackjack-deck-toggle-1'));

    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blackjack-deck-toggle-1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe(winBefore);
  });
});

describe('Mode isolation: a Hold\'em round trip leaves the blackjack round intact with no re-deal and no re-simulation', () => {
  it('switching away cancels via the effect teardown; switching back serves the settled cache', async () => {
    const user = userEvent.setup();
    render(<App />);

    await deal(user, PLAIN_DEAL);
    const nonceBefore = useBlackjackStore.getState().roundNonce;
    const winBefore = screen.getByTestId('blackjack-stand-win-pct').textContent;
    expect(winBefore).toBe('42.0%');
    expect(startBlackjack).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    // D-07: the odds effect's teardown IS the cancellation — no blackjack DOM survives.
    expect(cancelBlackjack).toHaveBeenCalled();
    expect(screen.queryByTestId('blackjack-scene')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    // The round is intact — same nonce (no re-deal), same two cards on the felt.
    expect(useBlackjackStore.getState().roundNonce).toBe(nonceBefore);
    expect(within(screen.getByTestId('blackjack-player-cards')).getAllByRole('img')).toHaveLength(2);
    // A CACHE HIT, not merely "some number is on screen": the per-call-distinct mock means
    // an unchanged 42.0% combined with an unchanged call count proves the effect served the
    // settled cache rather than re-running.
    expect(startBlackjack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');
  });
});

describe('Natural path (D-03a/A16): a natural-resolved deal runs zero trials and shows the zero-trials state, never the previous round\'s numbers', () => {
  it('shows the locked natural banner, calls startBlackjackSimulation zero times, and zeroes the panel despite a pre-seeded settled state', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Seed a SETTLED display first (as if a previous round's run had converged), so the
    // zero-trials assertion below is non-vacuous: nothing downstream of deal() would zero
    // these — the odds effect returns at its roundPhase gate on a natural — so observing
    // the zeros IS observing deal()'s own unconditional reset end to end (A16, D-03a).
    act(() => {
      useBlackjackOddsStore.getState().applySnapshot(snapshotForCall(0));
    });
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(TRIALS.toLocaleString());
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');

    await deal(user, NATURAL_DEAL);

    // Zero runs: the round resolved at deal — there is no decision point to simulate.
    expect(startBlackjack).not.toHaveBeenCalled();

    const banner = screen.getByTestId('blackjack-outcome-banner');
    expect(within(banner).getByText('Blackjack — you win')).toBeInTheDocument();
    expect(within(banner).getByText('Your natural pays 3:2.')).toBeInTheDocument();
    // The hole is revealed as part of resolution (D-03a): 9d + 6s = 15.
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('15');
    expect(screen.getByTestId('blackjack-hit-button')).toBeDisabled();
    expect(screen.getByTestId('blackjack-stand-button')).toBeDisabled();

    // The zero-trials state, with the animation gate already drained: counter 0, thirteen
    // em dashes — never the seeded 42.0%/1,000-trial numbers.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe('0');
    for (const testid of STAT_CELL_TESTIDS) {
      expect(
        screen.getByTestId(testid).textContent,
        `${testid} must read the em dash after a natural-resolved deal (A16, D-03a)`,
      ).toBe(DASH);
    }
  });
});
