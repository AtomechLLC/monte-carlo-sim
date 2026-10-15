import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
import { useRouletteStore } from './state/rouletteStore';
import { HOLDEM_ONLY_TESTIDS } from './test/holdemTestids';
import { BLACKJACK_ONLY_TESTIDS } from './test/blackjackTestids';
import { ROULETTE_ONLY_TESTIDS } from './test/rouletteTestids';
import { SPINS_PER_BATCH, countHits, type PredictionTarget } from './engine/roulette';
import { formatSignedUnits } from './engine/predictionScore';
import { formatPct } from './ui/formatPct';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';
import type { BlackjackProgressSnapshot } from './worker/blackjackProtocol';
import type { BlackjackConditionedState } from './engine/blackjackEquity';
import type { Card } from '@poker-apprentice/types';

// Roulette as the third game mode (quick task 261015-ch8). A NEW sibling file, deliberately:
// the frozen v1 suites, the three goldens, App.modeIsolation / App.modeSwitch /
// App.controlPlacement are untouched (the D-09 precedent). What this file pins:
//
//   - the switcher is a THREE-button control and Roulette mounts its own tree, with every
//     Hold'em and Blackjack testid DOM-absent while it is on screen, and every roulette
//     testid DOM-absent while either other game is (the both-ways contract, now three ways);
//   - the user's loop: pick a colour and/or a pocket, Spin 100, read hits / rate / true odds /
//     expected / net — with every number re-derived here from the store's own history;
//   - the wheel toggle changes the odds AND discards the history, the way a deck toggle does;
//   - the session bar keeps the two-control shape and the on-felt cluster keeps the plate;
//   - a mode round trip preserves the roulette history with no re-spin.
//
// The harness forces `prefers-reduced-motion: reduce`, so every batch lands synchronously
// (useProgressiveReveal.test.tsx covers the walk itself).

vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const appCss = readFileSync(join(SRC_DIR, 'App.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const ROULETTE_IDLE_HEADING = 'No spins yet';
const ROULETTE_IDLE_BODY =
  'Pick a color, a number, or both on the layout, then click Spin 100 to see how often your prediction comes in. Switch the wheel between single and double zero to see the odds shift.';
const RED: PredictionTarget = { kind: 'color', color: 'red' };

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
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
  useRouletteStore.setState({ wheel: 'european', color: null, number: null, spins: [], revealed: 0 });
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
  usePickerStore.getState().clearAll();
  useGameModeStore.setState({ mode: 'holdem', holdemRestorePending: false, blackjackRestorePending: false });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockReset();
  vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mockReset();

  vi.mocked(simulationService.startSimulation).mockImplementation(
    async (_conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      onProgress({
        requestId: 1,
        categoryCounts: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        outcomes: { win: 50, tie: 0, lose: 50 },
        trialsCompleted: 100,
        done: true,
      });
    },
  );
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

function renderInRoulette() {
  useGameModeStore.setState({ mode: 'roulette' });
  return render(<App />);
}

function sessionBar(): HTMLElement {
  const bars = document.querySelectorAll<HTMLElement>('.control-bar--session');
  expect(bars).toHaveLength(1);
  return bars[0];
}

beforeEach(() => {
  resetStores();
});

describe('the switcher has three segments and Roulette mounts its own tree', () => {
  it("renders Hold'em, Blackjack and Roulette, with Roulette unpressed and absent by default", () => {
    render(<App />);
    const switcher = screen.getByTestId('game-mode-switcher');
    expect(switcher.querySelectorAll('button')).toHaveLength(3);
    const roulette = screen.getByTestId('game-mode-switch-roulette');
    expect(roulette).toHaveTextContent('Roulette');
    expect(roulette).toHaveAttribute('aria-pressed', 'false');
    expect(roulette).not.toBeDisabled();
    expect(screen.queryByTestId('roulette-scene')).not.toBeInTheDocument();
  });

  it('clicking Roulette flips aria-pressed, mounts the felt and odds panel, and unmounts the other games', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-roulette'));

    expect(useGameModeStore.getState().mode).toBe('roulette');
    expect(screen.getByTestId('game-mode-switch-roulette')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('roulette-scene')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-odds-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('table-scene')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blackjack-scene')).not.toBeInTheDocument();
  });

  it('shows the locked idle copy, page-level, until the first batch', async () => {
    renderInRoulette();
    const idle = screen.getByTestId('roulette-empty-state');
    expect(idle).toHaveClass('empty-hand-state');
    expect(idle.querySelector('h2')?.textContent).toBe(ROULETTE_IDLE_HEADING);
    expect(idle.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(ROULETTE_IDLE_BODY);
    expect(screen.getByTestId('roulette-scene').contains(idle)).toBe(false);
  });

  it('the wordmark is unchanged', () => {
    renderInRoulette();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Monte Carlo Poker Simulator');
  });
});

describe('the session bar and the on-felt cluster keep the shape the other games have', () => {
  it('the session bar holds exactly the switcher then the wheel toggle, and precedes the felt', () => {
    renderInRoulette();
    const bar = sessionBar();
    const children = Array.from(bar.children);
    expect(children).toHaveLength(2);
    expect(children[0]).toBe(screen.getByTestId('game-mode-switcher'));
    expect(children[1]).toBe(screen.getByTestId('roulette-wheel-toggle'));
    expect(screen.getByTestId('roulette-wheel-toggle')).toHaveAttribute('role', 'group');
    expect(screen.getByTestId('roulette-wheel-toggle')).toHaveAttribute('aria-label', 'Wheel');
    expect(Boolean(bar.compareDocumentPosition(screen.getByTestId('roulette-scene')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('every button in the session bar is a segment of one of the two segmented controls', () => {
    renderInRoulette();
    for (const button of sessionBar().querySelectorAll('button')) {
      expect(
        button.matches("[data-testid^='game-mode-switch-'], [data-testid^='roulette-wheel-toggle-']"),
        `${button.textContent} is in the session bar but is not a segment`,
      ).toBe(true);
    }
  });

  it('the felt subtree holds exactly the layout buttons plus Spin and Reset, on the shared plate', () => {
    renderInRoulette();
    const scene = screen.getByTestId('roulette-scene');
    const cluster = scene.querySelector('.felt-controls');
    expect(cluster).not.toBeNull();
    expect(cluster).toHaveClass('felt-controls--roulette');
    expect(scene.contains(screen.getByTestId('roulette-wheel-toggle'))).toBe(false);
    expect(scene.contains(screen.getByTestId('game-mode-switcher'))).toBe(false);
    // 37 pockets + 3 colours on the layout, Spin + Reset on the plate.
    expect(scene.querySelectorAll('button')).toHaveLength(37 + 3 + 2);
    expect(Array.from((cluster as HTMLElement).querySelectorAll('button')).map((b) => b.dataset.testid)).toEqual([
      'roulette-spin-button',
      'roulette-reset-button',
    ]);
  });

  it('App.css extends the shared segmented-control, dimming and panel rules with the roulette selectors — never a duplicated block', () => {
    const chunks = appCss.split('}');
    const one = (...tokens: string[]) => {
      const matches = chunks.filter((chunk) => tokens.every((token) => chunk.includes(token)));
      expect(matches, `exactly one rule with ${tokens.join(' + ')}`).toHaveLength(1);
      return matches[0];
    };
    expect(one("[data-testid='game-mode-switcher']", 'display: inline-flex')).toContain("[data-testid='roulette-wheel-toggle']");
    expect(one("[data-testid^='game-mode-switch-']", 'min-width: 44px')).toContain("[data-testid^='roulette-wheel-toggle-']");
    expect(one("[data-testid='game-mode-switch-holdem']", 'border-right')).toContain("[data-testid='roulette-wheel-toggle-european']");
    // Blackjack's segment is no longer the switcher's last, so it needs the divider too.
    expect(one("[data-testid='game-mode-switch-holdem']", 'border-right')).toContain("[data-testid='game-mode-switch-blackjack']");
    expect(one("[data-testid^='game-mode-switch-'][aria-pressed='true']")).toContain("[data-testid^='roulette-wheel-toggle-'][aria-pressed='true']");
    expect(one("[data-testid='blackjack-deck-toggle-1']:disabled")).toContain("[data-testid='roulette-spin-button']:disabled");
    expect(one("[data-testid='odds-panel']", 'min-width: 460px')).toContain("[data-testid='roulette-odds-panel']");
    expect(appCss).toContain('.felt-controls--roulette {');
    expect(appCss).toContain('.felt--roulette {');
  });
});

describe('the loop: pick, Spin 100, read the odds', () => {
  it('Spin is disabled, untitled as next, and explains itself until a prediction exists', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    const spin = screen.getByTestId('roulette-spin-button');
    expect(spin).toHaveTextContent('Spin 100');
    expect(spin).toBeDisabled();
    expect(spin).not.toHaveAttribute('data-next-action');
    expect(spin).toHaveAttribute('title', 'Pick a color or a number first');
    expect(screen.getByTestId('roulette-reset-button')).toBeDisabled();
    expect(screen.getByTestId('roulette-no-prediction')).toBeInTheDocument();

    await user.click(screen.getByTestId('roulette-color-red'));

    expect(spin).not.toBeDisabled();
    expect(spin).toHaveAttribute('data-next-action', 'true');
    expect(spin).not.toHaveAttribute('title');
    expect(screen.queryByTestId('roulette-no-prediction')).not.toBeInTheDocument();
    // Exactly one next-action signal on screen, and never a disabled one.
    const marked = document.querySelectorAll('[data-next-action="true"]');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(spin);
  });

  it('a colour prediction: 100 spins land, and every readout is derived from the same history', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-red'));
    expect(screen.getByTestId('roulette-color-true').textContent).toBe('48.6%');
    expect(screen.getByTestId('roulette-color-observed').textContent).toBe('—');
    expect(screen.getByTestId('roulette-color-hits').textContent).toBe('0 of 0');
    expect(screen.getByTestId('roulette-color-expected').textContent).toBe('—');
    expect(screen.getByTestId('roulette-color-net').textContent).toBe('—');

    await user.click(screen.getByTestId('roulette-spin-button'));

    const { spins, revealed } = useRouletteStore.getState();
    expect(spins).toHaveLength(SPINS_PER_BATCH);
    expect(revealed).toBe(SPINS_PER_BATCH);
    const hits = countHits(spins, RED);

    expect(screen.queryByTestId('roulette-empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('100');
    expect(screen.getByTestId('roulette-color-hits').textContent).toBe(`${hits} of 100`);
    expect(screen.getByTestId('roulette-color-observed').textContent).toBe(formatPct(hits, 100, false));
    expect(screen.getByTestId('roulette-color-expected').textContent).toBe('48.6');
    expect(screen.getByTestId('roulette-color-net').textContent).toBe(`${formatSignedUnits(hits - (100 - hits))} units`);
    expect(Number.parseFloat(screen.getByTestId('roulette-color-gauge-fill').style.width)).toBeCloseTo(hits, 6);
    expect(Number.parseFloat(screen.getByTestId('roulette-color-gauge-mark').style.left)).toBeCloseTo(48.6, 6);
    expect(screen.getByTestId('roulette-color-score')).toHaveTextContent('18 of 37 pockets · pays 1 to 1');

    // The wheel shows the LAST spin, the marquee the whole batch newest first.
    expect(screen.getByTestId('roulette-last-spin').textContent).toBe(spins[99]);
    expect(screen.getByTestId('roulette-wheel-ball')).toBeInTheDocument();
    const chips = screen.getByTestId('roulette-history').querySelectorAll('li');
    expect(chips).toHaveLength(100);
    expect(chips[0]).toHaveAttribute('title', spins[99]);
    expect(chips[0]).toHaveClass('roulette-chip--latest');
    expect(chips[99]).toHaveAttribute('title', spins[0]);

    // The landed table accounts for every spin across the three colours.
    const landed = ['red', 'black', 'green'].map((shade) =>
      Number(screen.getByTestId(`roulette-landed-count-${shade}`).textContent),
    );
    expect(landed.reduce((a, b) => a + b, 0)).toBe(100);
    expect(landed[0]).toBe(hits);
    expect(screen.getByTestId('roulette-landed-pct-red').textContent).toBe(formatPct(hits, 100, false));
    expect(screen.getByTestId('roulette-landed-true-red').textContent).toBe('48.6%');
    expect(screen.getByTestId('roulette-landed-true-green').textContent).toBe('2.7%');
    expect(screen.getByTestId('roulette-reset-button')).not.toBeDisabled();
  });

  it('a straight-up pocket beside the colour: both are scored, and a second batch accumulates to 200', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-black'));
    await user.click(screen.getByTestId('roulette-pocket-17'));
    expect(screen.getByTestId('roulette-number-score')).toHaveTextContent('17');
    expect(screen.getByTestId('roulette-number-score')).toHaveTextContent('1 of 37 pockets · pays 35 to 1');
    expect(screen.getByTestId('roulette-number-true').textContent).toBe('2.7%');

    await user.click(screen.getByTestId('roulette-spin-button'));
    await user.click(screen.getByTestId('roulette-spin-button'));

    const { spins } = useRouletteStore.getState();
    expect(spins).toHaveLength(200);
    const numberHits = countHits(spins, { kind: 'number', pocket: '17' });
    const blackHits = countHits(spins, { kind: 'color', color: 'black' });
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('200');
    expect(screen.getByTestId('roulette-number-hits').textContent).toBe(`${numberHits} of 200`);
    expect(screen.getByTestId('roulette-number-expected').textContent).toBe((200 / 37).toFixed(1));
    expect(screen.getByTestId('roulette-number-net').textContent).toBe(
      `${formatSignedUnits(numberHits * 35 - (200 - numberHits))} units`,
    );
    expect(screen.getByTestId('roulette-color-hits').textContent).toBe(`${blackHits} of 200`);
    // The marquee caps at the latest 100.
    expect(screen.getByTestId('roulette-history').querySelectorAll('li')).toHaveLength(100);
  });

  it('changing the prediction re-scores the SAME history — the spins do not change', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-red'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    const spinsBefore = useRouletteStore.getState().spins;

    await user.click(screen.getByTestId('roulette-color-black'));

    expect(useRouletteStore.getState().spins).toBe(spinsBefore);
    expect(screen.getByTestId('roulette-color-score')).toHaveTextContent('Black');
    expect(screen.getByTestId('roulette-color-hits').textContent).toBe(
      `${countHits(spinsBefore, { kind: 'color', color: 'black' })} of 100`,
    );
  });

  it('Reset clears the history and brings the idle copy back, keeping the prediction', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-pocket-0'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    expect(screen.queryByTestId('roulette-empty-state')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('roulette-reset-button'));

    expect(screen.getByTestId('roulette-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('0');
    expect(screen.getByTestId('roulette-pocket-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('roulette-number-hits').textContent).toBe('0 of 0');
    expect(screen.getByTestId('roulette-reset-button')).toBeDisabled();
    expect(screen.queryByTestId('roulette-wheel-ball')).not.toBeInTheDocument();
  });
});

describe('the wheel toggle changes the odds and discards the history', () => {
  it('double zero: 00 appears on the layout and the wheel, every true probability moves, the printed edge doubles', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-red'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('100');
    expect(screen.queryByTestId('roulette-pocket-00')).not.toBeInTheDocument();
    expect(screen.getByTestId('roulette-edge-pct').textContent).toBe('2.70%');

    await user.click(screen.getByTestId('roulette-wheel-toggle-american'));

    expect(screen.getByTestId('roulette-wheel-toggle-american')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('roulette-wheel-toggle-european')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('roulette-pocket-00')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-wheel-pocket-00')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-color-true').textContent).toBe('47.4%');
    expect(screen.getByTestId('roulette-landed-true-green').textContent).toBe('5.3%');
    expect(screen.getByTestId('roulette-edge-pct').textContent).toBe('5.26%');
    expect(screen.getByTestId('roulette-house-edge')).toHaveTextContent('HOUSE EDGE 5.26%');
    // The history was spun on the other wheel: gone, and the idle copy is back.
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('0');
    expect(screen.getByTestId('roulette-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-color-red')).toHaveAttribute('aria-pressed', 'true');
  });

  it('a 00 prediction does not survive the switch back to single zero', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-wheel-toggle-american'));
    await user.click(screen.getByTestId('roulette-pocket-00'));
    expect(screen.getByTestId('roulette-number-score')).toHaveTextContent('00');

    await user.click(screen.getByTestId('roulette-wheel-toggle-european'));

    expect(screen.queryByTestId('roulette-number-score')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roulette-pocket-00')).not.toBeInTheDocument();
    expect(useRouletteStore.getState().number).toBeNull();
  });

  it('clicking the already-active wheel segment is a no-op that keeps the history', async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-green'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    const before = useRouletteStore.getState().spins;

    await user.click(screen.getByTestId('roulette-wheel-toggle-european'));

    expect(useRouletteStore.getState().spins).toBe(before);
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('100');
  });
});

describe('a mode round trip preserves the roulette history and spins nothing new', () => {
  it("Roulette -> Hold'em -> Roulette: same spins, same readouts, holdemRestorePending was raised on the way out", async () => {
    const user = userEvent.setup();
    renderInRoulette();

    await user.click(screen.getByTestId('roulette-color-red'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    const spinsBefore = useRouletteStore.getState().spins;
    const hitsBefore = screen.getByTestId('roulette-color-hits').textContent;

    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    expect(screen.getByTestId('table-scene')).toBeInTheDocument();
    expect(screen.queryByTestId('roulette-scene')).not.toBeInTheDocument();
    // The Hold'em tree acknowledged its restore on commit (the flag is raised by any switch
    // INTO holdem and cleared by HoldemGame's effect) — what matters here is that it was
    // consumed, not left stale.
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);

    await user.click(screen.getByTestId('game-mode-switch-roulette'));

    expect(useRouletteStore.getState().spins).toBe(spinsBefore);
    expect(screen.getByTestId('roulette-color-hits').textContent).toBe(hitsBefore);
    expect(screen.getByTestId('roulette-spin-counter').textContent).toBe('100');
    expect(screen.getByTestId('roulette-color-red')).toHaveAttribute('aria-pressed', 'true');
  });

  it('the Hold\'em and Blackjack simulations are never started by a roulette dwell', async () => {
    const user = userEvent.setup();
    renderInRoulette();
    await user.click(screen.getByTestId('roulette-color-red'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    await user.click(screen.getByTestId('roulette-spin-button'));
    expect(vi.mocked(simulationService.startSimulation)).not.toHaveBeenCalled();
    expect(vi.mocked(blackjackSimulationService.startBlackjackSimulation)).not.toHaveBeenCalled();
  });
});

describe('DOM-absence sweeps — three games, both ways', () => {
  /** Puts the roulette store in the state where `testid` is non-vacuously present. */
  function seedRoulettePresence(testid: string) {
    if (testid === 'roulette-empty-state' || testid === 'roulette-no-prediction') return;
    const prediction = testid.startsWith('roulette-number-') ? { number: '17' } : { color: 'red' as const };
    useRouletteStore.setState({
      ...prediction,
      spins: ['17', '32', '0', '5', '17'],
      revealed: 5,
    });
  }

  it.each(ROULETTE_ONLY_TESTIDS)(
    '%s is present in Roulette mode and absent from the DOM in both Hold\'em and Blackjack',
    async (testid) => {
      const user = userEvent.setup();
      seedRoulettePresence(testid);
      renderInRoulette();

      expect(
        screen.getByTestId(testid),
        `expected ${testid} to be present in Roulette mode — an absence assertion against a testid that was never present proves nothing`,
      ).toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-holdem'));
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-blackjack'));
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    },
  );

  it.each(HOLDEM_ONLY_TESTIDS)(
    "%s is present in Hold'em mode and absent from the DOM once mode is roulette",
    async (testid) => {
      const user = userEvent.setup();
      render(<App />);
      if (testid !== 'empty-hand-state') {
        await user.click(screen.getByRole('button', { name: /^deal$/i }));
        await user.click(screen.getByTestId('advance-button'));
        await user.click(screen.getByTestId('set-up-scenario-button'));
      }
      expect(screen.getByTestId(testid)).toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-roulette'));

      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    },
  );

  /** A deterministic mid-round blackjack state, seeded BEFORE the switch so no gate arms. */
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
    '%s is present in Blackjack mode and absent from the DOM once mode is roulette',
    async (testid) => {
      const user = userEvent.setup();
      render(<App />);

      if (testid === 'blackjack-empty-state') {
        // idle by default
      } else if (testid === 'blackjack-outcome-banner') {
        seedPlayerTurn({ roundPhase: 'resolved', revealedHole: true, outcome: 'win' });
      } else if (testid === 'blackjack-dealer-total') {
        seedPlayerTurn({ revealedHole: true });
      } else if (testid === 'blackjack-simulation-error' || testid === 'blackjack-simulation-error-detail') {
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
        seedPlayerTurn();
      }

      await user.click(screen.getByTestId('game-mode-switch-blackjack'));
      expect(screen.getByTestId(testid)).toBeInTheDocument();

      await user.click(screen.getByTestId('game-mode-switch-roulette'));

      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    },
  );

  it('switching Blackjack -> Roulette tears the blackjack run down (the effect cleanup cancels it)', async () => {
    const user = userEvent.setup();
    render(<App />);
    seedPlayerTurn();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    const cancelsBefore = vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mock.calls.length;

    await user.click(screen.getByTestId('game-mode-switch-roulette'));

    expect(vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mock.calls.length).toBeGreaterThan(
      cancelsBefore,
    );
    act(() => {});
  });
});
