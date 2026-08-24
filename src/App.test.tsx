import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';
import { CATEGORY_LABELS } from './ui/categoryLabels';

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. A factory sidesteps that entirely, per this test's purpose (UI wiring, not the worker
// boundary — that's covered by simulationApi.test.ts and the phase acceptance checkpoint).
// cancelSimulation is now exported too, since App's effect cleanup (02-02) calls it on every
// street/deal change.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

describe('App — Deal happy path', () => {
  beforeEach(() => {
    resetStores();
  });

  it('deals a hero hand and shows three hidden opponents when Deal is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dealButton = screen.getByRole('button', { name: /^deal$/i });
    await user.click(dealButton);

    const heroHole = screen.getByTestId('hero-hole');
    expect(heroHole.children).toHaveLength(2);
    for (const child of Array.from(heroHole.children)) {
      const img = child.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('alt')).not.toBe('');
    }

    const opponents = screen.getByTestId('opponents');
    expect(opponents.children).toHaveLength(3);
  });

  it('shows a climbing trial counter and win/tie/lose percentages driven by streamed snapshots', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(async (_conditioned, onProgress) => {
      const snapshots: ProgressSnapshot[] = [
        {
          requestId: 1,
          categoryCounts: new Array(10).fill(0),
          outcomes: { win: 30, tie: 5, lose: 15 },
          trialsCompleted: 50,
          done: false,
        },
        {
          requestId: 1,
          categoryCounts: new Array(10).fill(0),
          outcomes: { win: 60, tie: 10, lose: 30 },
          trialsCompleted: 100,
          done: true,
        },
      ];
      for (const snapshot of snapshots) {
        onProgress(snapshot);
      }
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(screen.getByTestId('trial-counter').textContent).toBe('100');
    expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');
    expect(screen.getByTestId('tie-pct').textContent).toBe('10.0%');
    expect(screen.getByTestId('lose-pct').textContent).toBe('30.0%');

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(1);
  });

  it('resets and calls startSimulation again when Deal is clicked a second time', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    // requestId is now allocated internally by simulationService (D-13, service-owned
    // generation counter), so this regression guard asserts the effect re-fires on a new
    // dealNonce rather than inspecting a requestId argument that no longer exists.
    expect(simulationService.startSimulation).toHaveBeenCalledTimes(2);
  });

  it('renders a live 10-row hand-category probability table driven by streamed snapshots', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(async (_conditioned, onProgress) => {
      const snapshot: ProgressSnapshot = {
        requestId: 1,
        categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1],
        outcomes: { win: 600, tie: 100, lose: 300 },
        trialsCompleted: 1000,
        done: true,
      };
      onProgress(snapshot);
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const table = screen.getByTestId('category-table');
    expect(table).toBeInTheDocument();

    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(10);

    const rowLabels = Array.from(rows).map((row) => row.querySelector('th')?.textContent);
    expect(rowLabels).toEqual([...CATEGORY_LABELS]);
    expect(rowLabels[rowLabels.length - 1]).toBe('Royal Flush');

    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');

    const totalPct = Array.from({ length: 10 }, (_, i) => {
      const text = screen.getByTestId(`category-pct-${i}`).textContent ?? '0%';
      return Number.parseFloat(text.replace('%', ''));
    }).reduce((a, b) => a + b, 0);
    expect(Math.abs(totalPct - 100)).toBeLessThan(0.5);
  });
});

