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

/**
 * Container-level gate registration for an AnimatePresence exit group (03-04, D-08/D-12).
 *
 * Registers AT MOST ONE animation (a "hold") with the same gate `useAnimationGate` uses
 * whenever `count` drops below its own previously observed value — i.e. children are about to
 * exit — and never when `count` rises or stays the same. Overlapping drops while a hold is
 * already pending do NOT arm a second unit (03-REVIEW CR-02a): they join the same
 * AnimatePresence exiting set, whose user-level `onExitComplete` fires exactly once when the
 * whole set drains. The returned callback is what the caller passes to
 * `<AnimatePresence onExitComplete={...}>`; it releases the registration exactly once, is safe
 * to call more than once (idempotent, same pendingRef guard as `useAnimationGate.complete`), and
 * is also released automatically on unmount if the exit was interrupted before completing
 * (mirrors `useAnimationGate`'s own unmount-safety, D-10).
 *
 * `resetKey` lets the caller distinguish "count dropped because items are leaving" (a rewind,
 * which SHOULD hold the gate for the exit transition) from "count dropped because the whole
 * list was replaced" (a re-deal, which must NOT — UI-SPEC's "Re-deal cancellation" row is an
 * instant unmount, not an exit; removing old-keyed children under AnimatePresence IS an exit by
 * default, so without this a re-deal would regress into playing the rewind-exit transition on
 * the old board). Passing a value that changes exactly when the re-deal happens (`dealNonce`)
 * re-baselines this hook's internal previous-count tracking WITHOUT registering, even if `count`
 * also happens to drop in that same render — so the very next drop is measured against the NEW
 * baseline, not the old one. If a hold is pending when `resetKey` changes, it is RELEASED
 * (03-REVIEW CR-02b): the re-keyed presence tree discards its old exiting children, so their
 * `onExitComplete` can never fire.
 *
 * @param count     current item count (e.g. `visibleBoard.length`)
 * @param enabled   false (e.g. reduced motion) means never register at all
 * @param resetKey  changing this re-baselines `count` tracking without registering a hold
 */
export function useExitGate(count: number, enabled: boolean, resetKey?: string | number): () => void {
  // Idempotency guard, mirroring useAnimationGate's own pendingRef — the returned release
  // callback and the unmount cleanup below can never double-release the same registration.
  const pendingRef = useRef(false);
  const prevCountRef = useRef(count);
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      // A reset (e.g. a re-deal): re-baseline without registering, even if `count` also
      // dropped in this same render — that drop is an instant replacement, not an exit.
      prevResetKeyRef.current = resetKey;
      prevCountRef.current = count;
      // CR-02b (03-REVIEW): if a hold is pending when the reset arrives, the caller's re-keyed
      // presence tree discards the old exiting children, so their onExitComplete can never
      // fire — this release is the hold's only remaining release path. Deliberately not gated
      // on `enabled`: a release must always run if a hold is outstanding.
      if (pendingRef.current) {
        pendingRef.current = false;
        useUiStore.getState().endAnimation();
      }
      return;
    }

    const previous = prevCountRef.current;
    prevCountRef.current = count;

    if (!enabled) return;

    // CR-02a (03-REVIEW): arm AT MOST ONE hold at a time. A second drop while a hold is pending
    // (an overlapping rewind inside the exit window) adds children to the SAME AnimatePresence
    // exiting set, and the installed AnimatePresence fires the user-level onExitComplete exactly
    // ONCE when that whole set drains (framer-motion AnimatePresence/index.mjs —
    // isEveryExitComplete) — a second unit armed here would have no second release.
    if (count < previous && !pendingRef.current) {
      useUiStore.getState().beginAnimation();
      pendingRef.current = true;
    }
  }, [count, enabled, resetKey]);

  useEffect(() => {
    return () => {
      // An interrupted exit (unmounted before onExitComplete fired) can never strand the gate.
      if (pendingRef.current) {
        pendingRef.current = false;
        useUiStore.getState().endAnimation();
      }
    };
  }, []);

  return useCallback(() => {
    if (pendingRef.current) {
      pendingRef.current = false;
      useUiStore.getState().endAnimation();
    }
  }, []);
}
