import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealButton } from './DealButton';
import { StreetControls } from './StreetControls';
import { useGameStore } from '../state/gameStore';

/**
 * "Which button do I press next?"
 *
 * The app answers that with one lilac control at a time (`data-next-action`), and the answer
 * MOVES: Deal before a hand exists, Advance once the hand is running, Deal again once the
 * river leaves nothing to advance to.
 *
 * Two properties matter more than any single state, and both are asserted below:
 *   1. EXACTLY ONE control is marked at a time. Two lilac buttons is not a stronger hint, it
 *      is a contradiction — the signal's whole value is that it is unambiguous.
 *   2. A DISABLED control is never marked. The attribute must be absent, not merely dimmed by
 *      CSS, or the app would be pointing at something that cannot be pressed.
 */

function markedIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-next-action="true"]')].map(
    (el) => el.textContent?.trim() ?? '',
  );
}

/** Both Hold'em controls together, which is how they are actually rendered. */
function renderHoldemControls() {
  return render(
    <>
      <DealButton />
      <StreetControls />
    </>,
  );
}

describe("Hold'em — the next-action signal moves with the hand", () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, deckCount: 1 });
  });

  it('points at Deal when no hand has been dealt', () => {
    const { container } = renderHoldemControls();
    expect(markedIn(container)).toEqual(['Deal']);
  });

  it('hands the signal to Advance once a hand is running', () => {
    useGameStore.getState().deal();
    const { container } = renderHoldemControls();

    expect(markedIn(container)).toEqual(['Advance']);
    // ...and Deal has genuinely given it up, not merely been out-styled.
    const deal = screen.getByRole('button', { name: 'Deal' });
    expect(deal).not.toHaveAttribute('data-next-action');
  });

  it('returns the signal to Deal at the river, where there is nothing left to advance to', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'river' });
    const { container } = renderHoldemControls();

    expect(markedIn(container)).toEqual(['Deal']);
  });

  it.each(['preflop', 'flop', 'turn', 'river'] as const)(
    'marks exactly one control at %s, and never a disabled one',
    (street) => {
      useGameStore.getState().deal();
      useGameStore.setState({ street });
      const { container } = renderHoldemControls();

      expect(markedIn(container)).toHaveLength(1);
      for (const el of container.querySelectorAll('[data-next-action="true"]')) {
        expect(el, 'a disabled control can never be the next action').not.toBeDisabled();
      }
    },
  );

  it('never marks Rewind — going back is not the way forward', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'turn' });
    renderHoldemControls();

    expect(screen.getByTestId('rewind-button')).not.toHaveAttribute('data-next-action');
  });
});

describe('Blackjack — Hit and Stand are both "next", because the choice is genuinely the player’s', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('marks Deal outside a player-turn and both plays during one', async () => {
    const { useBlackjackStore } = await import('../state/blackjackStore');
    const { BlackjackControls } = await import('./BlackjackControls');

    useBlackjackStore.setState({ roundPhase: 'idle' });
    const idle = render(<BlackjackControls />);
    expect(markedIn(idle.container)).toEqual(['Deal']);
    idle.unmount();

    useBlackjackStore.setState({ roundPhase: 'player-turn' });
    const playing = render(<BlackjackControls />);
    // Both, deliberately: this app gives no strategy advice, so naming one of them the
    // recommended play would be a claim it has no business making.
    expect(markedIn(playing.container).sort()).toEqual(['Hit', 'Stand']);
    expect(playing.container.querySelector('[data-testid="blackjack-deal-button"]')).not.toHaveAttribute(
      'data-next-action',
    );
  });
});