describe('App — street navigation drives conditioned recomputation', () => {
  beforeEach(() => {
    resetStores();
  });

  it('Deal calls startSimulation once with an empty known board and all opponents hidden', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(1);
    const conditioned = vi.mocked(simulationService.startSimulation).mock.calls[0][0] as ConditionedState;
    expect(conditioned.knownBoard).toEqual([]);
    expect(conditioned.knownOpponentHoles).toEqual([null, null, null]);
  });

  it('Deal produces a remainingDeck that still contains every hidden board and opponent card (D-02 leak guard)', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const conditioned = vi.mocked(simulationService.startSimulation).mock.calls[0][0] as ConditionedState;
    const { runout } = useGameStore.getState();
    expect(runout).not.toBeNull();
    for (const boardCard of runout!.board) {
      expect(conditioned.remainingDeck).toContain(boardCard);
    }
    for (const hole of runout!.opponentHoles) {
      expect(conditioned.remainingDeck).toContain(hole[0]);
      expect(conditioned.remainingDeck).toContain(hole[1]);
    }
  });

  it('Advance calls startSimulation again with the first 3 board cards known', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(2);
    const conditioned = vi.mocked(simulationService.startSimulation).mock.calls[1][0] as ConditionedState;
    const { runout } = useGameStore.getState();
    expect(conditioned.knownBoard).toHaveLength(3);
    expect(conditioned.knownBoard).toEqual(runout!.board.slice(0, 3));
  });

  it('advancing twice more yields a known board of 4 then 5 cards', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('advance-button'));

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(4);
    const calls = vi.mocked(simulationService.startSimulation).mock.calls;
    expect((calls[2][0] as ConditionedState).knownBoard).toHaveLength(4);
    expect((calls[3][0] as ConditionedState).knownBoard).toHaveLength(5);
  });

  it('Rewind after reaching the flop calls startSimulation again with an empty known board', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('rewind-button'));

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(3);
    const conditioned = vi.mocked(simulationService.startSimulation).mock.calls[2][0] as ConditionedState;
    expect(conditioned.knownBoard).toHaveLength(0);
  });

  it('calls cancelSimulation on every street change', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    vi.mocked(simulationService.cancelSimulation).mockClear();

    await user.click(screen.getByTestId('advance-button'));

    expect(simulationService.cancelSimulation).toHaveBeenCalled();
  });

  it('unmounting the app triggers cancelSimulation', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    vi.mocked(simulationService.cancelSimulation).mockClear();

    unmount();

    expect(simulationService.cancelSimulation).toHaveBeenCalled();
  });

  it('ignores a stale snapshot delivered after the effect has been cleaned up by a street change', async () => {
    // Ref-object (not a raw `let`) sidesteps a TS control-flow-narrowing limitation across the
    // closure boundary of `mockImplementation`'s callback.
    const captured: { onProgress: ((snapshot: ProgressSnapshot) => void) | null } = { onProgress: null };
    vi.mocked(simulationService.startSimulation).mockImplementation(async (_conditioned, onProgress) => {
      if (!captured.onProgress) captured.onProgress = onProgress;
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));

    // Late-arriving snapshot from the superseded (pre-Advance) run — must not reach the display.
    captured.onProgress?.({
      requestId: 1,
      categoryCounts: new Array(10).fill(0),
      outcomes: { win: 999, tie: 999, lose: 999 },
      trialsCompleted: 999,
      done: true,
    });

    expect(screen.queryByTestId('trial-counter')?.textContent).not.toBe('999');
  });

  it('shows a simulation-error alert when startSimulation invokes onError, and it disappears on the next successful run', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementationOnce(async (_conditioned, _onProgress, onError) => {
      onError('worker exploded');
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const alert = await screen.findByTestId('simulation-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert.textContent).toBe(
      'The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again.',
    );

    vi.mocked(simulationService.startSimulation).mockImplementationOnce(async (_conditioned, onProgress) => {
      onProgress({
        requestId: 1,
        categoryCounts: new Array(10).fill(0),
        outcomes: { win: 1, tie: 0, lose: 0 },
        trialsCompleted: 1,
        done: false,
      });
    });
    await user.click(screen.getByTestId('advance-button'));

    expect(screen.queryByTestId('simulation-error')).not.toBeInTheDocument();
  });
});

