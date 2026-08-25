import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OddsTable } from './OddsTable';
import { OddsPanel } from './OddsPanel';
import { useOddsStore } from '../state/oddsStore';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';

/**
 * The Share column: probability bars, and convergence made visible.
 *
 * WHAT THIS FILE PROTECTS, in one line each:
 *   - the bars are relative to the LARGEST category, so the column reads as a shape;
 *   - the leading category — and only it — spends the accent role;
 *   - the bars obey the animation gate exactly as the digits do (TBL-04), showing EMPTY
 *     rather than a stale shape while cards are in flight;
 *   - the digits themselves are never animated — the ONLY moving thing is a CSS width;
 *   - the bars are decorative and invisible to assistive tech.
 *
 * WIDTHS ARE READ NUMERICALLY, not as strings: jsdom's CSSOM normalises `100.0%` to `100%`
 * and `5.0%` to `5%` when a style is round-tripped, so a string assertion here would be
 * pinning cssstyle's serialiser rather than the component. `shareWidth`'s exact output IS
 * asserted as a string — in categoryShares.test.ts, where no CSSOM sits in between.
 *
 * WHAT IS NOT HERE: the CSS-level and absence-shaped invariants (the width transition, the
 * reduced-motion opt-out, "OddsTable owns no timer that could tween a digit"). jsdom applies
 * no stylesheet and cannot prove an absence, so those live in ui/shareBars.guard.test.ts —
 * a node-environment source-shape guard, matching this repo's existing `*.guard.test.ts`
 * convention.
 */

function widthOf(testid: string): number {
  const element = screen.getByTestId(testid) as HTMLElement;
  return Number.parseFloat(element.style.width);
}

/** The distribution the frozen v1 suites stream — 1000 trials, max 500 at index 0. */
const SETTLED_10 = {
  categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1],
  outcomes: { win: 600, tie: 100, lose: 300 },
  trialsCompleted: 1000,
  done: true,
};

/** Eleven entries, for the 2-deck table. Index 10 is Five of a Kind. */
const SETTLED_11 = {
  categoryCounts: [500, 200, 100, 80, 40, 30, 20, 10, 5, 5, 10],
  outcomes: { win: 600, tie: 100, lose: 300 },
  trialsCompleted: 1000,
  done: true,
};

beforeEach(() => {
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, deckCount: 1 });
  useUiStore.setState({ pendingAnimationCount: 0 });
});

describe('Share bars — the shape of the distribution', () => {
  it('draws every bar as its share of the LARGEST category, not of 100%', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    // 500/500, 300/500, 100/500, ... — the top category is always a full bar.
    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);
    expect(widthOf('category-bar-1')).toBeCloseTo(60, 5);
    expect(widthOf('category-bar-2')).toBeCloseTo(20, 5);
    expect(widthOf('category-bar-3')).toBeCloseTo(10, 5);
    expect(widthOf('category-bar-7')).toBeCloseTo(0.6, 5);
  });

  it('keeps bar order monotone with the counts — a bigger count is never a shorter bar', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    const widths = Array.from({ length: 10 }, (_, index) => widthOf(`category-bar-${index}`));
    for (let index = 1; index < widths.length; index += 1) {
      expect(widths[index]).toBeLessThanOrEqual(widths[index - 1]);
    }
  });

  it('gives every visible row a bar', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`category-bar-${index}`)).toBeInTheDocument();
    }
  });

  it('rescales when the distribution changes: the same count draws a shorter bar under a bigger leader', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);
    expect(widthOf('category-bar-1')).toBeCloseTo(60, 5);

    // Index 0 doubles; index 1's own count is untouched, but its SHARE of the max halves.
    act(() => {
      useOddsStore.setState({ ...SETTLED_10, categoryCounts: [1000, 300, 100, 50, 25, 15, 5, 3, 1, 1], trialsCompleted: 1500 });
    });

    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);
    expect(widthOf('category-bar-1')).toBeCloseTo(30, 5);
  });

  it('renders zero-width bars for an all-zero histogram rather than NaN or a full row', () => {
    useOddsStore.setState({ ...SETTLED_10, categoryCounts: new Array(10).fill(0) as number[] });
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(widthOf(`category-bar-${index}`)).toBe(0);
    }
  });
});

