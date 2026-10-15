import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrapsTable } from './CrapsTable';
import { DieFace } from './CrapsDice';
import { describeTrial } from './crapsTrialText';
import { useCrapsStore } from '../state/crapsStore';
import { CRAPS_BETS, resolveBet, type Die, type Roll } from '../engine/craps';

// The craps felt in isolation (quick task 261015-d7o): the bet layout, the dice, the decision
// sequence and the printed line, driven straight from the store.

function resetStore() {
  useCrapsStore.setState({ bet: null, fieldRule: 'triple12', trials: [], revealed: 0 });
}

function scripted(rolls: Roll[]): () => Roll {
  let cursor = 0;
  return () => rolls[cursor++];
}

describe('DieFace — a real die face per value', () => {
  it.each([1, 2, 3, 4, 5, 6] as Die[])('a %d shows exactly that many pips and names its value', (value) => {
    const { container } = render(<DieFace value={value} index={0} />);
    expect(container.querySelectorAll('.craps-die__pip')).toHaveLength(value);
    expect(screen.getByTestId('craps-die-0')).toHaveAttribute('aria-label', `Die showing ${value}`);
    expect(screen.getByTestId('craps-die-0')).toHaveAttribute('role', 'img');
  });
});

describe('describeTrial — the decision in words', () => {
  it('a come-out natural, a point made, a seven-out, a place decision, a single-roll bet, a push', () => {
    expect(describeTrial(resolveBet('pass', 'triple12', scripted([[3, 4]])), 'pass')).toBe('7 — win');
    expect(describeTrial(resolveBet('pass', 'triple12', scripted([[2, 4], [5, 4], [3, 3]])), 'pass')).toBe(
      'Point 6 · 9 · 6 — win',
    );
    expect(describeTrial(resolveBet('pass', 'triple12', scripted([[4, 4], [1, 6]])), 'pass')).toBe('Point 8 · 7 — loss');
    expect(describeTrial(resolveBet('dontPass', 'triple12', scripted([[4, 4], [1, 6]])), 'dontPass')).toBe(
      'Point 8 · 7 — win',
    );
    expect(describeTrial(resolveBet('place6', 'triple12', scripted([[2, 3], [3, 3]])), 'place6')).toBe('5 · 6 — win');
    expect(describeTrial(resolveBet('field', 'triple12', scripted([[6, 6]])), 'field')).toBe('12 — win');
    expect(describeTrial(resolveBet('dontPass', 'triple12', scripted([[6, 6]])), 'dontPass')).toBe('12 — push');
  });
});

describe('CrapsTable — the layout', () => {
  beforeEach(resetStore);

  it('offers the seven bets as pressable buttons, with four inert place boxes for the rest of the row', () => {
    render(<CrapsTable />);
    for (const bet of CRAPS_BETS) {
      expect(screen.getByTestId(`craps-bet-${bet}`)).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId(`craps-bet-${bet}`)).toHaveAttribute('type', 'button');
    }
    const layout = screen.getByTestId('craps-layout');
    expect(layout.querySelectorAll('button')).toHaveLength(7);
    expect(layout.querySelectorAll('.craps-place-box--inert')).toHaveLength(4);
    expect(screen.getByTestId('craps-bet-place6')).toHaveAccessibleName('Place 6');
    expect(screen.getByTestId('craps-bet-place8')).toHaveAccessibleName('Place 8');
    expect(screen.getByTestId('craps-bet-pass')).toHaveTextContent('Pass line');
    expect(screen.getByTestId('craps-bet-dontPass')).toHaveTextContent("Don't pass");
  });

  it('a bet click selects it, a second clears it, another replaces it — exactly one pressed at a time', async () => {
    const user = userEvent.setup();
    render(<CrapsTable />);

    await user.click(screen.getByTestId('craps-bet-pass'));
    expect(screen.getByTestId('craps-bet-pass')).toHaveAttribute('aria-pressed', 'true');
    expect(useCrapsStore.getState().bet).toBe('pass');

    await user.click(screen.getByTestId('craps-bet-field'));
    expect(screen.getByTestId('craps-bet-pass')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('craps-bet-field')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('craps-layout').querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);

    await user.click(screen.getByTestId('craps-bet-field'));
    expect(useCrapsStore.getState().bet).toBeNull();
  });
});

describe('CrapsTable — the printed line', () => {
  beforeEach(resetStore);

  it('invites a pick, then states the chosen bet and its house edge, following the Field rule', () => {
    render(<CrapsTable />);
    expect(screen.getByTestId('craps-house-edge').textContent).toBe('SEVEN BETS · PICK ONE');

    act(() => useCrapsStore.getState().selectBet('pass'));
    expect(screen.getByTestId('craps-house-edge').textContent).toBe('PASS LINE · HOUSE EDGE 1.41%');

    act(() => useCrapsStore.getState().selectBet('field'));
    expect(screen.getByTestId('craps-house-edge').textContent).toBe('FIELD · HOUSE EDGE 2.78%');
    act(() => useCrapsStore.getState().setFieldRule('double12'));
    expect(screen.getByTestId('craps-house-edge').textContent).toBe('FIELD · HOUSE EDGE 5.56%');

    act(() => useCrapsStore.getState().selectBet('anySeven'));
    expect(screen.getByTestId('craps-house-edge').textContent).toBe('ANY SEVEN · HOUSE EDGE 16.67%');
  });
});

describe('CrapsTable — the dice', () => {
  beforeEach(resetStore);

  it('shows dashed placeholders and no sequence before the first revealed decision', () => {
    render(<CrapsTable />);
    expect(screen.getByTestId('craps-dice-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('craps-die-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('craps-last-trial')).not.toBeInTheDocument();
  });

  it('shows the last roll of the last REVEALED decision, and that decision in words', () => {
    const trials = [
      resolveBet('pass', 'triple12', scripted([[2, 4], [5, 4], [3, 3]])), // point 6, 9, 6 — win, last roll 3+3
      resolveBet('pass', 'triple12', scripted([[1, 1]])), // 2 — loss
    ];
    useCrapsStore.setState({ bet: 'pass', trials, revealed: 1 });
    render(<CrapsTable />);

    expect(screen.queryByTestId('craps-dice-placeholder')).not.toBeInTheDocument();
    expect(screen.getByTestId('craps-die-0')).toHaveAttribute('aria-label', 'Die showing 3');
    expect(screen.getByTestId('craps-die-1')).toHaveAttribute('aria-label', 'Die showing 3');
    expect(screen.getByTestId('craps-last-trial').textContent).toBe('Point 6 · 9 · 6 — win');

    act(() => useCrapsStore.getState().revealAll());
    expect(screen.getByTestId('craps-die-0')).toHaveAttribute('aria-label', 'Die showing 1');
    expect(screen.getByTestId('craps-last-trial').textContent).toBe('2 — loss');
  });
});
