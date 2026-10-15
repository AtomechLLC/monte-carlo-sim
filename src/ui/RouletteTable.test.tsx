import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouletteTable } from './RouletteTable';
import { useRouletteStore } from '../state/rouletteStore';
import { AMERICAN_WHEEL, EUROPEAN_WHEEL, LAYOUT_NUMBERS, pocketColor } from '../engine/roulette';

// The felt in isolation (quick task 261015-ch8): the wheel illustration, the betting layout
// and the printed line, driven straight from the store with no game root around them.

function resetStore() {
  useRouletteStore.setState({ wheel: 'european', color: null, number: null, spins: [], revealed: 0 });
}

describe('RouletteTable — the wheel', () => {
  beforeEach(resetStore);

  it('draws every pocket of the single-zero wheel, in its colour, with 00 absent', () => {
    render(<RouletteTable />);
    const wedges = screen.getByTestId('roulette-wheel').querySelectorAll('.roulette-wheel__pocket');
    expect(wedges).toHaveLength(37);
    for (const pocket of EUROPEAN_WHEEL) {
      expect(screen.getByTestId(`roulette-wheel-pocket-${pocket}`)).toHaveClass(
        `roulette-wheel__pocket--${pocketColor(pocket)}`,
      );
    }
    expect(screen.queryByTestId('roulette-wheel-pocket-00')).not.toBeInTheDocument();
  });

  it('draws 38 pockets on the double-zero wheel, including 00', () => {
    useRouletteStore.setState({ wheel: 'american' });
    render(<RouletteTable />);
    const wedges = screen.getByTestId('roulette-wheel').querySelectorAll('.roulette-wheel__pocket');
    expect(wedges).toHaveLength(38);
    expect(screen.getByTestId('roulette-wheel-pocket-00')).toHaveClass('roulette-wheel__pocket--green');
    for (const pocket of AMERICAN_WHEEL) {
      expect(screen.getByTestId(`roulette-wheel-pocket-${pocket}`)).toBeInTheDocument();
    }
  });

  it('prints every pocket label once, in wheel order', () => {
    render(<RouletteTable />);
    const labels = [...screen.getByTestId('roulette-wheel').querySelectorAll('.roulette-wheel__label')].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual([...EUROPEAN_WHEEL]);
  });

  it('shows no ball and an empty hub before the first revealed spin, then the last REVEALED pocket', () => {
    render(<RouletteTable />);
    expect(screen.queryByTestId('roulette-wheel-ball')).not.toBeInTheDocument();
    expect(screen.getByTestId('roulette-last-spin').textContent).toBe('');
    expect(screen.getByTestId('roulette-wheel')).toHaveAttribute('aria-label', '37-pocket roulette wheel');

    act(() => {
      useRouletteStore.setState({ spins: ['17', '32', '0'], revealed: 2 });
    });

    // Revealed 2 of 3: the ball is on 32, not on the as-yet-unrevealed 0.
    expect(screen.getByTestId('roulette-wheel-ball')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-last-spin').textContent).toBe('32');
    expect(screen.getByTestId('roulette-wheel-pocket-32')).toHaveClass('roulette-wheel__pocket--hit');
    expect(screen.getByTestId('roulette-wheel-pocket-0')).not.toHaveClass('roulette-wheel__pocket--hit');
    expect(screen.getByTestId('roulette-wheel')).toHaveAttribute('aria-label', '37-pocket roulette wheel, ball on 32');

    act(() => {
      useRouletteStore.setState({ revealed: 3 });
    });
    expect(screen.getByTestId('roulette-last-spin').textContent).toBe('0');
    expect(screen.getByTestId('roulette-wheel-pocket-0')).toHaveClass('roulette-wheel__pocket--hit');
    expect(screen.getByTestId('roulette-wheel-pocket-32')).not.toHaveClass('roulette-wheel__pocket--hit');
  });

  it('exactly one pocket carries the hit outline at a time', () => {
    useRouletteStore.setState({ spins: ['5'], revealed: 1 });
    render(<RouletteTable />);
    expect(screen.getByTestId('roulette-wheel').querySelectorAll('.roulette-wheel__pocket--hit')).toHaveLength(1);
  });
});

describe('RouletteTable — the printed line', () => {
  beforeEach(resetStore);

  it('states the wheel, its pocket count and the house edge it implies', () => {
    const { rerender } = render(<RouletteTable />);
    expect(screen.getByTestId('roulette-house-edge').textContent).toBe(
      'SINGLE ZERO · 37 POCKETS · HOUSE EDGE 2.70%',
    );

    act(() => {
      useRouletteStore.getState().setWheel('american');
    });
    rerender(<RouletteTable />);
    expect(screen.getByTestId('roulette-house-edge').textContent).toBe(
      'DOUBLE ZERO · 38 POCKETS · HOUSE EDGE 5.26%',
    );
  });
});

describe('RouletteTable — the betting layout', () => {
  beforeEach(resetStore);

  it('renders 1..36 plus the zeros the wheel carries, each as a pressable button named with its colour', () => {
    render(<RouletteTable />);
    for (const pocket of LAYOUT_NUMBERS) {
      const button = screen.getByTestId(`roulette-pocket-${pocket}`);
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveClass(`roulette-pocket--${pocketColor(pocket)}`);
      expect(button).toHaveAccessibleName(`${pocket}, ${pocketColor(pocket)}`);
    }
    expect(screen.getByTestId('roulette-pocket-0')).toHaveAccessibleName('0, green');
    expect(screen.queryByTestId('roulette-pocket-00')).not.toBeInTheDocument();
    expect(screen.getByTestId('roulette-layout').querySelectorAll('.roulette-pocket')).toHaveLength(37);
  });

  it('adds the 00 cell on the double-zero wheel, and the green bet names both zeros', () => {
    useRouletteStore.setState({ wheel: 'american' });
    render(<RouletteTable />);
    expect(screen.getByTestId('roulette-pocket-00')).toHaveAccessibleName('00, green');
    expect(screen.getByTestId('roulette-layout').querySelectorAll('.roulette-pocket')).toHaveLength(38);
    expect(screen.getByTestId('roulette-color-green').textContent).toBe('Green 0 · 00');
  });

  it('places the numbers on the classic grid: 1-2-3 running up each column, zeros in the first column', () => {
    render(<RouletteTable />);
    // Column 1 is the zero column; 1, 2, 3 share column 2, bottom to top; 34, 35, 36 share the last.
    expect(screen.getByTestId('roulette-pocket-1').style.gridColumn).toBe('2');
    expect(screen.getByTestId('roulette-pocket-1').style.gridRow).toBe('5 / span 2');
    expect(screen.getByTestId('roulette-pocket-2').style.gridRow).toBe('3 / span 2');
    expect(screen.getByTestId('roulette-pocket-3').style.gridRow).toBe('1 / span 2');
    expect(screen.getByTestId('roulette-pocket-36').style.gridColumn).toBe('13');
    expect(screen.getByTestId('roulette-pocket-36').style.gridRow).toBe('1 / span 2');
    expect(screen.getByTestId('roulette-pocket-0').style.gridColumn).toBe('1');
    expect(screen.getByTestId('roulette-pocket-0').style.gridRow).toBe('1 / span 6');
  });

  it('splits the zero column between 0 and 00 on the double-zero wheel', () => {
    useRouletteStore.setState({ wheel: 'american' });
    render(<RouletteTable />);
    expect(screen.getByTestId('roulette-pocket-0').style.gridRow).toBe('1 / span 3');
    expect(screen.getByTestId('roulette-pocket-00').style.gridRow).toBe('4 / span 3');
  });

  it('a pocket click selects it (aria-pressed), a second click clears it, and another pocket replaces it', async () => {
    const user = userEvent.setup();
    render(<RouletteTable />);

    await user.click(screen.getByTestId('roulette-pocket-17'));
    expect(screen.getByTestId('roulette-pocket-17')).toHaveAttribute('aria-pressed', 'true');
    expect(useRouletteStore.getState().number).toBe('17');

    await user.click(screen.getByTestId('roulette-pocket-5'));
    expect(screen.getByTestId('roulette-pocket-17')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('roulette-pocket-5')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByTestId('roulette-pocket-5'));
    expect(screen.getByTestId('roulette-pocket-5')).toHaveAttribute('aria-pressed', 'false');
    expect(useRouletteStore.getState().number).toBeNull();
  });

  it('the colour bets toggle independently of the pocket', async () => {
    const user = userEvent.setup();
    render(<RouletteTable />);

    await user.click(screen.getByTestId('roulette-color-red'));
    await user.click(screen.getByTestId('roulette-pocket-2'));
    expect(screen.getByTestId('roulette-color-red')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('roulette-pocket-2')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByTestId('roulette-color-black'));
    expect(screen.getByTestId('roulette-color-red')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('roulette-color-black')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('roulette-pocket-2')).toHaveAttribute('aria-pressed', 'true');
    expect(useRouletteStore.getState()).toMatchObject({ color: 'black', number: '2' });
  });

  it('every pocket and colour button is a real <button type="button"> — nothing submits or navigates', () => {
    render(<RouletteTable />);
    const buttons = screen.getByTestId('roulette-layout').querySelectorAll('button');
    expect(buttons).toHaveLength(37 + 3);
    for (const button of buttons) expect(button).toHaveAttribute('type', 'button');
  });
});
