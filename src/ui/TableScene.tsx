import { useEffect } from 'react';
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

  useEffect(() => {
    // Releases the one unit gameStore's action armed (beginAnimation) synchronously when it
    // fired. No cleanup function is needed: React's StrictMode dev-mode mount -> cleanup ->
    // mount double-invoke only simulates at a component's OWN initial mount, when
    // pendingAnimationCount is always still 0 (nothing has been dealt yet) — `endAnimation`'s
    // clamp-at-0 absorbs the extra call harmlessly. A compensating cleanup here would instead
    // introduce a permanent +1 drift on every LATER, real transition (deal/advance/rewind/
    // reveal), since those are single (non-doubled) cleanup-then-setup cycles, not phantom ones.
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
