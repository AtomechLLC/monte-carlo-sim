// Pins the D-09 isolation discipline in BOTH directions, mirroring Phase 5's precedent:
// the Five of a Kind row must be fully present at deckCount 2 (last tbody row, after Royal
// Flush, with its row testid and index-10 cells) AND leave zero DOM trace at deckCount 1 —
// no hidden row, no display:none, no colspan artifact. This is a NEW sibling file because
// App.test.tsx's row-label assertion (rendered rows vs the whole CATEGORY_LABELS constant)
// is frozen (D-11) and renders at one deck; it must never be edited to accommodate the
// eleventh row.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { OddsTable } from './OddsTable';
import { useGameStore } from '../state/gameStore';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { CATEGORY_LABELS } from './categoryLabels';
import type { PredeterminedRunout } from '../engine/conditioning';

/** Duplicate-free fixture; on the flop the hero has One Pair (locked index 1). */
const CLEAN_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ac', 'Kd'],
  board: ['Ah', '7c', '2d', '9s', '4h'],
  opponentHoles: [
    ['Qs', 'Jh'],
    ['Ts', '3c'],
    ['8d', '6h'],
  ],
};

/** 2-deck fixture: five visible aces on the river (hero holds two identical copies). */
const FIVE_OAK_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ah', 'Ah'],
  board: ['Ac', 'Ad', 'As', '7c', '2d'],
  opponentHoles: [
    ['Qs', 'Jh'],
    ['Ts', '3c'],
    ['8d', '6h'],
  ],
};

/** Settled 10-length snapshot fields (category and outcome sums both equal trialsCompleted). */
const SETTLED_10 = {
  categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1],
  outcomes: { win: 600, tie: 100, lose: 300 },
  trialsCompleted: 1000,
  done: true,
};

/** Settled 11-length snapshot fields — index 10 carries a nonzero Five of a Kind count. */
const SETTLED_11 = {
  categoryCounts: [500, 200, 100, 80, 40, 30, 20, 10, 5, 5, 10],
  outcomes: { win: 600, tie: 100, lose: 300 },
  trialsCompleted: 1000,
  done: true,
};

beforeEach(() => {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
  useOddsStore.setState({
    categoryCounts: new Array(10).fill(0) as number[],
    outcomes: { win: 0, tie: 0, lose: 0 },
    trialsCompleted: 0,
    done: false,
  });
  useUiStore.setState({ pendingAnimationCount: 0 });
});

