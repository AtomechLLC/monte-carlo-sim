import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlipCard } from './FlipCard';
import { useUiStore } from '../state/uiStore';

// This suite forces useReducedMotion() to false so the gate-registration codepath
// (`enabled && faceUp`) is actually exercised — src/test/setup.ts's matchMedia polyfill forces
// reduced motion ON globally (jsdom has no compositor), which is correct for every OTHER test in
// this project but would make `enabled` permanently false here, meaning the gate would never
// register regardless of FlipCard's own logic. Real-motion timing (whether the 400ms rotateY
// actually completes) is NOT asserted here — jsdom has no compositor, so waiting on a real
// animation frame would be flaky; the completion release path is instead proven via the
// hook-level contract useAnimationGate.test.ts already exercises (register-then-release,
// idempotent, unmount-safe) — see the "does not strand the gate" test below, which uses unmount
// as its release trigger rather than waiting on Motion's onAnimationComplete callback.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('FlipCard — leak guard (T-03-12)', () => {
  it('faceUp={false} renders only a card back; no face-asset img exists anywhere in its subtree', () => {
    const { container } = render(<FlipCard faceUp={false} flipKey="opp-0-slot-0-1" />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/cards/back.svg');
    for (const img of Array.from(images)) {
      expect(img.getAttribute('src')).not.toMatch(/\/cards\/[CDHS]-/);
    }
  });

  it('faceUp with a card renders both the back and the face, the face marked decorative (alt="")', () => {
    const { container } = render(<FlipCard faceUp card="As" flipKey="opp-0-slot-0-1" />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    const faceImg = Array.from(images).find((img) => img.getAttribute('src') !== '/cards/back.svg');
    expect(faceImg).toBeDefined();
    expect(faceImg?.getAttribute('alt')).toBe('');
  });
});

describe('FlipCard — gate participation (TBL-04)', () => {
  beforeEach(() => {
    useUiStore.getState().resetAnimations();
  });

  it('a hidden-to-face-up transition raises pendingAnimationCount by exactly 1', () => {
    const { rerender } = render(<FlipCard faceUp={false} flipKey="opp-0-slot-0-1" />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    rerender(<FlipCard faceUp card="As" flipKey="opp-0-slot-0-1" />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('mounting hidden never registers with the gate', () => {
    render(<FlipCard faceUp={false} flipKey="opp-0-slot-0-1" />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('unmounting mid-flip releases the registration — an interrupted flip cannot strand the gate', () => {
    const { rerender, unmount } = render(<FlipCard faceUp={false} flipKey="opp-0-slot-0-1" />);
    rerender(<FlipCard faceUp card="As" flipKey="opp-0-slot-0-1" />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    unmount();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});

describe('FlipCard — no layout shift on reveal', () => {
  it('the flip container box carries the card-slot aspect-ratio contract regardless of faceUp', () => {
    const { container: hiddenContainer } = render(<FlipCard faceUp={false} flipKey="k1" />);
    const { container: revealedContainer } = render(<FlipCard faceUp card="As" flipKey="k1" />);
    const hiddenBox = hiddenContainer.querySelector('.flip-card');
    const revealedBox = revealedContainer.querySelector('.flip-card');
    expect(hiddenBox).not.toBeNull();
    expect(revealedBox).not.toBeNull();
    expect(hiddenBox?.className).toBe(revealedBox?.className);
  });
});
