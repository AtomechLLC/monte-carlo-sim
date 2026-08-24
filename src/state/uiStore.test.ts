import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore — pendingAnimationCount gate (D-11)', () => {
  beforeEach(() => {
    useUiStore.getState().resetAnimations();
  });

  it('starts with pendingAnimationCount === 0', () => {
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('beginAnimation() three times then endAnimation() twice leaves the count at 1', () => {
    useUiStore.getState().beginAnimation();
    useUiStore.getState().beginAnimation();
    useUiStore.getState().beginAnimation();
    useUiStore.getState().endAnimation();
    useUiStore.getState().endAnimation();
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('endAnimation() called at 0 leaves the count at 0 — never negative', () => {
    useUiStore.getState().endAnimation();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('resetAnimations() sets the count to 0 from any value', () => {
    useUiStore.getState().beginAnimation();
    useUiStore.getState().beginAnimation();
    expect(useUiStore.getState().pendingAnimationCount).toBe(2);
    useUiStore.getState().resetAnimations();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});
