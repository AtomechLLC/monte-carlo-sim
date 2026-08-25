import { useEffect, useRef, type ReactNode } from 'react';
import { BlackjackDealerArea } from './BlackjackDealerArea';
import { BlackjackPlayerArea } from './BlackjackPlayerArea';
import { BlackjackOutcomeBanner } from './BlackjackOutcomeBanner';
import { CardBack } from './CardBack';
import { useBlackjackStore } from '../state/blackjackStore';
import { useUiStore } from '../state/uiStore';

/**
 * The Blackjack felt composition root (D-13, BJ-02): dealer area top-centre, outcome banner
 * centre, player area bottom-centre, decorative deck stack at the right — all absolutely
 * positioned against `.felt`'s own box (see the Phase 6 block in App.css). Mostly a pure
 * layout shell, but it is also the ONE place that releases the animation gate armed by
 * blackjackStore's actions: BlackjackTable is the common ancestor of every animated blackjack
 * card, and React flushes passive effects child-first, so by the time this effect runs every
 * card that mounted in this commit has already registered with the gate. This is the ONLY
 * store state this component may read.
 *
 * `children` (260825) is the on-felt chrome slot, mirroring TableScene's: the Deal/Hit/Stand
 * cluster now floats at the table's bottom-left, and `.felt` is the positioning ancestor every
 * on-table element anchors against, so it has to be a DOM child of this element. A slot rather
 * than an import, so this pure layout shell still knows nothing about the round's actions —
 * the store-reads rule above is unchanged.
 */
export function BlackjackTable({ children }: { children?: ReactNode }) {
  const roundNonce = useBlackjackStore((state) => state.roundNonce);
  const playerHandLength = useBlackjackStore((state) => state.playerHand.length);
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const revealedHole = useBlackjackStore((state) => state.revealedHole);

  // CR-02 fix (05-REVIEW), applied to blackjack from the first draft (T-06-25): release only
  // when the tracked deps actually CHANGED. The mode fork re-mounts this component with a
  // DEALT round (a holdem -> blackjack switch-back), falsifying any premise that a mount
  // always happens with pendingAnimationCount === 0 — an unconditional endAnimation() here
  // would steal one of the re-mounting cards' freshly-registered units (two in dev, where
  // StrictMode double-invokes this cleanup-less effect), opening the gate while the last
  // cards were still mid-flight. A previous-values ref is StrictMode-safe by construction: a
  // fresh mount initialises the ref from the current values and skips, and both StrictMode
  // invocations observe equal values. No cleanup function, deliberately — a compensating
  // cleanup would introduce a permanent +1 drift on every LATER, real transition
  // (deal/hit/stand/reveal), since those are single (non-doubled) cleanup-then-setup cycles.
  // Tracked-keys invariant: every beginAnimation() call site in blackjackStore changes at
  // least one of these four deps in the same set() tick (deal -> roundNonce; hit -> hand
  // length, plus roundPhase/revealedHole on a bust; stand -> roundPhase/revealedHole/playout;
  // revealHole -> revealedHole), so every armed unit has exactly one release here —
  // cross-referenced by 06-04's scripted arm-count invariant test (blackjackStore.test.ts).
  const prevRef = useRef({ roundNonce, playerHandLength, roundPhase, revealedHole });
  useEffect(() => {
    const prev = prevRef.current;
    if (
      prev.roundNonce === roundNonce &&
      prev.playerHandLength === playerHandLength &&
      prev.roundPhase === roundPhase &&
      prev.revealedHole === revealedHole
    ) {
      return; // mount / StrictMode re-invoke / mode switch-back re-mount: no action armed anything
    }
    prevRef.current = { roundNonce, playerHandLength, roundPhase, revealedHole };
    // Releases the one unit blackjackStore's action armed (beginAnimation) synchronously when
    // it fired alongside the dep change observed above.
    useUiStore.getState().endAnimation();
  }, [roundNonce, playerHandLength, roundPhase, revealedHole]);

  return (
    <div data-testid="blackjack-scene" className="felt">
      <BlackjackDealerArea />
      <BlackjackOutcomeBanner />
      <BlackjackPlayerArea />
      <div data-testid="blackjack-deck-origin" className="deck-origin" aria-hidden="true">
        <CardBack />
        <CardBack />
        <CardBack />
      </div>
      {children}
    </div>
  );
}
