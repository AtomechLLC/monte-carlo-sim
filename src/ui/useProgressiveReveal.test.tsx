import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { REVEAL_STEP_MS, useProgressiveReveal } from './useProgressiveReveal';
import { PredictionGauge } from './PredictionGauge';
import { useRouletteStore } from '../state/rouletteStore';
import { SPINS_PER_BATCH } from '../engine/roulette';

// The hook is exercised against the real roulette store — its intended consumer — in both
// motion preferences. Motion's `useReducedMotion` reads the media query ONCE per module and
// caches the answer, and this harness forces `prefers-reduced-motion: reduce` globally
// (src/test/setup.ts), so swapping `window.matchMedia` per test would change nothing. The
// hook is therefore mocked at the module boundary, with the real module otherwise intact.
const motionPreference = vi.hoisted(() => ({ reduce: true }));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => motionPreference.reduce };
});

function Harness() {
  const revealed = useRouletteStore((state) => state.revealed);
  const total = useRouletteStore((state) => state.spins.length);
  const revealNext = useRouletteStore((state) => state.revealNext);
  const revealAll = useRouletteStore((state) => state.revealAll);
  useProgressiveReveal(revealed, total, revealNext, revealAll);
  return <output data-testid="revealed">{revealed}</output>;
}

function resetStore() {
  useRouletteStore.setState({ wheel: 'european', color: null, number: null, spins: [], revealed: 0 });
}

describe('useProgressiveReveal — reduced motion lands the whole batch at once', () => {
  beforeEach(() => {
    resetStore();
    motionPreference.reduce = true;
  });

  it('reveals every spin in the same effect flush as the batch', () => {
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('revealed').textContent).toBe('0');

    act(() => useRouletteStore.getState().spin());

    expect(getByTestId('revealed').textContent).toBe(String(SPINS_PER_BATCH));
    expect(useRouletteStore.getState().revealed).toBe(SPINS_PER_BATCH);
  });

  it('does nothing while there is nothing to reveal', () => {
    render(<Harness />);
    expect(useRouletteStore.getState().revealed).toBe(0);
  });
});

describe('useProgressiveReveal — full motion walks the cursor one step per tick', () => {
  beforeEach(() => {
    resetStore();
    motionPreference.reduce = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    motionPreference.reduce = true;
  });

  /**
   * Advances `steps` ticks, ONE per `act`. The hook is a timeout chain — each step re-runs the
   * effect, which arms the next timer — and a single `act` flushes exactly one effect pass, so
   * advancing the clock by ten steps in one call would fire one timer and leave nine unarmed.
   * Stepping per act is the honest model of what the browser does between frames.
   */
  function tick(steps: number) {
    for (let i = 0; i < steps; i++) {
      act(() => {
        vi.advanceTimersByTime(REVEAL_STEP_MS);
      });
    }
  }

  it('after one batch: nothing revealed yet, then one more spin per REVEAL_STEP_MS until the batch is in', () => {
    const { getByTestId } = render(<Harness />);
    act(() => useRouletteStore.getState().spin());
    expect(getByTestId('revealed').textContent).toBe('0');

    tick(1);
    expect(getByTestId('revealed').textContent).toBe('1');

    tick(9);
    expect(getByTestId('revealed').textContent).toBe('10');

    tick(SPINS_PER_BATCH);
    expect(getByTestId('revealed').textContent).toBe(String(SPINS_PER_BATCH));
    expect(vi.getTimerCount(), 'the chain stops once the batch is fully revealed').toBe(0);
  });

  it('a step short of REVEAL_STEP_MS reveals nothing — the cadence is the constant, not "as fast as possible"', () => {
    const { getByTestId } = render(<Harness />);
    act(() => useRouletteStore.getState().spin());
    act(() => {
      vi.advanceTimersByTime(REVEAL_STEP_MS - 1);
    });
    expect(getByTestId('revealed').textContent).toBe('0');
  });

  it('a second batch pressed mid-reveal simply extends the walk', () => {
    render(<Harness />);
    act(() => useRouletteStore.getState().spin());
    tick(30);
    expect(useRouletteStore.getState().revealed).toBe(30);

    act(() => useRouletteStore.getState().spin());
    tick(200);
    expect(useRouletteStore.getState().revealed).toBe(2 * SPINS_PER_BATCH);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmounting mid-batch clears the pending step and leaves the cursor where it was', () => {
    const { unmount } = render(<Harness />);
    act(() => useRouletteStore.getState().spin());
    tick(5);
    expect(useRouletteStore.getState().revealed).toBe(5);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    tick(50);
    expect(useRouletteStore.getState().revealed).toBe(5);
  });
});

describe('PredictionGauge', () => {
  // jsdom's style engine normalises `52.0%` to `52%`, so the geometry is read back numerically.
  const pct = (value: string) => Number.parseFloat(value);

  it('fills to the observed rate and marks the true probability', () => {
    const { getByTestId } = render(
      <PredictionGauge testidPrefix="t" observed={0.52} probability={18 / 37} empty={false} />,
    );
    expect(pct(getByTestId('t-gauge-fill').style.width)).toBeCloseTo(52, 6);
    expect(pct(getByTestId('t-gauge-mark').style.left)).toBeCloseTo(48.6, 6);
  });

  it('keeps the mark but empties the fill before the first trial', () => {
    const { getByTestId, container } = render(
      <PredictionGauge testidPrefix="t" observed={0.9} probability={1 / 37} empty={true} />,
    );
    expect(pct(getByTestId('t-gauge-fill').style.width)).toBe(0);
    expect(pct(getByTestId('t-gauge-mark').style.left)).toBeCloseTo(2.7, 6);
    expect(container.querySelector('.prediction-gauge')).toHaveAttribute('aria-hidden', 'true');
  });
});
