import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { usePickerStore } from './state/pickerStore';
import { useUiStore } from './state/uiStore';
import type { ProgressSnapshot } from './worker/protocol';
import type { ConditionedState } from './engine/equity';

// Phase 3 acceptance suite: one describe per ROADMAP "Phase 3: Casino Table UI & Animation"
// success criterion, quoted verbatim as the block name — mirrors src/App.acceptance.test.tsx's
// Phase 2 structure. This file proves the four criteria hold TOGETHER on a fully composed
// <App />; it does not restate assertions already covered by earlier plans' unit tests.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's existing mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

const CARD_SRC_PATTERN = /^\/cards\/[CDHS]-(10|[2-9JQKA])\.svg$/;

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  usePickerStore.getState().clearAll();
  // Reset last (03-03 test-harness convention, followed by App.test.tsx/App.acceptance.test.tsx):
  // a reset must never leave a stale armed count behind from a previous test, which would
  // incorrectly gate every subsequent test's odds effect forever.
  useUiStore.getState().resetAnimations();
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

describe(
  'User sees a full casino-table scene: felt table, their own seat, 3 anonymous opponent seats, and a community card area.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('renders table-scene containing hero-hole, 3 opponent seats, a community area and deck-origin in one composition, with odds-panel docked outside the felt', async () => {
      vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /^deal$/i }));

      const tableScene = screen.getByTestId('table-scene');
      expect(tableScene).toBeInTheDocument();
      expect(tableScene.contains(screen.getByTestId('hero-hole'))).toBe(true);

      const opponents = screen.getByTestId('opponents');
      expect(tableScene.contains(opponents)).toBe(true);
      expect(opponents.children).toHaveLength(3);
      expect(tableScene.contains(screen.getByTestId('opponent-seat-0'))).toBe(true);
      expect(tableScene.contains(screen.getByTestId('opponent-seat-1'))).toBe(true);
      expect(tableScene.contains(screen.getByTestId('opponent-seat-2'))).toBe(true);

      expect(tableScene.querySelector('.community-area')).not.toBeNull();
      expect(tableScene.contains(screen.getByTestId('deck-origin'))).toBe(true);

      // D-05: the odds panel is a sibling of the felt, never nested inside it.
      const oddsPanel = screen.getByTestId('odds-panel');
      expect(oddsPanel).toBeInTheDocument();
      expect(tableScene.contains(oddsPanel)).toBe(false);
    });
  },
);

describe(
  'User sees detailed playing cards with proper pips and court-card art in place of the plain/placeholder cards used in Phases 1-2.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('every hero and board card img matches the vendored card-art naming convention with a human-readable alt, and hidden opponent seats show only the card back', async () => {
      vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /^deal$/i }));
      await user.click(screen.getByTestId('advance-button')); // -> flop
      await user.click(screen.getByTestId('advance-button')); // -> turn
      await user.click(screen.getByTestId('advance-button')); // -> river (full 5-card board)

      const heroImgs = screen.getByTestId('hero-hole').querySelectorAll('img');
      expect(heroImgs).toHaveLength(2);
      for (const img of Array.from(heroImgs)) {
        expect(img.getAttribute('src')).toMatch(CARD_SRC_PATTERN);
        expect(img.getAttribute('alt')).toMatch(/^[A-Za-z]+ of [A-Za-z]+$/);
      }

      const boardImgs = screen.getByTestId('board-cards').querySelectorAll('img');
      expect(boardImgs).toHaveLength(5);
      for (const img of Array.from(boardImgs)) {
        expect(img.getAttribute('src')).toMatch(CARD_SRC_PATTERN);
        expect(img.getAttribute('alt')).toMatch(/^[A-Za-z]+ of [A-Za-z]+$/);
      }

      // Hidden opponents never leak real card-face art into the DOM (T-03-12) — only the back.
      for (let i = 0; i < 3; i++) {
        const seatImgs = screen.getByTestId(`opponent-seat-${i}`).querySelectorAll('img');
        expect(seatImgs.length).toBeGreaterThan(0);
        for (const img of Array.from(seatImgs)) {
          expect(img.getAttribute('src')).toBe('/cards/back.svg');
          expect(img.getAttribute('src')).not.toMatch(CARD_SRC_PATTERN);
        }
      }
    });
  },
);

