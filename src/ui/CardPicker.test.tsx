import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardPicker } from './CardPicker';
import { usePickerStore } from '../state/pickerStore';

const EMPTY_PICKS = {
  'hero-0': null,
  'hero-1': null,
  'flop-0': null,
  'flop-1': null,
  'flop-2': null,
  turn: null,
  river: null,
} as const;

describe('CardPicker', () => {
  beforeEach(() => {
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
  });

  it('renders a card-picker root preceded by an h2 "Card Picker" heading', () => {
    render(<CardPicker />);
    expect(screen.getByRole('heading', { level: 2, name: 'Card Picker' })).toBeInTheDocument();
    expect(screen.getByTestId('card-picker')).toBeInTheDocument();
  });

  it('renders seven slot buttons in SLOT_ORDER with the contracted testids', () => {
    render(<CardPicker />);
    const expectedOrder = [
      'picker-slot-hero-0',
      'picker-slot-hero-1',
      'picker-slot-flop-0',
      'picker-slot-flop-1',
      'picker-slot-flop-2',
      'picker-slot-turn',
      'picker-slot-river',
    ];
    const rendered = screen.getAllByTestId(/^picker-slot-/).map((el) => el.dataset.testid);
    expect(rendered).toEqual(expectedOrder);
  });

  it('an unset slot reads "{Slot Name}: —" and its Clear button is disabled', () => {
    render(<CardPicker />);
    expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: —');
    expect(screen.getByTestId('picker-clear-hero-0')).toBeDisabled();
  });

  it('Clear All is disabled when every slot is empty', () => {
    render(<CardPicker />);
    expect(screen.getByTestId('picker-clear-all')).toBeDisabled();
  });

  it('clicking a slot opens the picker-panel dialog headed "Pick a card for {Slot Name}"', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);

    await user.click(screen.getByTestId('picker-slot-hero-0'));

    const dialog = screen.getByTestId('picker-panel') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Pick a card for Hero 1' })).toBeInTheDocument();
  });

  it('renders four suit groups in ALL_SUITS order, each with 13 rank buttons — 52 total', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));

    const suitHeadings = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);
    expect(suitHeadings).toEqual(['Clubs', 'Diamonds', 'Hearts', 'Spades']);

    const cardButtons = screen.getAllByTestId(/^picker-card-/);
    expect(cardButtons).toHaveLength(52);
  });

  it('clicking an available card assigns it to the open slot and closes the dialog', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));

    await user.click(screen.getByTestId('picker-card-As'));

    expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: As');
    const dialog = screen.getByTestId('picker-panel') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('a card held by a DIFFERENT slot renders disabled, with "(used)" text and the used-reason title', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));
    await user.click(screen.getByTestId('picker-card-As'));

    await user.click(screen.getByTestId('picker-slot-flop-0'));
    const usedCard = screen.getByTestId('picker-card-As');

    expect(usedCard).toBeDisabled();
    expect(usedCard.textContent).toBe('As (used)');
    expect(usedCard).toHaveAttribute('title', 'Already used in this hand');
  });

  it('the card held by the slot currently being edited is NOT marked used when reopened from that slot', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));
    await user.click(screen.getByTestId('picker-card-As'));

    await user.click(screen.getByTestId('picker-slot-hero-0'));
    const ownCard = screen.getByTestId('picker-card-As');

    expect(ownCard).not.toBeDisabled();
    expect(ownCard.textContent).toBe('As');
  });

  it('"Cancel Pick" closes the dialog without changing the slot', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));

    await user.click(screen.getByRole('button', { name: 'Cancel Pick' }));

    expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: —');
    const dialog = screen.getByTestId('picker-panel') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('per-slot Clear becomes enabled after a pick and clears only that slot', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));
    await user.click(screen.getByTestId('picker-card-As'));

    expect(screen.getByTestId('picker-clear-hero-0')).not.toBeDisabled();
    await user.click(screen.getByTestId('picker-clear-hero-0'));

    expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: —');
  });

  it('Clear All clears every slot', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));
    await user.click(screen.getByTestId('picker-card-As'));
    await user.click(screen.getByTestId('picker-slot-turn'));
    await user.click(screen.getByTestId('picker-card-Kd'));

    await user.click(screen.getByTestId('picker-clear-all'));

    expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: —');
    expect(screen.getByTestId('picker-slot-turn').textContent).toBe('Turn: —');
    expect(screen.getByTestId('picker-clear-all')).toBeDisabled();
  });
});
