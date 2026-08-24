import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useUiStore } from '../state/uiStore';

/**
 * Registers one animation with the gate.
 *
 * @param animationKey  changing this releases the previous registration and starts a new one
 * @param enabled       false (e.g. reduced motion) means never register at all
 */
export function useAnimationGate(
  animationKey: string | number,
  enabled: boolean,
): { pending: boolean; complete: () => void } {
  // Idempotency guard so `complete()` (and the unmount cleanup) can never double-release the
  // same registration — a store write happens only on registration and completion, never on an
  // animation frame (03-RESEARCH Anti-Patterns).
  const pendingRef = useRef(false);

  // `pending` is reflected via useSyncExternalStore, NOT useState, so registering/completing can
  // notify from inside the effect body without calling a React setState there — the
  // `react-hooks/set-state-in-effect` rule (this project's locked eslint config) flags exactly
  // that pattern as a cascading-render risk. useSyncExternalStore is React's own documented
  // mechanism for reflecting an external system's state in render (this hook's entire job),
  // sidestepping the concern the lint rule targets: React reads the external ref directly rather
  // than queuing a state update from inside the effect.
  const listenersRef = useRef(new Set<() => void>());
  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  const getSnapshot = useCallback(() => pendingRef.current, []);
  const notify = useCallback(() => {
    for (const listener of listenersRef.current) listener();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    useUiStore.getState().beginAnimation();
    pendingRef.current = true;
    notify();

    return () => {
      // An interrupted or unmounted card can never strand the gate (D-10): release here if
      // `complete()` was never called for this registration.
      if (pendingRef.current) {
        pendingRef.current = false;
        useUiStore.getState().endAnimation();
        notify();
      }
    };
  }, [animationKey, enabled, notify]);

  const complete = useCallback(() => {
    if (pendingRef.current) {
      pendingRef.current = false;
      useUiStore.getState().endAnimation();
      notify();
    }
  }, [notify]);

  const pending = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { pending: enabled && pending, complete };
}