describe('User sees cards animate when dealt, flipped, and revealed (opponent reveal).', () => {
  beforeEach(() => {
    resetStores();
  });

  it('a re-deal produces new DOM node instances for every hero, opponent and community card slot (remount, never retarget)', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByTestId('advance-button')); // -> flop, board-cards exists

    const before = {
      hero: Array.from(screen.getByTestId('hero-hole').children),
      opp0: Array.from(screen.getByTestId('opponent-seat-0').children),
      opp1: Array.from(screen.getByTestId('opponent-seat-1').children),
      opp2: Array.from(screen.getByTestId('opponent-seat-2').children),
      board: Array.from(screen.getByTestId('board-cards').children),
    };

    await user.click(screen.getByRole('button', { name: /^deal$/i })); // re-deal -> preflop
    await user.click(screen.getByTestId('advance-button')); // -> flop again

    const after = {
      hero: Array.from(screen.getByTestId('hero-hole').children),
      opp0: Array.from(screen.getByTestId('opponent-seat-0').children),
      opp1: Array.from(screen.getByTestId('opponent-seat-1').children),
      opp2: Array.from(screen.getByTestId('opponent-seat-2').children),
      board: Array.from(screen.getByTestId('board-cards').children),
    };

    for (const key of ['hero', 'opp0', 'opp1', 'opp2', 'board'] as const) {
      expect(after[key]).toHaveLength(before[key].length);
      before[key].forEach((node, i) => {
        expect(after[key][i]).not.toBe(node);
      });
    }
  });

  it('reveal (opponent flip) participates in the same TBL-04 gate as deal: the reveal-triggered recompute waits while armed and resolves once released', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    const callsBeforeReveal = vi.mocked(simulationService.startSimulation).mock.calls.length;

    act(() => {
      useUiStore.getState().beginAnimation();
    });
    await user.click(screen.getByTestId('opponent-seat-0'));

    // The seat is already disclosed (reveal is one-way and immediate), but the recompute this
    // reveal triggers must wait for the flip's animation slot exactly like a deal/advance does.
    expect(screen.getByTestId('opponent-seat-0')).toBeDisabled();
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeReveal);
    expect(screen.getByTestId('win-pct').textContent).toBe('—');

    act(() => {
      useUiStore.getState().endAnimation();
    });

    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsBeforeReveal + 1);
  });
});

describe(
  'User never sees odds numbers contradict or spoil cards that are still mid-animation — odds update only once the corresponding animation has completed.',
  () => {
    beforeEach(() => {
      resetStores();
    });

    it('with the counter armed, zero startSimulation calls are made and every percentage cell plus the trial counter reads the em dash; correct numbers return after release', async () => {
      vi.mocked(simulationService.startSimulation).mockImplementation(async (_conditioned, onProgress) => {
        onProgress({
          requestId: 1,
          categoryCounts: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          outcomes: { win: 60, tie: 10, lose: 30 },
          trialsCompleted: 100,
          done: true,
        });
      });
      const user = userEvent.setup();
      render(<App />);

      act(() => {
        useUiStore.getState().beginAnimation();
      });
      await user.click(screen.getByRole('button', { name: /^deal$/i }));

      expect(simulationService.startSimulation).not.toHaveBeenCalled();
      expect(screen.getByTestId('trial-counter').textContent).toBe('—');
      expect(screen.getByTestId('win-pct').textContent).toBe('—');
      expect(screen.getByTestId('tie-pct').textContent).toBe('—');
      expect(screen.getByTestId('lose-pct').textContent).toBe('—');
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`category-pct-${i}`).textContent).toBe('—');
      }

      act(() => {
        useUiStore.getState().endAnimation();
      });

      expect(simulationService.startSimulation).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('trial-counter').textContent).toBe('100');
      expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');
      expect(screen.getByTestId('tie-pct').textContent).toBe('10.0%');
      expect(screen.getByTestId('lose-pct').textContent).toBe('30.0%');
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`category-pct-${i}`).textContent).toBe('10.0%');
      }
    });

    it('the same holds on the settled-cache path: armed cells stay at the em dash with no new startSimulation call, and the cache applies once released', async () => {
      vi.mocked(simulationService.startSimulation).mockImplementation(
        async (conditioned: ConditionedState, onProgress: (snapshot: ProgressSnapshot) => void) => {
          const isFlop = conditioned.knownBoard.length === 3;
          onProgress({
            requestId: 1,
            categoryCounts: isFlop
              ? [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
              : new Array(10).fill(0),
            outcomes: isFlop ? { win: 60, tie: 10, lose: 30 } : { win: 50, tie: 0, lose: 50 },
            trialsCompleted: 100,
            done: true,
          });
        },
      );
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /^deal$/i })); // -> preflop, settles
      await user.click(screen.getByTestId('advance-button')); // -> flop, settles
      expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');

      act(() => {
        useUiStore.getState().beginAnimation();
      });
      await user.click(screen.getByTestId('rewind-button')); // -> preflop, would be a cache hit

      expect(screen.getByTestId('trial-counter').textContent).toBe('—');
      expect(screen.getByTestId('win-pct').textContent).toBe('—');
      expect(screen.getByTestId('tie-pct').textContent).toBe('—');
      expect(screen.getByTestId('lose-pct').textContent).toBe('—');
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`category-pct-${i}`).textContent).toBe('—');
      }
      const callsWhileArmed = vi.mocked(simulationService.startSimulation).mock.calls.length;

      act(() => {
        useUiStore.getState().endAnimation();
      });

      // Served from the cache — no NEW startSimulation call, just the gate finally clearing.
      expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsWhileArmed);
      expect(screen.getByTestId('win-pct').textContent).toBe('50.0%');
    });
  },
);
