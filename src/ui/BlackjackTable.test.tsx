import { describe, it, expect, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BlackjackTable } from './BlackjackTable';
import { useBlackjackStore } from '../state/blackjackStore';
import { useUiStore } from '../state/uiStore';

// Gate-accounting regression pins for the Blackjack composition root (05-REVIEW CR-02 applied
// to blackjack, D-13, T-06-25). The mode fork re-mounts BlackjackTable with a DEALT round (a
// holdem -> blackjack switch-back) — the release effect must fire ONLY when the tracked deps
// (roundNonce / playerHand.length / roundPhase / revealedHole) actually CHANGE, never on a
// mount, a StrictMode double-invoked mount, or a switch-back re-mount no blackjackStore action
// armed. Default harness (src/test/setup.ts forces reduced motion) keeps AnimatedCard/FlipCard
// out of the gate entirely, so every count below measures BlackjackTable's own effect and
// nothing else — units armed below stand in for in-flight cards whose registrations the table
// must never steal. Banner copy strings are transcribed from 06-UI-SPEC's outcome-banner copy
// table, deliberately NOT imported from the component, so component drift fails the test.

function resetBlackjackState() {
  useBlackjackStore.setState({
    round: null,
    playerHand: [],
    dealerPlayoutCards: [],
    roundPhase: 'idle',
    revealedHole: false,
    outcome: null,
    playerNaturalWin: false,
    deckCount: 1,
    roundNonce: 0,
  });
}

/** A mid-round player-turn shape — the mode switch-back re-mount scenario. */
function seedDealtRound() {
  useBlackjackStore.setState({
    round: { dealerUpcard: '7d', dealerHole: 'Th' },
    playerHand: ['Kh', '9s'],
    dealerPlayoutCards: [],
    roundPhase: 'player-turn',
    revealedHole: false,
    outcome: null,
    playerNaturalWin: false,
    roundNonce: 1,
  });
}

beforeEach(() => {
  resetBlackjackState();
  // TEST-ONLY reset (uiStore's own guard comment) — beforeEach isolation only.
  useUiStore.getState().resetAnimations();
});