describe('Share bars — the leading category is the one that spends the accent', () => {
  it('marks only the largest category as leading', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');
    for (let index = 1; index < 10; index += 1) {
      expect(screen.getByTestId(`category-bar-${index}`)).not.toHaveClass('category-bar__fill--leading');
    }
  });

  it('every bar keeps the base fill class, leading or not', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`category-bar-${index}`)).toHaveClass('category-bar__fill');
    }
  });

  it('moves the emphasis when the leader changes — it is not pinned to index 0', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);
    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');

    act(() => {
      useOddsStore.setState({ ...SETTLED_10, categoryCounts: [300, 500, 100, 50, 25, 15, 5, 3, 1, 1] });
    });

    expect(screen.getByTestId('category-bar-1')).toHaveClass('category-bar__fill--leading');
    expect(screen.getByTestId('category-bar-0')).not.toHaveClass('category-bar__fill--leading');
    // The former leader keeps a proportional bar rather than being zeroed out.
    expect(widthOf('category-bar-0')).toBeCloseTo(60, 5);
  });

  it('emphasises both halves of an exact tie instead of picking one arbitrarily', () => {
    useOddsStore.setState({ ...SETTLED_10, categoryCounts: [400, 400, 100, 50, 25, 15, 5, 3, 1, 1] });
    render(<OddsTable />);

    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');
    expect(screen.getByTestId('category-bar-1')).toHaveClass('category-bar__fill--leading');
    expect(screen.getByTestId('category-bar-2')).not.toHaveClass('category-bar__fill--leading');
  });
});

describe('Share bars — the animation gate (TBL-04): odds visuals never move while cards fly', () => {
  it('empties every bar while pendingAnimationCount > 0, even with a settled snapshot in the store', () => {
    useOddsStore.setState(SETTLED_10);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(widthOf(`category-bar-${index}`)).toBe(0);
      expect(screen.getByTestId(`category-bar-${index}`)).not.toHaveClass('category-bar__fill--leading');
    }
  });

  it('drops a LIVE shape to empty the instant the gate closes — no stale bar behind the em dashes', () => {
    // This is the failure mode the gate exists to prevent: bars that were showing the
    // previous street's distribution while the digits beside them read "—".
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);
    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);

    act(() => {
      useUiStore.getState().beginAnimation();
    });

    expect(screen.getByTestId('category-pct-0').textContent).toBe('—');
    expect(widthOf('category-bar-0')).toBe(0);

    act(() => {
      useUiStore.getState().endAnimation();
    });

    // ...and the shape comes straight back when the gate opens.
    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');
    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);
  });

  it('THE GATE INVARIANT, in the DOM: every em-dashed percentage has an empty bar beside it', () => {
    useOddsStore.setState(SETTLED_10);
    useUiStore.setState({ pendingAnimationCount: 2 });
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      if (screen.getByTestId(`category-pct-${index}`).textContent === '—') {
        expect(widthOf(`category-bar-${index}`)).toBe(0);
      }
    }
  });

  it('NEGATIVE CONTROL: the gate assertions above are not vacuous', () => {
    // Same store contents, gate OPEN: the bars are non-empty and one leads. Without this,
    // every "bars are empty while pending" assertion would also pass against a component
    // that rendered zero-width bars unconditionally.
    useOddsStore.setState(SETTLED_10);
    useUiStore.setState({ pendingAnimationCount: 0 });
    render(<OddsTable />);

    expect(screen.getByTestId('category-pct-0').textContent).not.toBe('—');
    expect(widthOf('category-bar-0')).toBeGreaterThan(0);
    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');
  });

  it('renders empty bars at zero trials, matching the em dash the digits show', () => {
    render(<OddsTable />);

    expect(screen.getByTestId('category-pct-0').textContent).toBe('—');
    expect(widthOf('category-bar-0')).toBe(0);
  });
});

