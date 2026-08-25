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
    expect(headers).toHaveLength(4);
    expect(headers[0].textContent).toBe('Example hand');
    expect(headers[0].querySelector('.visually-hidden')).not.toBeNull();
    expect(headers[1].textContent).toBe('Hand Category');
  });

  it('adds the Five of a Kind illustration only at two decks', () => {
    const { rerender } = render(<OddsTable />);
    expect(screen.queryByTestId('category-example-10')).toBeNull();

    useGameStore.setState({ deckCount: 2 });
    rerender(<OddsTable />);
    expect(screen.getByTestId('category-example-10')).toBeInTheDocument();
  });
});