describe('OddsTable at deckCount 1 — the DOM-absence half of the contract', () => {
  it('renders exactly 10 tbody rows with the shipped labels in order, Royal Flush last', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    const rows = screen.getByTestId('category-table').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(10);
    const rowLabels = Array.from(rows).map((row) => row.querySelector('th')?.textContent);
    expect(rowLabels).toEqual([...CATEGORY_LABELS]);
    expect(rowLabels[rowLabels.length - 1]).toBe('Royal Flush');
  });

  it('renders zero trace of the extended row: row testid and both index-10 cells are absent', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    expect(screen.queryByTestId('category-five-of-a-kind')).toBeNull();
    expect(screen.queryByTestId('category-pct-10')).toBeNull();
    expect(screen.queryByTestId('category-locked-10')).toBeNull();
  });

  it('renders category-pct-0..9 and category-locked-0..9 exactly as shipped, with no row-level testid anywhere', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`category-pct-${index}`)).toBeInTheDocument();
      expect(screen.getByTestId(`category-locked-${index}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');
    // No shipped <tr> may gain any data-testid attribute — the 1-deck DOM is byte-identical.
    const rows = screen.getByTestId('category-table').querySelectorAll('tbody tr');
    for (const row of rows) {
      expect(row.hasAttribute('data-testid')).toBe(false);
    }
  });

  it('renders the shipped caption and subtitle verbatim', () => {
    render(<OddsTable />);
    const caption = screen.getByTestId('category-table').querySelector('caption');
    expect(caption?.textContent).toBe(
      'Final hand by the riverEach row is the hand you end up with — the rows are exclusive and add up to 100%.',
    );
  });

  it('puts the tick on the shipped index and no locked cell above index 9 can exist', () => {
    useGameStore.setState({ runout: CLEAN_RUNOUT, street: 'flop', deckCount: 1 });
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    // One Pair on the flop: the tick lands on the shipped index-1 cell.
    expect(screen.getByTestId('category-locked-1').textContent).toContain('✓');
    // Structural absence: there is no locked cell above index 9 at one deck.
    expect(screen.queryByTestId('category-locked-10')).toBeNull();
  });
});

describe('OddsTable at deckCount 2 — the presence half of the contract', () => {
  it('renders exactly 11 tbody rows with Royal Flush then Five of a Kind as the last two', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    const rows = screen.getByTestId('category-table').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(11);
    const rowLabels = Array.from(rows).map((row) => row.querySelector('th')?.textContent);
    expect(rowLabels[9]).toBe('Royal Flush');
    expect(rowLabels[10]).toBe('Five of a Kind');
  });

  it('the last row carries the row testid and index-10 cells; rows 0-9 gain no row-level testid', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    const fiveOfAKindRow = screen.getByTestId('category-five-of-a-kind');
    const rows = Array.from(screen.getByTestId('category-table').querySelectorAll('tbody tr'));
    expect(rows[rows.length - 1]).toBe(fiveOfAKindRow);
    expect(fiveOfAKindRow.querySelector('th')?.textContent).toBe('Five of a Kind');
    expect(fiveOfAKindRow.contains(screen.getByTestId('category-pct-10'))).toBe(true);
    expect(fiveOfAKindRow.contains(screen.getByTestId('category-locked-10'))).toBe(true);
    for (const row of rows.slice(0, 10)) {
      expect(row.hasAttribute('data-testid')).toBe(false);
    }
  });

  it('renders the shipped caption and subtitle verbatim — no deck-count suffix (A10)', () => {
    useGameStore.setState({ deckCount: 2 });
    render(<OddsTable />);
    const caption = screen.getByTestId('category-table').querySelector('caption');
    expect(caption?.textContent).toBe(
      'Final hand by the riverEach row is the hand you end up with — the rows are exclusive and add up to 100%.',
    );
  });

  it('renders category-pct-10 through the same formatPct path as every other cell with a settled 11-entry snapshot', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    expect(screen.getByTestId('category-pct-10').textContent).toBe('1.0%');
    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');
    // The rows are exclusive and add up to 100% — index 10 participates in the same total.
    const totalPct = Array.from({ length: 11 }, (_, i) => {
      const text = screen.getByTestId(`category-pct-${i}`).textContent ?? '0%';
      return Number.parseFloat(text.replace('%', ''));
    }).reduce((a, b) => a + b, 0);
    expect(Math.abs(totalPct - 100)).toBeLessThan(0.5);
  });

  it('renders the same em dash as every other cell at zero trials', () => {
    useGameStore.setState({ deckCount: 2 });
    render(<OddsTable />);

    expect(screen.getByTestId('category-pct-10').textContent).toBe('—');
    expect(screen.getByTestId('category-pct-0').textContent).toBe('—');
  });

  it('renders the em dash in every cell and no tick anywhere while pendingAnimationCount > 0', () => {
    useGameStore.setState({ runout: FIVE_OAK_RUNOUT, street: 'river', deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<OddsTable />);

    expect(screen.getByTestId('category-pct-10').textContent).toBe('—');
    // The shipped pending short-circuit is unchanged: no tick renders anywhere, even with a
    // five-of-a-kind visible.
    for (let index = 0; index <= 10; index += 1) {
      expect(screen.getByTestId(`category-locked-${index}`).textContent).toBe('');
    }
  });

  it('renders category-pct-10 as a zero count with a 10-entry snapshot still in the store (pre-first-2-deck-snapshot moment)', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    // The shipped `categoryCounts[index] ?? 0` read covers the missing index 10 — the cell
    // renders as a zero count rather than crashing.
    expect(screen.getByTestId('category-pct-10').textContent).toBe('0.0%');
  });

  it('puts the tick on category-locked-10 for a visible five-of-a-kind, and on no other locked cell', () => {
    useGameStore.setState({ runout: FIVE_OAK_RUNOUT, street: 'river', deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    const lockedCell = screen.getByTestId('category-locked-10');
    expect(lockedCell.textContent).toContain('✓');
    expect(lockedCell.textContent).toContain('You already have this');
    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`category-locked-${index}`).textContent).toBe('');
    }
  });
});
