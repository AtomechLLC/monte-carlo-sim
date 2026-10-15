import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameModeSwitcher } from './GameModeSwitcher';
import { useGameModeStore } from '../state/gameModeStore';

describe('GameModeSwitcher — segmented control reflects and drives gameModeStore (D-01)', () => {
  beforeEach(() => {
    useGameModeStore.setState({ mode: 'holdem' });
  });

  it('defaults to Hold\'em active, with both accessible names present', () => {
    render(<GameModeSwitcher />);

    expect(screen.getByRole('button', { name: "Hold'em" })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Blackjack' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Blackjack flips aria-pressed on both buttons and writes the store', async () => {
    const user = userEvent.setup();
    render(<GameModeSwitcher />);

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'false');
    expect(useGameModeStore.getState().mode).toBe('blackjack');
  });

  it('clicking the already-active Hold\'em button is a harmless no-op', async () => {
    const user = userEvent.setup();
    render(<GameModeSwitcher />);

    await user.click(screen.getByTestId('game-mode-switch-holdem'));

    expect(useGameModeStore.getState().mode).toBe('holdem');
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'true');
  });

  it('neither button is ever disabled, in either mode', async () => {
    const user = userEvent.setup();
    render(<GameModeSwitcher />);

    expect(screen.getByTestId('game-mode-switch-holdem')).not.toBeDisabled();
    expect(screen.getByTestId('game-mode-switch-blackjack')).not.toBeDisabled();

    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    expect(screen.getByTestId('game-mode-switch-holdem')).not.toBeDisabled();
    expect(screen.getByTestId('game-mode-switch-blackjack')).not.toBeDisabled();
  });

  it('button label text never changes with state', async () => {
    const user = userEvent.setup();
    render(<GameModeSwitcher />);

    const holdem = screen.getByTestId('game-mode-switch-holdem');
    const blackjack = screen.getByTestId('game-mode-switch-blackjack');
    expect(holdem.textContent).toBe("Hold'em");
    expect(blackjack.textContent).toBe('Blackjack');

    await user.click(blackjack);

    expect(holdem.textContent).toBe("Hold'em");
    expect(blackjack.textContent).toBe('Blackjack');
  });

  it('the wrapper carries role="group" and aria-label="Game mode"', () => {
    render(<GameModeSwitcher />);

    const wrapper = screen.getByTestId('game-mode-switcher');
    expect(wrapper).toHaveAttribute('role', 'group');
    expect(wrapper).toHaveAttribute('aria-label', 'Game mode');
  });
});

describe('GameModeSwitcher - the third segment, Roulette (261015-ch8)', () => {
  beforeEach(() => {
    useGameModeStore.setState({ mode: 'holdem' });
  });

  it('renders Roulette as the last of three segments, unpressed by default, never disabled', () => {
    render(<GameModeSwitcher />);
    const buttons = screen.getByTestId('game-mode-switcher').querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[2]).toBe(screen.getByTestId('game-mode-switch-roulette'));
    expect(buttons[2].textContent).toBe('Roulette');
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
    expect(buttons[2]).not.toBeDisabled();
  });

  it('clicking Roulette presses it alone and writes the store; the labels never change', async () => {
    const user = userEvent.setup();
    render(<GameModeSwitcher />);

    await user.click(screen.getByTestId('game-mode-switch-roulette'));

    expect(useGameModeStore.getState().mode).toBe('roulette');
    expect(screen.getByTestId('game-mode-switch-roulette')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('game-mode-switch-holdem')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('game-mode-switch-blackjack')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('game-mode-switch-roulette').textContent).toBe('Roulette');
    expect(screen.getByRole('button', { name: "Hold'em" })).not.toBeDisabled();
  });
});