describe('App — settled-odds cache gate and reveal-recomputes-everything', () => {
  beforeEach(() => {
    resetStores();
  });

  function mockSettledSnapshot(win: number, tie: number, lose: number) {
    return vi.fn(
      async (
        _conditioned: ConditionedState,
        onProgress: (snapshot: ProgressSnapshot) => void,
      ) => {
        onProgress({
          requestId: 1,
          categoryCounts: new Array(10).fill(0),
          outcomes: { win, tie, lose },
          trialsCompleted: win + tie + lose,
          done: true,
        });
      },
    );
  }

  it('rewind-then-re-advance to an already-settled street is a cache hit: no new startSimulation call, same win%', async () => {
    // Different settled values per street (branching on knownBoard.length) so the test can
    // distinguish "correctly served the flop's cached value" from "coincidentally identical".
    vi.mocked(simulationService.startSimulation).mockImplementation(
      async (conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
        const isFlop = conditioned.knownBoard.length === 3;
        onProgress({
          requestId: 1,
          categoryCounts: new Array(10).fill(0),
          outcomes: isFlop ? { win: 60, tie: 10, lose: 30 } : { win: 50, tie: 0, lose: 50 },
          trialsCompleted: 100,
          done: true,
        });
      },
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i })); // -> preflop, settles at 50/0/50
    await user.click(screen.getByTestId('advance-button')); // -> flop, settles at 60/10/30

    expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');
    // Both preflop|0 and flop|0 are now settled and cached from this initial pass.
    const callsAfterFlop = vi.mocked(simulationService.startSimulation).mock.calls.length;

    await user.click(screen.getByTestId('rewind-button')); // -> preflop, cache hit (settled above)
    expect(screen.getByTestId('win-pct').textContent).toBe('50.0%');

    await user.click(screen.getByTestId('advance-button')); // -> flop again, cache hit

    // Rewinding and re-advancing across two already-settled streets makes zero additional
    // startSimulation calls — both visits are pure cache hits.
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsAfterFlop);
    expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');
  });

  it('clicking opponent-seat-0 triggers a new startSimulation call with knownOpponentHoles[0] non-null', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    vi.mocked(simulationService.startSimulation).mockClear();

    await user.click(screen.getByTestId('opponent-seat-0'));

    expect(simulationService.startSimulation).toHaveBeenCalled();
    const lastCall = vi.mocked(simulationService.startSimulation).mock.calls.at(-1)!;
    const conditioned = lastCall[0] as ConditionedState;
    expect(conditioned.knownOpponentHoles[0]).not.toBeNull();
  });

  it('reveal on the flop then rewind to pre-flop recomputes with an empty board and the reveal known (D-11)', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button')); // -> flop
    await user.click(screen.getByTestId('opponent-seat-0')); // reveal on flop

    vi.mocked(simulationService.startSimulation).mockClear();
    await user.click(screen.getByTestId('rewind-button')); // -> preflop, mask changed => cache miss

    expect(simulationService.startSimulation).toHaveBeenCalled();
    const lastCall = vi.mocked(simulationService.startSimulation).mock.calls.at(-1)!;
    const conditioned = lastCall[0] as ConditionedState;
    expect(conditioned.knownBoard).toHaveLength(0);
    expect(conditioned.knownOpponentHoles[0]).not.toBeNull();
  });

  it('settling the flop then clicking Deal calls startSimulation again (no cross-hand cache hit)', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(mockSettledSnapshot(60, 10, 30));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button')); // -> flop, settles

    const callsBeforeRedeal = vi.mocked(simulationService.startSimulation).mock.calls.length;

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeRedeal + 1);
  });
});

describe('App — Phase 3 re-skin: control bar, "Set Up Scenario" disclosure, off-felt odds panel', () => {
  beforeEach(() => {
    resetStores();
  });

  it('the "Set Up Scenario" disclosure starts collapsed and toggles the card picker on click', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByTestId('set-up-scenario-button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('card-picker')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('card-picker')).toBeInTheDocument();
  });

  it('the "Set Up Scenario" button label is always exactly "Set Up Scenario" in both states (UI-SPEC A5)', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByTestId('set-up-scenario-button');
    expect(toggle.textContent).toBe('Set Up Scenario');

    await user.click(toggle);

    expect(toggle.textContent).toBe('Set Up Scenario');
  });

  it('empty-hand-state contains the exact A7 copy string', () => {
    render(<App />);

    expect(screen.getByTestId('empty-hand-state').textContent).toContain(
      'Click Deal to draw a random hand, or click Set Up Scenario to construct your own hand, then click Deal.',
    );
  });

  it('odds-panel exists and table-scene does NOT contain it (D-05)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(screen.getByTestId('odds-panel')).toBeInTheDocument();
    expect(screen.getByTestId('table-scene').contains(screen.getByTestId('odds-panel'))).toBe(false);
  });
});