describe('BlackjackTable re-mount with a dealt round — no gate-unit theft (05-REVIEW CR-02, T-06-25)', () => {
  it('mounting with a dealt round releases nothing: units armed by other registrations are untouched', () => {
    seedDealtRound();
    act(() => {
      useUiStore.getState().beginAnimation();
      useUiStore.getState().beginAnimation();
    });

    render(<BlackjackTable />);

    expect(useUiStore.getState().pendingAnimationCount).toBe(2);
  });

  it('a StrictMode double-invoked mount with a dealt round also releases nothing', () => {
    seedDealtRound();
    act(() => {
      useUiStore.getState().beginAnimation();
      useUiStore.getState().beginAnimation();
    });

    render(
      <StrictMode>
        <BlackjackTable />
      </StrictMode>,
    );

    expect(useUiStore.getState().pendingAnimationCount).toBe(2);
  });

  it('each real action-shaped dep change releases exactly the one unit the action armed', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors revealHole(): state change + arm in the same synchronous tick.
    act(() => {
      useBlackjackStore.setState({ revealedHole: true });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors a non-bust hit(): a second, different dep changing must release again.
    act(() => {
      useBlackjackStore.setState({ playerHand: ['Kh', '9s', '2c'] });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors deal(): the roundNonce change releases again.
    act(() => {
      useBlackjackStore.setState({
        round: { dealerUpcard: '8d', dealerHole: 'Jh' },
        playerHand: ['Qh', '6s'],
        dealerPlayoutCards: [],
        roundPhase: 'player-turn',
        revealedHole: false,
        outcome: null,
        playerNaturalWin: false,
        roundNonce: 2,
      });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('a hit-into-bust commit (hand length AND roundPhase changing at once) releases exactly ONE unit', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors hit()'s bust path: one set(), one beginAnimation() — plus a second armed unit
    // standing in for an unrelated in-flight registration. If the release effect fired once
    // per changed dep (rather than once per commit), the stand-in unit would be stolen here.
    act(() => {
      useUiStore.getState().beginAnimation();
      useBlackjackStore.setState({
        playerHand: ['Kh', '9s', '5c'],
        roundPhase: 'resolved',
        outcome: 'lose',
        revealedHole: true,
      });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('under StrictMode a real dep change releases exactly once — no compensating-cleanup drift', () => {
    seedDealtRound();
    render(
      <StrictMode>
        <BlackjackTable />
      </StrictMode>,
    );
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    act(() => {
      useBlackjackStore.setState({ revealedHole: true });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});

describe('BlackjackTable felt structure', () => {
  it('renders the decorative deck-origin stack, aria-hidden, with the back art', () => {
    render(<BlackjackTable />);
    const deck = screen.getByTestId('blackjack-deck-origin');
    expect(deck).toHaveAttribute('aria-hidden', 'true');
    expect(deck.querySelectorAll('img.card-back')).toHaveLength(3);
  });

  it('while idle, both rows show two dashed placeholders each and both seat badges render', () => {
    render(<BlackjackTable />);
    expect(
      screen.getByTestId('blackjack-player-cards').querySelectorAll('.bj-card-placeholder'),
    ).toHaveLength(2);
    expect(
      screen.getByTestId('blackjack-dealer-cards').querySelectorAll('.bj-card-placeholder'),
    ).toHaveLength(2);
    expect(screen.getByTestId('blackjack-dealer-label')).toHaveTextContent('Dealer');
    expect(screen.getByTestId('blackjack-player-label')).toHaveTextContent('You');
  });
});

describe('BlackjackOutcomeBanner gating (A6/A16, T-06-28)', () => {
  it('is absent while the round is not resolved', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(screen.queryByTestId('blackjack-outcome-banner')).not.toBeInTheDocument();
  });

  it('is absent while any animation unit is pending, and appears once the gate clears', () => {
    useBlackjackStore.setState({
      round: { dealerUpcard: '7d', dealerHole: 'Th' },
      playerHand: ['Kh', '9s'],
      dealerPlayoutCards: [],
      roundPhase: 'resolved',
      revealedHole: true,
      outcome: 'win',
      playerNaturalWin: false,
      roundNonce: 1,
    });
    act(() => {
      useUiStore.getState().beginAnimation();
    });

    render(<BlackjackTable />);
    // A card is (nominally) still in flight: the banner must NEVER appear mid-flight.
    expect(screen.queryByTestId('blackjack-outcome-banner')).not.toBeInTheDocument();

    act(() => {
      useUiStore.getState().endAnimation();
    });
    expect(screen.getByTestId('blackjack-outcome-banner')).toBeInTheDocument();
  });

  it('carries role="status", never role="alert"', () => {
    useBlackjackStore.setState({
      round: { dealerUpcard: '7d', dealerHole: 'Th' },
      playerHand: ['Kh', '9s'],
      dealerPlayoutCards: [],
      roundPhase: 'resolved',
      revealedHole: true,
      outcome: 'win',
      playerNaturalWin: false,
      roundNonce: 1,
    });
    render(<BlackjackTable />);
    const banner = screen.getByTestId('blackjack-outcome-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('Dealer and player areas — cards, totals, one-way hole reveal (BJ-06, D-02/D-13/D-14)', () => {
  it('the hidden hole card appears NOWHERE in the DOM — neither alt text nor asset filename (T-06-24)', () => {
    seedDealtRound(); // hole is 'Th' -> alt "Ten of Hearts", asset "H-10.svg"
    const { container } = render(<BlackjackTable />);
    expect(container.innerHTML).not.toContain('Ten of Hearts');
    expect(container.innerHTML).not.toContain('H-10.svg');
    // ...while the upcard IS face-up with its human-readable alt.
    expect(screen.getByAltText('Seven of Diamonds')).toBeInTheDocument();
  });

  it('clicking the reveal button shows the hole face, disables the button, and balances the gate', () => {
    seedDealtRound();
    const { container } = render(<BlackjackTable />);
    const button = screen.getByTestId('blackjack-hole-reveal');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-label', "Reveal the dealer's hole card");

    fireEvent.click(button);

    expect(useBlackjackStore.getState().revealedHole).toBe(true);
    expect(container.innerHTML).toContain('H-10.svg');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', "Dealer's hole card: Ten of Hearts");
    // revealHole() armed one unit; the release effect released it on the revealedHole change.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('clicking twice reveals once — the second click arms nothing (one-way per round)', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    const button = screen.getByTestId('blackjack-hole-reveal');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(useBlackjackStore.getState().revealedHole).toBe(true);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('reveal button disabled matrix: idle disabled, player-turn enabled, revealed disabled, resolved disabled', () => {
    // idle
    const { unmount } = render(<BlackjackTable />);
    expect(screen.getByTestId('blackjack-hole-reveal')).toBeDisabled();
    unmount();

    // player-turn, hole hidden
    seedDealtRound();
    const second = render(<BlackjackTable />);
    expect(screen.getByTestId('blackjack-hole-reveal')).toBeEnabled();

    // player-turn, hole revealed early (BJ-06): still player-turn, but one-way
    act(() => {
      useBlackjackStore.setState({ revealedHole: true });
    });
    expect(screen.getByTestId('blackjack-hole-reveal')).toBeDisabled();
    second.unmount();

    // resolved
    useBlackjackStore.setState({
      round: { dealerUpcard: '7d', dealerHole: 'Th' },
      playerHand: ['Kh', '9s'],
      dealerPlayoutCards: [],
      roundPhase: 'resolved',
      revealedHole: true,
      outcome: 'win',
      playerNaturalWin: false,
      roundNonce: 1,
    });
    render(<BlackjackTable />);
    expect(screen.getByTestId('blackjack-hole-reveal')).toBeDisabled();
  });

  it('the dealer total badge is ABSENT while the hole is hidden and present after a reveal (A11)', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(screen.queryByTestId('blackjack-dealer-total')).not.toBeInTheDocument();

    act(() => {
      useBlackjackStore.setState({ revealedHole: true });
    });
    // 7d + Th = 17
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('17');
  });

  it('soft totals read "Soft {total}" in both badges (A11)', () => {
    useBlackjackStore.setState({
      round: { dealerUpcard: 'Ad', dealerHole: '6h' },
      playerHand: ['As', '6c'],
      dealerPlayoutCards: [],
      roundPhase: 'player-turn',
      revealedHole: true,
      outcome: null,
      playerNaturalWin: false,
      roundNonce: 1,
    });
    render(<BlackjackTable />);
    expect(screen.getByTestId('blackjack-player-total').textContent).toBe('Soft 17');
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('Soft 17');
  });

  it('the player total badge is present whenever a hand exists', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(screen.getByTestId('blackjack-player-total').textContent).toBe('19');
    expect(screen.getByTestId('blackjack-player-label')).toHaveTextContent('You');
  });

  it('playout draws render face-up after the hole, and the dealer total counts them', () => {
    useBlackjackStore.setState({
      round: { dealerUpcard: '6d', dealerHole: 'Th' },
      playerHand: ['Kh', '9s'],
      dealerPlayoutCards: ['2c'],
      roundPhase: 'resolved',
      revealedHole: true,
      outcome: 'lose',
      playerNaturalWin: false,
      roundNonce: 1,
    });
    render(<BlackjackTable />);
    expect(screen.getByAltText('Two of Clubs')).toBeInTheDocument();
    // 6d + Th + 2c = 18
    expect(screen.getByTestId('blackjack-dealer-total').textContent).toBe('18');
  });

  it('a natural-resolved deal mounts the hole face-up in the same commit, gate balanced (D-03a)', () => {
    render(<BlackjackTable />);
    const before = useUiStore.getState().pendingAnimationCount;
    expect(before).toBe(0);

    // Mirrors deal() resolving a dealer natural: one set(), one unconditional beginAnimation().
    act(() => {
      useBlackjackStore.setState({
        round: { dealerUpcard: 'Ad', dealerHole: 'Tc' },
        playerHand: ['Kh', '9s'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'lose',
        playerNaturalWin: false,
        roundNonce: 1,
      });
      useUiStore.getState().beginAnimation();
    });

    // The hole face is present on the round's FIRST render — FlipCard mounted already
    // face-up (mountedFaceUp suppresses the flip; no land-then-flip two-step).
    expect(document.body.innerHTML).toContain('C-10.svg');
    // Exactly the deal's own unit was armed and released — no extra flip registration.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('player cards use the hero width class, dealer cards the opponent width class (A5)', () => {
    seedDealtRound();
    render(<BlackjackTable />);
    expect(
      screen.getByTestId('blackjack-player-cards').querySelectorAll('.card-slot--hero'),
    ).toHaveLength(2);
    expect(
      screen.getByTestId('blackjack-dealer-cards').querySelectorAll('.card-slot--opponent'),
    ).toHaveLength(2);
  });
});

// The eight resolution paths of 06-UI-SPEC's outcome-banner copy table — headings and bodies
// LOCKED VERBATIM (strings transcribed from the spec, not imported from the component).
describe('BlackjackOutcomeBanner copy — all eight locked paths (06-UI-SPEC)', () => {
  const CASES: {
    name: string;
    state: Partial<ReturnType<typeof useBlackjackStore.getState>>;
    heading: string;
    body: string;
  }[] = [
    {
      name: 'stand, player total higher',
      state: {
        round: { dealerUpcard: '7d', dealerHole: 'Th' },
        playerHand: ['Kh', '9s'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'win',
        playerNaturalWin: false,
      },
      heading: 'You win',
      body: "Your 19 beats the dealer's 17.",
    },
    {
      name: 'dealer busts on playout',
      state: {
        round: { dealerUpcard: '6d', dealerHole: 'Th' },
        playerHand: ['Kh', '9s'],
        dealerPlayoutCards: ['9c'],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'win',
        playerNaturalWin: false,
      },
      heading: 'You win',
      body: 'The dealer busts with 25.',
    },
    {
      name: 'player busts on Hit',
      state: {
        round: { dealerUpcard: '7d', dealerHole: 'Th' },
        playerHand: ['Kh', '9s', '5c'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'lose',
        playerNaturalWin: false,
      },
      heading: 'Dealer wins',
      body: 'You bust with 24.',
    },
    {
      name: 'stand, dealer total higher',
      state: {
        round: { dealerUpcard: '9d', dealerHole: 'Th' },
        playerHand: ['Kh', '8s'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'lose',
        playerNaturalWin: false,
      },
      heading: 'Dealer wins',
      body: "The dealer's 19 beats your 18.",
    },
    {
      name: 'stand, equal totals',
      state: {
        round: { dealerUpcard: '8d', dealerHole: 'Th' },
        playerHand: ['Kh', '8s'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'push',
        playerNaturalWin: false,
      },
      heading: 'Push',
      body: 'Both hands total 18.',
    },
    {
      name: 'player natural only (at deal)',
      state: {
        round: { dealerUpcard: '9d', dealerHole: '7c' },
        playerHand: ['Ah', 'Ks'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'win',
        playerNaturalWin: true,
      },
      heading: 'Blackjack — you win',
      body: 'Your natural pays 3:2.',
    },
    {
      name: 'dealer natural only (at deal, D-03a)',
      state: {
        round: { dealerUpcard: 'Ad', dealerHole: 'Tc' },
        playerHand: ['Kh', '9s'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'lose',
        playerNaturalWin: false,
      },
      heading: 'Dealer blackjack',
      body: "The dealer's natural beats your 19.",
    },
    {
      name: 'both naturals (at deal)',
      state: {
        round: { dealerUpcard: 'Ad', dealerHole: 'Tc' },
        playerHand: ['Ah', 'Ks'],
        dealerPlayoutCards: [],
        roundPhase: 'resolved',
        revealedHole: true,
        outcome: 'push',
        playerNaturalWin: false,
      },
      heading: 'Push',
      body: 'Two naturals — the round is a push.',
    },
  ];

  it.each(CASES)('$name: locked heading and body', ({ state, heading, body }) => {
    useBlackjackStore.setState({ ...state, roundNonce: 1 });
    render(<BlackjackTable />);
    const banner = screen.getByTestId('blackjack-outcome-banner');
    expect(banner).toHaveTextContent(heading);
    expect(banner).toHaveTextContent(body);
  });
});
