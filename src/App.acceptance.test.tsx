import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { usePickerStore } from './state/pickerStore';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's existing mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

/**
 * Every conditioned state handed to `startSimulation` across the whole test file, in call
 * order — the D-02 guard and the knownBoard-progression assertions read straight from this
 * rather than re-deriving indices into `mock.calls`.
 */
const capturedStates: ConditionedState[] = [];
/** Bumped on every mocked `startSimulation` call so each call's streamed snapshot is
 * recognisably distinct (win% climbs by 1 each call) — lets a cache-hit assertion prove
 * "no NEW call happened" rather than merely "the call count didn't change by coincidence". */
let callIndex = 0;

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  usePickerStore.getState().clearAll();
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  capturedStates.length = 0;
  callIndex = 0;

  // Records the conditioned state and immediately streams ONE settled (done: true) snapshot
  // whose outcomes are distinct per call (win% = 50 + callIndex), so a served cached value is
  // distinguishable from a coincidentally-identical fresh run.
  vi.mocked(simulationService.startSimulation).mockImplementation(
    async (conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
      capturedStates.push(conditioned);
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
}

describe(
  'User can manually pick their own hole cards and the board cards via a card picker to construct a scenario, with already-used cards blocked so duplicates are impossible across hands, board, and deck.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('honours manual picks, keeps every dealt card distinct, and blocks the used cards elsewhere in the panel', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      await user.click(screen.getByTestId('picker-slot-flop-0'));
      await user.click(screen.getByTestId('picker-card-Kd'));

      await user.click(screen.getByRole('button', { name: /^deal$/i }));

      const { runout } = useGameStore.getState();
      expect(runout).not.toBeNull();
      expect(runout!.heroHole[0]).toBe('As');
      expect(runout!.board[0]).toBe('Kd');

      const allDealtCards = [...runout!.heroHole, ...runout!.board, ...runout!.opponentHoles.flat()];
      expect(allDealtCards).toHaveLength(13);
      expect(new Set(allDealtCards).size).toBe(13);

      // Reopening the panel from a different (still-empty) slot must show both used cards
      // disabled with the "(used)" suffix — the picks persist across Deal (UI-SPEC A2).
      await user.click(screen.getByTestId('picker-slot-turn'));
      const usedAs = screen.getByTestId('picker-card-As');
      const usedKd = screen.getByTestId('picker-card-Kd');
      expect(usedAs).toBeDisabled();
      expect(usedAs.textContent).toBe('As (used)');
      expect(usedKd).toBeDisabled();
      expect(usedKd.textContent).toBe('Kd (used)');
    });
  },
);

describe(
  'User can advance street by street (pre-flop → flop → turn → river), with all odds recomputing at each step.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('advances through all four streets with knownBoard growing 0 -> 3 -> 4 -> 5, mirrored in board-cards', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /^deal$/i }));
      expect(capturedStates.at(-1)!.knownBoard).toHaveLength(0);
      expect(screen.getByTestId('board-empty-state')).toBeInTheDocument();

      await user.click(screen.getByTestId('advance-button'));
      expect(capturedStates.at(-1)!.knownBoard).toHaveLength(3);
      expect(screen.getByTestId('board-cards').children).toHaveLength(3);

      await user.click(screen.getByTestId('advance-button'));
      expect(capturedStates.at(-1)!.knownBoard).toHaveLength(4);
      expect(screen.getByTestId('board-cards').children).toHaveLength(4);

      await user.click(screen.getByTestId('advance-button'));
      expect(capturedStates.at(-1)!.knownBoard).toHaveLength(5);
      expect(screen.getByTestId('board-cards').children).toHaveLength(5);

      // All four navigation triggers (Deal + 3x Advance) each produced their own conditioned
      // recomputation — the knownBoard progression is exactly 0 -> 3 -> 4 -> 5, in order.
      const progression = capturedStates.map((state) => state.knownBoard.length);
      expect(progression).toEqual([0, 3, 4, 5]);
    });
  },
);

