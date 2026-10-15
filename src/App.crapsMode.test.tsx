import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
import { useRouletteStore } from './state/rouletteStore';
import { useCrapsStore } from './state/crapsStore';
import { HOLDEM_ONLY_TESTIDS } from './test/holdemTestids';
import { BLACKJACK_ONLY_TESTIDS } from './test/blackjackTestids';
import { ROULETTE_ONLY_TESTIDS } from './test/rouletteTestids';
import { CRAPS_ONLY_TESTIDS } from './test/crapsTestids';
import { TRIALS_PER_BATCH, countTotals, runTrials, tallyTrials, winProbability } from './engine/craps';
import { createRng } from './engine/rng';
import { formatSignedUnits } from './engine/predictionScore';
import { formatPct } from './ui/formatPct';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';
import type { BlackjackProgressSnapshot } from './worker/blackjackProtocol';
import type { BlackjackConditionedState } from './engine/blackjackEquity';
import type { Card } from '@poker-apprentice/types';

// Craps as the fourth game mode (quick task 261015-d7o) — the sibling of App.rouletteMode.test.tsx,
// pinning the same things one game further along: a FOUR-segment switcher, a tree of its own,
// the user's loop (pick a bet, Roll 100, read win rate / true odds / wins / expected / net with
// every number re-derived from the store's own history), the Field house-rule toggle, and the
// DOM-absence contract extended four ways.

vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const CRAPS_IDLE_HEADING = 'No rolls yet';
const CRAPS_IDLE_BODY =
  "Pick a bet on the layout, then click Roll 100 to see how often it wins. Switch the Field's 12 between triple and double to see the house edge shift.";

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
  useCrapsStore.setState({ bet: null, fieldRule: 'triple12', trials: [], revealed: 0 });
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