describe('Share bars — decorative only', () => {
  it('hides the whole widget from assistive tech', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    const fill = screen.getByTestId('category-bar-0');
    const track = fill.parentElement;
    expect(track).toHaveClass('category-bar');
    expect(track).toHaveAttribute('aria-hidden', 'true');
    // The fill inherits the hidden subtree — nothing under the track is exposed.
    expect(fill.closest('[aria-hidden="true"]')).toBe(track);
  });

  it('hides every row s bar, not just the first', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    for (let index = 0; index < 10; index += 1) {
      expect(screen.getByTestId(`category-bar-${index}`).closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('leaves the percentage cell as the sole carrier of the value', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    // The bar cell is textually empty; the neighbouring percentage cell holds the number.
    expect(screen.getByTestId('category-bar-0').closest('td')?.textContent).toBe('');
    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');
    expect(screen.getByTestId('category-pct-0').closest('[aria-hidden="true"]')).toBeNull();
  });
});

describe('Share bars at two decks — the eleventh row behaves identically', () => {
  it('renders a bar for Five of a Kind, scaled against the same max', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    expect(screen.getByTestId('category-bar-10')).toBeInTheDocument();
    expect(widthOf('category-bar-10')).toBeCloseTo(2, 5); // 10/500
    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);
    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');
    expect(screen.getByTestId('category-bar-10')).not.toHaveClass('category-bar__fill--leading');
  });

  it('lets the eleventh row LEAD when it is the largest category', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState({ ...SETTLED_11, categoryCounts: [100, 50, 40, 30, 20, 10, 5, 3, 2, 2, 738] });
    render(<OddsTable />);

    expect(screen.getByTestId('category-bar-10')).toHaveClass('category-bar__fill--leading');
    expect(widthOf('category-bar-10')).toBeCloseTo(100, 5);
    expect(screen.getByTestId('category-bar-0')).not.toHaveClass('category-bar__fill--leading');
  });

  it('renders zero trace of the eleventh bar at one deck', () => {
    useOddsStore.setState(SETTLED_11);
    render(<OddsTable />);

    expect(screen.queryByTestId('category-bar-10')).toBeNull();
  });

  it('an invisible eleventh count cannot set the scale of the ten-row table', () => {
    // A stale 11-entry snapshot with a huge index 10 while the table has dropped to ten rows:
    // the ten visible bars must still be scaled against the largest VISIBLE category.
    useOddsStore.setState({ ...SETTLED_10, categoryCounts: [500, 300, 100, 50, 25, 15, 5, 3, 1, 1, 99_000] });
    render(<OddsTable />);

    expect(widthOf('category-bar-0')).toBeCloseTo(100, 5);
    expect(screen.getByTestId('category-bar-0')).toHaveClass('category-bar__fill--leading');
  });

  it('renders a zero-width eleventh bar when a 10-entry snapshot is still in the store', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);

    expect(widthOf('category-bar-10')).toBe(0);
    expect(screen.getByTestId('category-pct-10').textContent).toBe('0.0%');
  });

  it('empties the eleventh bar under the gate like every other', () => {
    useGameStore.setState({ deckCount: 2 });
    useOddsStore.setState(SETTLED_11);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<OddsTable />);

    expect(widthOf('category-bar-10')).toBe(0);
  });
});

