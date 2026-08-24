import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import type { ProgressSnapshot } from './worker/protocol';
import { CATEGORY_LABELS } from './ui/categoryLabels';

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. A factory sidesteps that entirely, per this test's purpose (UI wiring, not the worker
// boundary — that's covered by simulationApi.test.ts and the phase acceptance checkpoint).
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
}));

describe('App — Deal happy path', () => {
  beforeEach(() => {
    useGameStore.setState({ heroHole: null, dealNonce: 0 });
    useOddsStore.getState().reset();
    vi.mocked(simulationService.startSimulation).mockReset();
  });

  it('deals a hero hand and shows three hidden opponents when Deal is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dealButton = screen.getByRole('button', { name: /^deal$/i });
    await user.click(dealButton);

    const heroHole = screen.getByTestId('hero-hole');
    expect(heroHole.children).toHaveLength(2);
    for (const child of Array.from(heroHole.children)) {
      expect(child.textContent).not.toBe('');
    }

    const opponents = screen.getByTestId('opponents');
    expect(opponents.children).toHaveLength(3);
  });

  it('shows a climbing trial counter and win/tie/lose percentages driven by streamed snapshots', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(
      async (_heroHole, _remainingDeck, requestId, onProgress) => {
        const snapshots: ProgressSnapshot[] = [
          {
            requestId,
            categoryCounts: new Array(10).fill(0),
            outcomes: { win: 30, tie: 5, lose: 15 },
            trialsCompleted: 50,
            done: false,
          },
          {
            requestId,
            categoryCounts: new Array(10).fill(0),
            outcomes: { win: 60, tie: 10, lose: 30 },
            trialsCompleted: 100,
            done: true,
          },
        ];
        for (const snapshot of snapshots) {
          onProgress(snapshot);
        }
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(screen.getByTestId('trial-counter').textContent).toBe('100');
    expect(screen.getByTestId('win-pct').textContent).toBe('60.0%');
    expect(screen.getByTestId('tie-pct').textContent).toBe('10.0%');
    expect(screen.getByTestId('lose-pct').textContent).toBe('30.0%');

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(1);
    const firstCallArgs = vi.mocked(simulationService.startSimulation).mock.calls[0];
    expect(firstCallArgs[2]).toBe(useGameStore.getState().dealNonce);
  });

  it('resets and calls startSimulation again with a higher requestId when Deal is clicked a second time', async () => {
    vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    await user.click(screen.getByRole('button', { name: /^deal$/i }));

    expect(simulationService.startSimulation).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(simulationService.startSimulation).mock.calls;
    const firstRequestId = calls[0][2];
    const secondRequestId = calls[1][2];
    expect(secondRequestId).toBeGreaterThan(firstRequestId);
  });

  it('renders a live 10-row hand-category probability table driven by streamed snapshots', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(
      async (_heroHole, _remainingDeck, requestId, onProgress) => {
        const snapshot: ProgressSnapshot = {
          requestId,
          categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1],
          outcomes: { win: 600, tie: 100, lose: 300 },
          trialsCompleted: 1000,
          done: true,
        };
        onProgress(snapshot);
      },
    );

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