function renderInCraps() {
  useGameModeStore.setState({ mode: 'craps' });
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

describe('the switcher has four segments and Craps mounts its own tree', () => {
  it('renders four segments with Craps last, unpressed and absent by default', () => {
    render(<App />);
    const switcher = screen.getByTestId('game-mode-switcher');
    const buttons = switcher.querySelectorAll('button');
    expect(buttons).toHaveLength(4);
    expect(buttons[3]).toBe(screen.getByTestId('game-mode-switch-craps'));
    expect(buttons[3]).toHaveTextContent('Craps');
    expect(buttons[3]).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('craps-scene')).not.toBeInTheDocument();
  });

  it('clicking Craps mounts the felt and odds panel and unmounts the other three games', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('game-mode-switch-craps'));

    expect(useGameModeStore.getState().mode).toBe('craps');
    expect(screen.getByTestId('game-mode-switch-craps')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('craps-scene')).toBeInTheDocument();
    expect(screen.getByTestId('craps-odds-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('table-scene')).not.toBeInTheDocument();
    expect(screen.queryByTestId('blackjack-scene')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roulette-scene')).not.toBeInTheDocument();
  });

  it('shows the locked idle copy, page-level, until the first batch', () => {
    renderInCraps();
    const idle = screen.getByTestId('craps-empty-state');
    expect(idle).toHaveClass('empty-hand-state');
    expect(idle.querySelector('h2')?.textContent).toBe(CRAPS_IDLE_HEADING);
    expect(idle.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(CRAPS_IDLE_BODY);
    expect(screen.getByTestId('craps-scene').contains(idle)).toBe(false);
  });

  it('the session bar holds exactly the switcher then the Field toggle; the felt holds the seven bets plus Roll and Reset', () => {
    renderInCraps();
    const bar = sessionBar();
    expect(Array.from(bar.children)).toHaveLength(2);
    expect(bar.children[0]).toBe(screen.getByTestId('game-mode-switcher'));
    expect(bar.children[1]).toBe(screen.getByTestId('craps-field-toggle'));
    expect(screen.getByTestId('craps-field-toggle')).toHaveAttribute('aria-label', 'Field 12 pays');
    for (const button of bar.querySelectorAll('button')) {
      expect(button.matches("[data-testid^='game-mode-switch-'], [data-testid^='craps-field-toggle-']")).toBe(true);
    }

    const scene = screen.getByTestId('craps-scene');
    const cluster = scene.querySelector('.felt-controls');
    expect(cluster).toHaveClass('felt-controls--craps');
    expect(scene.querySelectorAll('button')).toHaveLength(7 + 2);
    expect(Array.from((cluster as HTMLElement).querySelectorAll('button')).map((b) => b.dataset.testid)).toEqual([
      'craps-roll-button',
      'craps-reset-button',
    ]);
    expect(scene.contains(screen.getByTestId('craps-field-toggle'))).toBe(false);
  });
});

describe('the loop: pick a bet, Roll 100, read the odds', () => {
  it('Roll is disabled and unmarked until a bet exists, then carries the single next-action signal', async () => {
    const user = userEvent.setup();
    renderInCraps();

    const roll = screen.getByTestId('craps-roll-button');
    expect(roll).toHaveTextContent('Roll 100');
    expect(roll).toBeDisabled();
    expect(roll).not.toHaveAttribute('data-next-action');
    expect(roll).toHaveAttribute('title', 'Pick a bet first');
    expect(screen.getByTestId('craps-no-bet')).toBeInTheDocument();
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('—');

    await user.click(screen.getByTestId('craps-bet-pass'));

    expect(roll).not.toBeDisabled();
    expect(roll).toHaveAttribute('data-next-action', 'true');
    expect(document.querySelectorAll('[data-next-action="true"]')).toHaveLength(1);
    expect(screen.queryByTestId('craps-no-bet')).not.toBeInTheDocument();
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('1.41%');
    expect(screen.getByTestId('craps-bet-true').textContent).toBe('49.3%');
    expect(screen.getByTestId('craps-bet-observed').textContent).toBe('—');
    expect(screen.getByTestId('craps-bet-hits').textContent).toBe('0 of 0');
    expect(screen.queryByTestId('craps-bet-pushes')).not.toBeInTheDocument();
  });

  it('Pass line: 100 decisions land, and every readout is derived from the same history', async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-pass'));
    await user.click(screen.getByTestId('craps-roll-button'));

    const { trials, revealed } = useCrapsStore.getState();
    expect(trials).toHaveLength(TRIALS_PER_BATCH);
    expect(revealed).toBe(TRIALS_PER_BATCH);
    const tally = tallyTrials(trials);
    const totals = countTotals(trials);
    const rolls = [...totals.values()].reduce((a, b) => a + b, 0);

    expect(screen.queryByTestId('craps-empty-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('100');
    expect(screen.getByTestId('craps-roll-counter').textContent).toBe(rolls.toLocaleString());
    expect(screen.getByTestId('craps-bet-hits').textContent).toBe(`${tally.hits} of 100`);
    expect(screen.getByTestId('craps-bet-observed').textContent).toBe(formatPct(tally.hits, 100, false));
    expect(screen.getByTestId('craps-bet-expected').textContent).toBe((winProbability('pass') * 100).toFixed(1));
    expect(screen.getByTestId('craps-bet-net').textContent).toBe(`${formatSignedUnits(tally.netUnits)} units`);
    expect(Number.parseFloat(screen.getByTestId('craps-bet-gauge-fill').style.width)).toBeCloseTo(tally.hits, 6);
    expect(Number.parseFloat(screen.getByTestId('craps-bet-gauge-mark').style.left)).toBeCloseTo(49.3, 6);
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('pays 1 to 1');

    // The dice show the last roll of the last decision; the totals table accounts for every roll.
    const last = trials[99].rolls[trials[99].rolls.length - 1];
    expect(screen.getByTestId('craps-die-0')).toHaveAttribute('aria-label', `Die showing ${last[0]}`);
    expect(screen.getByTestId('craps-die-1')).toHaveAttribute('aria-label', `Die showing ${last[1]}`);
    expect(screen.getByTestId('craps-last-trial')).toBeInTheDocument();
    const counted = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((total) =>
      Number(screen.getByTestId(`craps-total-count-${total}`).textContent),
    );
    expect(counted.reduce((a, b) => a + b, 0)).toBe(rolls);
    expect(screen.getByTestId('craps-total-count-7').textContent).toBe(String(totals.get(7)));
    expect(screen.getByTestId('craps-total-true-7').textContent).toBe('16.7%');
    expect(screen.getByTestId('craps-total-true-2').textContent).toBe('2.8%');
    expect(screen.getByTestId('craps-history').querySelectorAll('li')).toHaveLength(100);
    expect(screen.getByTestId('craps-history').querySelector('li')).toHaveClass(`craps-chip--${trials[99].outcome}`);
    expect(screen.getByTestId('craps-reset-button')).not.toBeDisabled();
  });

  it("Don't pass reports pushes; a second batch accumulates to 200", async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-dontPass'));
    expect(screen.getByTestId('craps-bet-pushes').textContent).toBe('—');
    expect(screen.getByTestId('craps-bet-true').textContent).toBe('47.9%');
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('bar 12');

    await user.click(screen.getByTestId('craps-roll-button'));
    await user.click(screen.getByTestId('craps-roll-button'));

    const tally = tallyTrials(useCrapsStore.getState().trials);
    expect(tally.trials).toBe(200);
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('200');
    expect(screen.getByTestId('craps-bet-pushes').textContent).toBe(`${tally.pushes} (true 2.8%)`);
    expect(screen.getByTestId('craps-bet-hits').textContent).toBe(`${tally.hits} of 200`);
    expect(screen.getByTestId('craps-history').querySelectorAll('li')).toHaveLength(100);
  });

  it('changing the bet discards the history and brings the idle copy back', async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-anySeven'));
    await user.click(screen.getByTestId('craps-roll-button'));
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('100');
    expect(screen.getByTestId('craps-bet-true').textContent).toBe('16.7%');
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('pays 4 to 1');

    await user.click(screen.getByTestId('craps-bet-place6'));

    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('0');
    expect(screen.getByTestId('craps-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('craps-bet-true').textContent).toBe('45.5%');
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('pays 7 to 6');
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('1.52%');
  });

  it('Reset clears the history, keeps the bet, and disables itself', async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-field'));
    await user.click(screen.getByTestId('craps-roll-button'));
    await user.click(screen.getByTestId('craps-reset-button'));

    expect(screen.getByTestId('craps-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('0');
    expect(screen.getByTestId('craps-bet-field')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('craps-reset-button')).toBeDisabled();
    expect(screen.getByTestId('craps-dice-placeholder')).toBeInTheDocument();
  });
});

describe('the Field house rule', () => {
  it('moves the Field edge 2.78% -> 5.56%, changes the payout line, and clears a Field history', async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-field'));
    await user.click(screen.getByTestId('craps-roll-button'));
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('2.78%');
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('12 pays triple');
    expect(screen.getByTestId('craps-house-edge')).toHaveTextContent('FIELD · HOUSE EDGE 2.78%');

    await user.click(screen.getByTestId('craps-field-toggle-double12'));

    expect(screen.getByTestId('craps-field-toggle-double12')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('5.56%');
    expect(screen.getByTestId('craps-bet-score')).toHaveTextContent('12 pays double');
    expect(screen.getByTestId('craps-house-edge')).toHaveTextContent('FIELD · HOUSE EDGE 5.56%');
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('0');
    expect(screen.getByTestId('craps-bet-true').textContent).toBe('44.4%');
  });

  it('leaves a Pass line history alone — the rule touches only the Field', async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-pass'));
    await user.click(screen.getByTestId('craps-roll-button'));
    const before = useCrapsStore.getState().trials;

    await user.click(screen.getByTestId('craps-field-toggle-double12'));

    expect(useCrapsStore.getState().trials).toBe(before);
    expect(screen.getByTestId('craps-trial-counter').textContent).toBe('100');
    expect(screen.getByTestId('craps-edge-pct').textContent).toBe('1.41%');
  });
});

describe('a mode round trip preserves the craps history and starts no simulation', () => {
  it("Craps -> Roulette -> Hold'em -> Craps: same decisions, same readouts", async () => {
    const user = userEvent.setup();
    renderInCraps();

    await user.click(screen.getByTestId('craps-bet-pass'));
    await user.click(screen.getByTestId('craps-roll-button'));
    const trialsBefore = useCrapsStore.getState().trials;
    const hitsBefore = screen.getByTestId('craps-bet-hits').textContent;

    await user.click(screen.getByTestId('game-mode-switch-roulette'));
    expect(screen.getByTestId('roulette-scene')).toBeInTheDocument();
    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    expect(screen.getByTestId('table-scene')).toBeInTheDocument();
    await user.click(screen.getByTestId('game-mode-switch-craps'));

    expect(useCrapsStore.getState().trials).toBe(trialsBefore);
    expect(screen.getByTestId('craps-bet-hits').textContent).toBe(hitsBefore);
    expect(screen.getByTestId('craps-bet-pass')).toHaveAttribute('aria-pressed', 'true');
    expect(vi.mocked(simulationService.startSimulation)).not.toHaveBeenCalled();
    expect(vi.mocked(blackjackSimulationService.startBlackjackSimulation)).not.toHaveBeenCalled();
  });
});

describe('DOM-absence sweeps — four games', () => {
  /** Puts the craps store in the state where `testid` is non-vacuously present. */
  function seedCrapsPresence(testid: string) {
    if (testid === 'craps-empty-state' || testid === 'craps-no-bet' || testid === 'craps-dice-placeholder') return;
    const bet = testid === 'craps-bet-pushes' ? 'dontPass' : 'pass';
    useCrapsStore.setState({ bet, trials: runTrials(createRng(7), bet, 'triple12', 5), revealed: 5 });
  }

  it.each(CRAPS_ONLY_TESTIDS)('%s is present in Craps mode and absent in Hold\'em, Blackjack and Roulette', async (testid) => {
    const user = userEvent.setup();
    seedCrapsPresence(testid);
    renderInCraps();

    expect(screen.getByTestId(testid), `expected ${testid} to be present in Craps mode`).toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    await user.click(screen.getByTestId('game-mode-switch-roulette'));
    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
  });

  it.each(HOLDEM_ONLY_TESTIDS)("%s is present in Hold'em mode and absent once mode is craps", async (testid) => {
    const user = userEvent.setup();
    render(<App />);
    if (testid !== 'empty-hand-state') {
      await user.click(screen.getByRole('button', { name: /^deal$/i }));
      await user.click(screen.getByTestId('advance-button'));
      await user.click(screen.getByTestId('set-up-scenario-button'));
    }
    expect(screen.getByTestId(testid)).toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-craps'));

    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
  });

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

  it.each(BLACKJACK_ONLY_TESTIDS)('%s is present in Blackjack mode and absent once mode is craps', async (testid) => {
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

    await user.click(screen.getByTestId('game-mode-switch-craps'));

    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
  });

  function seedRoulettePresence(testid: string) {
    if (testid === 'roulette-empty-state' || testid === 'roulette-no-prediction') return;
    const prediction = testid.startsWith('roulette-number-') ? { number: '17' } : { color: 'red' as const };
    useRouletteStore.setState({ ...prediction, spins: ['17', '32', '0', '5', '17'], revealed: 5 });
  }

  it.each(ROULETTE_ONLY_TESTIDS)('%s is present in Roulette mode and absent once mode is craps', async (testid) => {
    const user = userEvent.setup();
    seedRoulettePresence(testid);
    useGameModeStore.setState({ mode: 'roulette' });
    render(<App />);
    expect(screen.getByTestId(testid)).toBeInTheDocument();

    await user.click(screen.getByTestId('game-mode-switch-craps'));

    expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
  });
});
