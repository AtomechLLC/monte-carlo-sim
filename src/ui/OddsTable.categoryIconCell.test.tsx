import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OddsTable } from './OddsTable';
import { CATEGORY_LABELS } from './categoryLabels';
import { useOddsStore } from '../state/oddsStore';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';

/**
 * PLACEMENT GUARD for the hand-category illustrations.
 *
 * SVG `<text>` contributes to `textContent`. A frozen v1 acceptance suite
 * (`src/App.test.tsx`) asserts that each row's `<th>` textContent equals the category label
 * EXACTLY — so moving the icon inside the row header would spell "A K 9 7 4High Card" and red
 * a file nobody is allowed to edit. These tests fail first, and say why, so that never happens.
 */

beforeEach(() => {
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useGameStore.setState({ deckCount: 1 });
  useUiStore.setState({ pendingAnimationCount: 0 });
});

describe('OddsTable — the example hand never contaminates the row header', () => {
  it('keeps every row <th> textContent exactly equal to its category label', () => {
    render(<OddsTable />);
    const rows = screen.getByTestId('category-table').querySelectorAll('tbody tr');
    const headerText = Array.from(rows).map((row) => row.querySelector('th')?.textContent);
    expect(headerText).toEqual([...CATEGORY_LABELS]);
  });

  it('renders the illustration in its own cell, before the row header', () => {
    render(<OddsTable />);
    const firstRow = screen.getByTestId('category-table').querySelector('tbody tr');
    const firstChild = firstRow?.firstElementChild;

    expect(firstChild?.tagName).toBe('TD');
    expect(firstChild).toHaveClass('category-table__example');
    expect(firstChild?.querySelector('svg')).not.toBeNull();
    // The header itself holds no markup at all — just the label text node.
    expect(firstRow?.querySelector('th')?.querySelector('svg')).toBeNull();
  });

  it('gives every visible row an illustration', () => {
    render(<OddsTable />);
    for (let i = 0; i < CATEGORY_LABELS.length; i += 1) {
      expect(screen.getByTestId(`category-example-${i}`)).toBeInTheDocument();
    }
  });

  it('labels the illustration column for assistive tech without showing a visible heading', () => {
    render(<OddsTable />);
    const headers = screen.getByTestId('category-table').querySelectorAll('thead th');
    // AMENDED (Share column): the census moved 4 -> 5 in the SAME commit that added the
    // column, and the full expected order is now spelled out rather than spot-checked — a
    // bare count is exactly the assertion that would let a future column land in the wrong
    // place silently.
    expect(headers).toHaveLength(5);
    expect(Array.from(headers).map((header) => header.textContent)).toEqual([
      'Example hand',
      'Hand Category',
      'Share',
      'Probability',
      'Locked In',
    ]);
    expect(headers[0].querySelector('.visually-hidden')).not.toBeNull();
    // The illustration column is the only one whose heading is hidden; every other heading,
    // the Share column's included, is really visible.
    for (const header of Array.from(headers).slice(1)) {
      expect(header.querySelector('.visually-hidden')).toBeNull();
    }
  });

  it('adds the Five of a Kind illustration only at two decks', () => {
    const { rerender } = render(<OddsTable />);
    expect(screen.queryByTestId('category-example-10')).toBeNull();

    useGameStore.setState({ deckCount: 2 });
    rerender(<OddsTable />);
    expect(screen.getByTestId('category-example-10')).toBeInTheDocument();
  });
});

/**
 * The Share bar is the SECOND thing to land in these rows that is visual-only, and it is
 * subject to the identical hazard: anything rendered inside the row `<th>` — or anything that
 * contributes text — breaks the frozen v1 assertion that a row header's textContent is
 * exactly its category label. The bar is a bare `<div>` today (no text to leak), so this
 * block pins the two things that would change that: its PLACEMENT (a `<td>` of its own,
 * after the header) and its EMPTINESS (no text content, ever — a label, a "37%", or a
 * `<title>` added later would be caught here).
 *
 * Behavioural coverage of the bars themselves — widths, leader emphasis, the animation gate —
 * lives in OddsTable.shareBars.test.tsx. This file stays what it has always been: the
 * placement guard.
 */
describe('OddsTable — the share bar never contaminates the row header either', () => {
  /** A settled distribution, so the bars are genuinely non-empty while these run. */
  const SETTLED = {
    categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1],
    outcomes: { win: 600, tie: 100, lose: 300 },
    trialsCompleted: 1000,
    done: true,
  };

  it('keeps every row <th> textContent exactly equal to its label with bars on screen', () => {
    useOddsStore.setState(SETTLED);
    render(<OddsTable />);

    const rows = screen.getByTestId('category-table').querySelectorAll('tbody tr');
    const headerText = Array.from(rows).map((row) => row.querySelector('th')?.textContent);
    expect(headerText).toEqual([...CATEGORY_LABELS]);
  });

  it('renders the bar in its own cell, AFTER the row header and BEFORE the percentage', () => {
    useOddsStore.setState(SETTLED);
    render(<OddsTable />);

    const firstRow = screen.getByTestId('category-table').querySelector('tbody tr');
    const cells = Array.from(firstRow?.children ?? []);
    const bar = screen.getByTestId('category-bar-0');
    const barCell = cells.find((cell) => cell.contains(bar));

    expect(barCell?.tagName).toBe('TD');
    expect(barCell).toHaveClass('category-table__share');
    // Positional, not just "somewhere in the row": header, then bar, then percentage.
    expect(cells.indexOf(barCell as Element)).toBe(cells.indexOf(firstRow?.querySelector('th') as Element) + 1);
    expect(cells[cells.indexOf(barCell as Element) + 1]).toBe(screen.getByTestId('category-pct-0'));
    // ...and no part of the bar is inside the header.
    expect(firstRow?.querySelector('th')?.querySelector('.category-bar')).toBeNull();
  });

  it('contributes no text to the row at all — the bar is geometry, never a second label', () => {
    useOddsStore.setState(SETTLED);
    render(<OddsTable />);

    for (let index = 0; index < CATEGORY_LABELS.length; index += 1) {
      const bar = screen.getByTestId(`category-bar-${index}`);
      expect(bar.textContent).toBe('');
      expect(bar.closest('td')?.textContent).toBe('');
    }
  });
});