describe('Convergence is a CSS width, never a moving digit', () => {
  it('shows the exact formatPct output on every streamed snapshot, with no intermediate value', () => {
    // Two snapshots in a row: each render lands on the FINAL digits for that snapshot. A
    // count-up/tween would have to pass through intermediate text, and would make the frozen
    // v1 suites (which assert '50.0%' exactly) flaky.
    useOddsStore.setState({ ...SETTLED_10, categoryCounts: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100], trialsCompleted: 1000 });
    render(<OddsTable />);
    expect(screen.getByTestId('category-pct-0').textContent).toBe('10.0%');

    act(() => {
      useOddsStore.setState(SETTLED_10);
    });
    expect(screen.getByTestId('category-pct-0').textContent).toBe('50.0%');
  });

  it('re-renders the SAME digits when only the gate flips — the text is a pure function of the snapshot', () => {
    // Reinforces the point from the DOM side: nothing in this component carries a value across
    // renders. The transition-driven convergence story adds no state to the digits.
    useOddsStore.setState(SETTLED_10);
    render(<OddsTable />);
    const before = screen.getByTestId('category-pct-3').textContent;

    act(() => {
      useUiStore.getState().beginAnimation();
    });
    act(() => {
      useUiStore.getState().endAnimation();
    });

    expect(screen.getByTestId('category-pct-3').textContent).toBe(before);
  });
});

describe('Settled state — a quiet cue that the run is finished', () => {
  it('marks the panel settled once a done snapshot has landed with the gate clear', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsPanel />);

    expect(screen.getByTestId('odds-panel')).toHaveClass('odds-panel--settled');
  });

  it('does not mark a still-converging run as settled', () => {
    useOddsStore.setState({ ...SETTLED_10, done: false });
    render(<OddsPanel />);

    expect(screen.getByTestId('odds-panel')).not.toHaveClass('odds-panel--settled');
  });

  it('does not claim "final" while the animation gate masks every value to an em dash', () => {
    useOddsStore.setState(SETTLED_10);
    useUiStore.setState({ pendingAnimationCount: 1 });
    render(<OddsPanel />);

    expect(screen.getByTestId('trial-counter').textContent).toBe('—');
    expect(screen.getByTestId('odds-panel')).not.toHaveClass('odds-panel--settled');
    expect(screen.getByTestId('odds-panel')).toHaveClass('odds-panel--pending');
  });

  it('does not mark an empty (zero-trial) panel as settled', () => {
    useOddsStore.setState({ ...SETTLED_10, categoryCounts: new Array(10).fill(0) as number[], outcomes: { win: 0, tie: 0, lose: 0 }, trialsCompleted: 0 });
    render(<OddsPanel />);

    expect(screen.getByTestId('odds-panel')).not.toHaveClass('odds-panel--settled');
  });

  it('appears at the end of a run and disappears when the next one starts', () => {
    useOddsStore.setState({ ...SETTLED_10, trialsCompleted: 400, done: false });
    render(<OddsPanel />);
    expect(screen.getByTestId('odds-panel')).not.toHaveClass('odds-panel--settled');

    act(() => {
      useOddsStore.setState(SETTLED_10);
    });
    expect(screen.getByTestId('odds-panel')).toHaveClass('odds-panel--settled');

    // A new street/reveal resets the live display fields — done goes back to false.
    act(() => {
      useOddsStore.getState().reset();
    });
    expect(screen.getByTestId('odds-panel')).not.toHaveClass('odds-panel--settled');
  });

  it('keeps the shipped pending class untouched and adds no attribute of its own', () => {
    useOddsStore.setState(SETTLED_10);
    render(<OddsPanel />);
    const panel = screen.getByTestId('odds-panel');

    expect(panel).toHaveAttribute('aria-busy', 'false');
    expect(panel).not.toHaveClass('odds-panel--pending');
  });

  it('carries the cue on the panel, leaving the trial counter markup untouched', () => {
    // The affordance is entirely a CSS consequence of the panel class (see
    // ui/shareBars.guard.test.ts for the rule itself) — WinTieLossDisplay is not edited and
    // the trial counter gains no wrapper, class or attribute of its own.
    useOddsStore.setState(SETTLED_10);
    render(<OddsPanel />);
    const counter = screen.getByTestId('trial-counter');

    expect(counter.tagName).toBe('DD');
    expect(counter.className).toBe('odds-stat__value');
    expect(counter.textContent).toBe('1,000');
    expect(counter.closest('.odds-panel--settled')).not.toBeNull();
  });
});
