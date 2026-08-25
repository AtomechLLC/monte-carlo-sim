import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardPicker } from './CardPicker';
import { usePickerStore } from '../state/pickerStore';
import { useGameStore } from '../state/gameStore';

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
    // NEW test-isolation surface (07-02): the picker now subscribes to gameStore for the
    // live deckCount, which this file never had to reset before — without this reset a
    // 2-deck test would leak into the shipped 1-deck assertions below.
    useGameStore.setState({ deckCount: 1 });
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

  it('at 1 deck, no cell ever carries either 2-deck title', async () => {
    const user = userEvent.setup();
    render(<CardPicker />);
    await user.click(screen.getByTestId('picker-slot-hero-0'));
    await user.click(screen.getByTestId('picker-card-As'));
    await user.click(screen.getByTestId('picker-slot-flop-0'));

    for (const button of screen.getAllByTestId(/^picker-card-/)) {
      expect(button).not.toHaveAttribute('title', '1 of 2 copies used');
      expect(button).not.toHaveAttribute('title', 'Both copies already used in this hand');
    }
  });

  describe('deckCount === 2 — live gameStore read + setPick wire (D-07/D-15, closes WR-01)', () => {
    beforeEach(() => {
      useGameStore.setState({ deckCount: 2 });
    });

    it('a card with zero copies consumed is enabled, shows the plain label, and carries NO title', async () => {
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));

      const card = screen.getByTestId('picker-card-As');
      expect(card).not.toBeDisabled();
      expect(card.textContent).toBe('As');
      expect(card).not.toHaveAttribute('title');
    });

    it('after ONE copy is picked into another slot, the cell stays enabled with the plain label and title "1 of 2 copies used"', async () => {
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      await user.click(screen.getByTestId('picker-slot-flop-0'));
      const card = screen.getByTestId('picker-card-As');

      expect(card).not.toBeDisabled();
      expect(card.textContent).toBe('As');
      expect(card).toHaveAttribute('title', '1 of 2 copies used');
    });

    it('picking the same card into a SECOND slot SUCCEEDS — both slots hold it (the WR-01 regression detector)', async () => {
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      await user.click(screen.getByTestId('picker-slot-flop-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      // With the old pinned deckCount = 1, the store silently dropped this second pick
      // while the availability check showed the card as pickable (04-REVIEW WR-01).
      expect(screen.getByTestId('picker-slot-hero-0').textContent).toBe('Hero 1: As');
      expect(screen.getByTestId('picker-slot-flop-0').textContent).toBe('Flop 1: As');
      expect(usePickerStore.getState().picks['hero-0']).toBe('As');
      expect(usePickerStore.getState().picks['flop-0']).toBe('As');
    });

    it('after BOTH copies are consumed, the cell is disabled, shows "(used)", and carries the both-copies title', async () => {
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));
      await user.click(screen.getByTestId('picker-slot-flop-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      await user.click(screen.getByTestId('picker-slot-turn'));
      const card = screen.getByTestId('picker-card-As');

      expect(card).toBeDisabled();
      expect(card.textContent).toBe('As (used)');
      expect(card).toHaveAttribute('title', 'Both copies already used in this hand');
    });

    it('a third pick of the same card into a third slot is a no-op — the third slot stays empty', async () => {
      usePickerStore.getState().setPick('hero-0', 'As', 2);
      usePickerStore.getState().setPick('flop-0', 'As', 2);
      const user = userEvent.setup();
      render(<CardPicker />);

      await user.click(screen.getByTestId('picker-slot-turn'));
      // The cell is structurally blocked (disabled), so drive the handler through the
      // store path too: the slot must stay empty either way.
      expect(screen.getByTestId('picker-card-As')).toBeDisabled();
      usePickerStore.getState().setPick('turn', 'As', 2);

      expect(usePickerStore.getState().picks['turn']).toBeNull();
      expect(screen.getByTestId('picker-slot-turn').textContent).toBe('Turn: —');
    });

    it('the card held by the slot currently being edited is still never marked used at 2 decks', async () => {
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));

      await user.click(screen.getByTestId('picker-slot-hero-0'));
      const ownCard = screen.getByTestId('picker-card-As');

      expect(ownCard).not.toBeDisabled();
      expect(ownCard.textContent).toBe('As');
      expect(ownCard).not.toHaveAttribute('title');
    });

    it('re-rendering after a 1 -> 2 deck switch re-enables a previously (used) cell and swaps its title to the 1-of-2 form', async () => {
      useGameStore.setState({ deckCount: 1 });
      const user = userEvent.setup();
      render(<CardPicker />);
      await user.click(screen.getByTestId('picker-slot-hero-0'));
      await user.click(screen.getByTestId('picker-card-As'));
      await user.click(screen.getByTestId('picker-slot-flop-0'));

      const before = screen.getByTestId('picker-card-As');
      expect(before).toBeDisabled();
      expect(before.textContent).toBe('As (used)');
      expect(before).toHaveAttribute('title', 'Already used in this hand');

      act(() => {
        useGameStore.setState({ deckCount: 2 });
      });

      const after = screen.getByTestId('picker-card-As');
      expect(after).not.toBeDisabled();
      expect(after.textContent).toBe('As');
      expect(after).toHaveAttribute('title', '1 of 2 copies used');
    });
  });
});