describe(
  'User can rewind to an earlier street and see odds return to their earlier-street values; re-advancing shows the same cards unless a separate re-deal action is taken.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('rewind-then-re-advance to an already-settled street is a cache hit: no new startSimulation call, same win%, same runout', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /^deal$/i })); // -> preflop, settles
      await user.click(screen.getByTestId('advance-button')); // -> flop, settles

      const flopWinPct = screen.getByTestId('win-pct').textContent;
      const runoutAfterFlop = useGameStore.getState().runout;
      const callsAfterFlop = vi.mocked(simulationService.startSimulation).mock.calls.length;

      await user.click(screen.getByTestId('rewind-button')); // -> preflop, cache hit
      await user.click(screen.getByTestId('advance-button')); // -> flop again, cache hit

      expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsAfterFlop);
      expect(screen.getByTestId('win-pct').textContent).toBe(flopWinPct);
      // Rewinding and re-advancing never redraws cards (D-01) — the runout stays the exact
      // same object across the round trip.
      expect(useGameStore.getState().runout).toBe(runoutAfterFlop);
    });
  },
);

describe(
  "User can reveal any opponent's hole cards mid-hand and see all odds recalculate to account for the newly known cards.",
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('reveal discloses the seat, forces a fresh conditioned run, and survives a rewind to pre-flop', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /^deal$/i })); // -> preflop|0, cached
      const { runout } = useGameStore.getState();
      const opponentHole = runout!.opponentHoles[0];

      await user.click(screen.getByTestId('advance-button')); // -> flop|0, cached

      await user.click(screen.getByTestId('opponent-seat-0')); // mask changes -> flop|1, a fresh miss

      const seat = screen.getByTestId('opponent-seat-0');
      expect(seat).toBeDisabled();
      expect(seat).toHaveAttribute(
        'aria-label',
        `Opponent 1 hole cards: ${opponentHole[0]} ${opponentHole[1]} (revealed)`,
      );
      expect(capturedStates.at(-1)!.knownOpponentHoles[0]).not.toBeNull();

      await user.click(screen.getByTestId('rewind-button')); // -> preflop|1 — never cached before
      // (only preflop|0 was, from the original pre-reveal Deal) — this must be a fresh run, not
      // a cache hit, proving the reveal invalidated every street's cache entry at once (D-11).

      expect(capturedStates.at(-1)!.knownBoard).toHaveLength(0);
      expect(capturedStates.at(-1)!.knownOpponentHoles[0]).not.toBeNull();
    });
  },
);

describe('D-02 guard (no peeking) and the pre-deal empty state', () => {
  beforeEach(() => {
    resetStores();
  });

  it('every captured conditioned state\'s remainingDeck retains every board card and opponent-hole card still hidden at that point', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button'));
    await user.click(screen.getByTestId('opponent-seat-0'));

    const { runout } = useGameStore.getState();
    expect(capturedStates.length).toBeGreaterThan(0);

    for (const state of capturedStates) {
      const visibleBoard = new Set(state.knownBoard);
      for (const boardCard of runout!.board) {
        if (!visibleBoard.has(boardCard)) {
          expect(state.remainingDeck).toContain(boardCard);
        }
      }
      state.knownOpponentHoles.forEach((hole, i) => {
        if (hole === null) {
          expect(state.remainingDeck).toContain(runout!.opponentHoles[i][0]);
          expect(state.remainingDeck).toContain(runout!.opponentHoles[i][1]);
        }
      });
    }
  });

  it('the pre-flop conditioned state\'s remainingDeck contains all 5 board cards and all 6 opponent hole cards', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    const { runout } = useGameStore.getState();
    const preflopState = capturedStates.find((state) => state.knownBoard.length === 0);
    expect(preflopState).toBeDefined();

    for (const boardCard of runout!.board) {
      expect(preflopState!.remainingDeck).toContain(boardCard);
    }
    for (const hole of runout!.opponentHoles) {
      expect(preflopState!.remainingDeck).toContain(hole[0]);
      expect(preflopState!.remainingDeck).toContain(hole[1]);
    }
  });

  it('shows empty-hand-state before the first deal and hides it once a hand exists', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('empty-hand-state')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(screen.queryByTestId('empty-hand-state')).not.toBeInTheDocument();
  });
});
