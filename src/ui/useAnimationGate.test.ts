import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimationGate, useExitGate } from './useAnimationGate';
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

describe('useExitGate — container-level gate registration for an AnimatePresence exit group', () => {
  beforeEach(() => {
    useUiStore.getState().resetAnimations();
  });

  it('a count drop (enabled: true) registers one animation; the returned callback releases it once; a second call is a no-op', () => {
    const { result, rerender } = renderHook(({ count }: { count: number }) => useExitGate(count, true), {
      initialProps: { count: 3 },
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    rerender({ count: 0 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    act(() => {
      result.current();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    act(() => {
      result.current();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('a count rise (growing) never registers', () => {
    const { rerender } = renderHook(({ count }: { count: number }) => useExitGate(count, true), {
      initialProps: { count: 0 },
    });

    rerender({ count: 3 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('unmounting while a registration is pending releases it — an interrupted exit cannot strand the gate', () => {
    const { rerender, unmount } = renderHook(({ count }: { count: number }) => useExitGate(count, true), {
      initialProps: { count: 3 },
    });

    rerender({ count: 0 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    unmount();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('enabled: false never registers, for any count transition', () => {
    const { rerender, unmount } = renderHook(({ count }: { count: number }) => useExitGate(count, false), {
      initialProps: { count: 3 },
    });

    rerender({ count: 0 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    rerender({ count: 3 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    unmount();
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('overlapping drops while a hold is pending arm only ONE unit — a single onExitComplete release returns the count to 0 (CR-02a)', () => {
    const { result, rerender } = renderHook(({ count }: { count: number }) => useExitGate(count, true), {
      initialProps: { count: 5 },
    });

    // River -> turn: arms one hold for community-4's exit.
    rerender({ count: 4 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    // Turn -> flop inside the 150ms exit window: community-3 joins the SAME AnimatePresence
    // exiting set, whose user-level onExitComplete fires exactly once when the whole set
    // drains — a second armed unit here would never have a second release.
    rerender({ count: 3 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    // The single onExitComplete for the drained set fully reopens the gate.
    act(() => {
      result.current();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('a count rise while a hold is pending releases it — an exit superseded by re-entry never fires onExitComplete (CR-03)', () => {
    const { rerender } = renderHook(({ count }: { count: number }) => useExitGate(count, true), {
      initialProps: { count: 5 },
    });

    // River -> turn: arms one hold for community-4's exit.
    rerender({ count: 4 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    // Advance back to river inside the exit window: AnimatePresence deletes the re-entering
    // child from its exit-tracking map without invoking the user-level onExitComplete — the
    // release callback is never invoked, so the hook itself must release on the rise.
    rerender({ count: 5 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // The lifecycle stays closed after the release: a fresh drop arms a fresh hold.
    rerender({ count: 4 });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('a resetKey change while a hold is pending releases it — a re-deal mid-exit cannot strand the gate (CR-02b)', () => {
    const { rerender } = renderHook(
      ({ count, resetKey }: { count: number; resetKey: string }) => useExitGate(count, true, resetKey),
      { initialProps: { count: 5, resetKey: 'deal-1' } },
    );

    // River -> turn: arms one hold for community-4's exit.
    rerender({ count: 4, resetKey: 'deal-1' });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    // Deal clicked during the exit: the re-keyed AnimatePresence discards the old exiting
    // children, so their onExitComplete can never fire — the reset branch must release the
    // pending hold itself, not just re-baseline.
    rerender({ count: 0, resetKey: 'deal-2' });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('a count drop accompanied by a reset-key change (simulating a re-deal) does not register a hold', () => {
    const { rerender } = renderHook(
      ({ count, resetKey }: { count: number; resetKey: string }) => useExitGate(count, true, resetKey),
      { initialProps: { count: 3, resetKey: 'deal-1' } },
    );
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Simulates a re-deal: count drops to 0 (new hand has no board yet at this street) AND the
    // reset key changes in the same render — this must re-baseline, not register a hold.
    rerender({ count: 0, resetKey: 'deal-2' });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // A genuine subsequent drop under the NEW baseline still registers normally.
    rerender({ count: 3, resetKey: 'deal-2' });
    rerender({ count: 0, resetKey: 'deal-2' });
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });
});
