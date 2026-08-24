import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BlackjackOddsPanel } from './BlackjackOddsPanel';
import { useBlackjackOddsStore } from '../state/blackjackOddsStore';
import { useUiStore } from '../state/uiStore';
import { DEALER_BUCKET_COUNT } from '../worker/blackjackProtocol';
import { DEALER_BUCKET_LABELS, DEALER_BUCKET_TESTIDS } from './dealerBucketLabels';

const EM_DASH = '—';

/**
 * The 13 value testids the pending sweep must mask (checker FLAG 2 / TBL-04's literal bar).
 * The trial counter is asserted separately — it also masks to the em dash while pending but
 * renders a count (not a percentage/EV) otherwise.
 */
const VALUE_TESTIDS = [
  'blackjack-bust-pct',
  'blackjack-stand-win-pct',
  'blackjack-stand-push-pct',
  'blackjack-stand-lose-pct',
  'blackjack-ev-stand',
  'blackjack-ev-hit',
  'blackjack-dealer-pct-17',
  'blackjack-dealer-pct-18',
  'blackjack-dealer-pct-19',
  'blackjack-dealer-pct-20',
  'blackjack-dealer-pct-21',
  'blackjack-dealer-pct-natural',
  'blackjack-dealer-pct-bust',
] as const;

/** Known tallies with clean exact-string expectations (all three sums reconcile to 1000). */
const KNOWN_TALLIES = {
  dealerOutcomeCounts: [140, 130, 120, 110, 100, 50, 350],
  bustIfHitCount: 300,
  standOutcomes: { win: 420, push: 90, lose: 490 },
  hitOutcomes: { win: 560, push: 0, lose: 440 },
  trialsCompleted: 1000,
  done: true,
};

function resetStores() {
  useUiStore.setState({ pendingAnimationCount: 0 });
  useBlackjackOddsStore.setState({
    dealerOutcomeCounts: new Array<number>(DEALER_BUCKET_COUNT).fill(0),
    bustIfHitCount: 0,
    standOutcomes: { win: 0, push: 0, lose: 0 },
    hitOutcomes: { win: 0, push: 0, lose: 0 },
    trialsCompleted: 0,
    done: false,
    displayedDeckCount: 1,
  });
}

describe('BlackjackOddsPanel — the docked odds cluster (BJ-03/BJ-04, A7)', () => {
  beforeEach(resetStores);

  it('renders every locked copy string verbatim (Copywriting Contract)', () => {
    render(<BlackjackOddsPanel />);

    expect(screen.getByText('Trials')).toBeInTheDocument();
    expect(screen.getByText('Bust if you hit')).toBeInTheDocument();
    expect(screen.getByText('If you stand')).toBeInTheDocument();
    expect(screen.getByText('Win')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();
    expect(screen.getByText('Loss')).toBeInTheDocument();
    expect(screen.getByText('Expected value')).toBeInTheDocument();
    expect(screen.getByText('Per unit wagered')).toBeInTheDocument();
    expect(screen.getByText('Stand')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText("Dealer's final hand")).toBeInTheDocument();
  });

  it('pending sweep: all 13 value cells AND the trial counter mask to the em dash even with non-zero tallies in the store (TBL-04, checker FLAG 2)', () => {
    useBlackjackOddsStore.setState(KNOWN_TALLIES);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<BlackjackOddsPanel />);

    for (const testid of VALUE_TESTIDS) {
      expect(screen.getByTestId(testid).textContent).toBe(EM_DASH);
    }
    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe(EM_DASH);

    const panel = screen.getByTestId('blackjack-odds-panel');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(panel).toHaveClass('odds-panel--pending');
  });

  it('zero-trials sweep: counter reads 0, every stat reads the em dash, panel not busy (A16 idle/just-toggled/resolved-at-deal state)', () => {
    render(<BlackjackOddsPanel />);

    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe('0');
    for (const testid of VALUE_TESTIDS) {
      expect(screen.getByTestId(testid).textContent).toBe(EM_DASH);
    }

    const panel = screen.getByTestId('blackjack-odds-panel');
    expect(panel).toHaveAttribute('aria-busy', 'false');
    expect(panel).not.toHaveClass('odds-panel--pending');
  });

  it('known-tally sweep: exact formatted strings in every cell (formatPct/formatEv conventions)', () => {
    useBlackjackOddsStore.setState(KNOWN_TALLIES);
    render(<BlackjackOddsPanel />);

    expect(screen.getByTestId('blackjack-trial-counter').textContent).toBe((1000).toLocaleString());
    expect(screen.getByTestId('blackjack-bust-pct').textContent).toBe('30.0%');
    expect(screen.getByTestId('blackjack-stand-win-pct').textContent).toBe('42.0%');
    expect(screen.getByTestId('blackjack-stand-push-pct').textContent).toBe('9.0%');
    expect(screen.getByTestId('blackjack-stand-lose-pct').textContent).toBe('49.0%');
    // EV(Stand) = (420 - 490) / 1000 = -0.07; EV(Hit) = (560 - 440) / 1000 = +0.12 (A8).
    expect(screen.getByTestId('blackjack-ev-stand').textContent).toBe('−0.07 units');
    expect(screen.getByTestId('blackjack-ev-hit').textContent).toBe('+0.12 units');
    expect(screen.getByTestId('blackjack-dealer-pct-17').textContent).toBe('14.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-18').textContent).toBe('13.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-19').textContent).toBe('12.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-20').textContent).toBe('11.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-21').textContent).toBe('10.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-natural').textContent).toBe('5.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-bust').textContent).toBe('35.0%');
  });

  it("A15 double-pin: display wording is 'Loss' while the testid and store field use 'lose'", () => {
    useBlackjackOddsStore.setState(KNOWN_TALLIES);
    render(<BlackjackOddsPanel />);

    // Display vocabulary: noun-consistent Win/Push/Loss (Hold'em's shipped convention).
    expect(screen.getByText('Loss')).toBeInTheDocument();
    // Machine vocabulary: `lose`, tracking the engine's field name — never `loss`.
    expect(screen.getByTestId('blackjack-stand-lose-pct').textContent).toBe('49.0%');
    expect(screen.queryByTestId('blackjack-stand-loss-pct')).not.toBeInTheDocument();
  });

  it("the Hit tile's 'hit once, then stand' sub-copy is a real DOM text node, visible in every state (D-05)", () => {
    const { unmount } = render(<BlackjackOddsPanel />);
    // Present at zero trials...
    expect(screen.getByText('hit once, then stand')).toBeInTheDocument();
    unmount();

    // ...and still present while pending — never conditional, never attribute-only.
    useBlackjackOddsStore.setState(KNOWN_TALLIES);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<BlackjackOddsPanel />);
    expect(screen.getByText('hit once, then stand')).toBeInTheDocument();
  });
});

