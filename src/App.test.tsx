import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import type { ProgressSnapshot } from './worker/protocol';

vi.mock('./state/simulationService');

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
});
