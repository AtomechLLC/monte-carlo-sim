import { useEffect, useRef } from 'react';
import { HandDisplay } from './HandDisplay';
import { BoardDisplay } from './BoardDisplay';
import { CardBack } from './CardBack';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';

/**
 * The felt oval composition root (TBL-01). Mostly a pure layout shell — `HandDisplay`/
 * `BoardDisplay` remain the single source of truth for street-driven visibility (03-PATTERNS:
 * that per-street card-count logic must not be duplicated here) — but (03-03, D-11) it is also
 * the ONE place that releases the animation gate armed by gameStore's navigation actions:
 * `TableScene` is the common ancestor of every animated card, and React flushes passive effects
 * child-first, so by the time this effect runs every card that mounted in this commit has
 * already registered with the gate. This is the ONLY store state this component may read.
 */
export function TableScene() {
  const dealNonce = useGameStore((state) => state.dealNonce);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);

  // CR-02 fix (05-REVIEW): release only when the navigation deps actually CHANGED. Phase 5's
  // mode fork re-mounts this component with a DEALT hand (blackjack -> holdem switch-back),
  // falsifying the old premise that a mount always happens with pendingAnimationCount === 0 —
  // an unconditional endAnimation() here stole one of the re-mounting cards' freshly-registered
  // units (two in dev, where StrictMode double-invokes this cleanup-less effect), opening the
  // gate while the last cards were still mid-flight. A previous-values ref is StrictMode-safe
  // by construction: a fresh mount initialises the ref from the current values and skips, and
  // both StrictMode invocations observe equal values. No cleanup function, deliberately — a
  // compensating cleanup would introduce a permanent +1 drift on every LATER, real transition
  // (deal/advance/rewind/reveal), since those are single (non-doubled) cleanup-then-setup
  // cycles. Every gameStore action that arms the gate also changes one of these three deps in
  // the same set() tick, so every armed unit still has exactly one release here.
  const prevRef = useRef({ dealNonce, street, revealedMask });
  useEffect(() => {
    const prev = prevRef.current;
    if (prev.dealNonce === dealNonce && prev.street === street && prev.revealedMask === revealedMask) {
      return; // mount / StrictMode re-invoke / mode switch-back re-mount: no action armed anything
    }
    prevRef.current = { dealNonce, street, revealedMask };
    // Releases the one unit gameStore's action armed (beginAnimation) synchronously when it
    // fired alongside the dep change observed above.
    useUiStore.getState().endAnimation();
  }, [dealNonce, street, revealedMask]);

  return (
    <div data-testid="table-scene" className="felt">
      <HandDisplay />
      <BoardDisplay />
      <div data-testid="deck-origin" className="deck-origin" aria-hidden="true">
        <CardBack />
        <CardBack />
        <CardBack />
      </div>
    </div>
  );
}