describe('DealerDistributionDisplay — the 7-bucket dealer final-outcome table (BJ-03, A13)', () => {
  beforeEach(resetStores);

  it('label constants stay tied to DEALER_BUCKET_COUNT (parallel to DEALER_BUCKET_ORDER)', () => {
    expect(DEALER_BUCKET_LABELS.length).toBe(DEALER_BUCKET_COUNT);
    expect(DEALER_BUCKET_TESTIDS.length).toBe(DEALER_BUCKET_COUNT);
  });

  it('renders seven rows in the fixed order even when dealerOutcomeCounts is empty (T-06-30), all em dashes', () => {
    useBlackjackOddsStore.setState({ dealerOutcomeCounts: [], trialsCompleted: 0 });
    render(<BlackjackOddsPanel />);

    const table = screen.getByTestId('blackjack-dealer-table');
    for (const label of DEALER_BUCKET_LABELS) {
      expect(within(table).getByRole('rowheader', { name: label })).toBeInTheDocument();
    }
    for (const suffix of DEALER_BUCKET_TESTIDS) {
      expect(screen.getByTestId(`blackjack-dealer-pct-${suffix}`).textContent).toBe(EM_DASH);
    }
  });

  it('renders seven rows when the snapshot is SHORT (malformed) — missing cells fall back to 0, rows never shrink', () => {
    useBlackjackOddsStore.setState({ dealerOutcomeCounts: [100, 50], trialsCompleted: 1000 });
    render(<BlackjackOddsPanel />);

    expect(screen.getByTestId('blackjack-dealer-pct-17').textContent).toBe('10.0%');
    expect(screen.getByTestId('blackjack-dealer-pct-18').textContent).toBe('5.0%');
    for (const suffix of ['19', '20', '21', 'natural', 'bust']) {
      expect(screen.getByTestId(`blackjack-dealer-pct-${suffix}`).textContent).toBe('0.0%');
    }
  });

  it('subtitle names the 1-deck shoe the displayed run was computed under (A3 snapshot rule)', () => {
    useBlackjackOddsStore.setState({ displayedDeckCount: 1 });
    render(<BlackjackOddsPanel />);

    expect(screen.getByText('Given the cards you can see · 1-deck shoe')).toBeInTheDocument();
  });

  it('subtitle names the 2-deck shoe when displayedDeckCount is 2 (exact locked string, U+00B7)', () => {
    useBlackjackOddsStore.setState({ displayedDeckCount: 2 });
    render(<BlackjackOddsPanel />);

    expect(screen.getByText('Given the cards you can see · 2-deck shoe')).toBeInTheDocument();
  });
});
