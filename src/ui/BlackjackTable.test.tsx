import { describe, it, expect, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
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

// The eight resolution paths of 06-UI-SPEC's outcome-banner copy table — headings and bodies
// LOCKED VERBATIM (strings transcribed from the spec, not imported from the component).
describe('BlackjackOutcomeBanner copy — all eight locked paths (06-UI-SPEC)', () => {
  const CASES: {
    name: string;
    state: Parameters<typeof useBlackjackStore.setState>[0];
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
