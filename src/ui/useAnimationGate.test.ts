import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimationGate } from './useAnimationGate';
import { useUiStore } from '../state/uiStore';

describe('useAnimationGate — registration/completion/unmount-safe gate participation', () => {
  beforeEach(() => {
    useUiStore.getState().resetAnimations();
  });

  it('mounting with enabled: true increments the store count and reports pending: true', () => {
    const { result } = renderHook(() => useAnimationGate('card-1', true));
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
    expect(result.current.pending).toBe(true);
  });

  it('calling complete() decrements the count once and reports pending: false; a second call is a no-op', () => {
    const { result } = renderHook(() => useAnimationGate('card-1', true));

    act(() => {
      result.current.complete();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(result.current.pending).toBe(false);

    act(() => {
      result.current.complete();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('unmounting while still pending decrements the count — an interrupted animation cannot strand the gate', () => {
    const { unmount } = renderHook(() => useAnimationGate('card-1', true));
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    unmount();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('changing animationKey while pending releases the old registration and starts a new one, net count 1', () => {
    const { rerender } = renderHook(({ key }: { key: string }) => useAnimationGate(key, true), {
      initialProps: { key: 'card-1' },
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    rerender({ key: 'card-2' });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('enabled: false never touches the count and always reports pending: false', () => {
    const { result, unmount } = renderHook(() => useAnimationGate('card-1', false));
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(result.current.pending).toBe(false);

    act(() => {
      result.current.complete();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    unmount();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});
