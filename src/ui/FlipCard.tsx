import { useState } from 'react';
import type { Card } from '@poker-apprentice/types';
import { motion, useReducedMotion } from 'motion/react';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';
import { useAnimationGate } from './useAnimationGate';

/** UI-SPEC "Animation Choreography Contract" — Reveal flip: 400ms, easeInOut. */
const FLIP_DURATION_S = 0.4;

interface FlipCardProps {
  /** The face to show once flipped. MUST be undefined while the seat is hidden — passing a
   * card for a hidden seat would put that card in the DOM (leak). */
  card?: Card;
  faceUp: boolean;
  /** Stable identity for gate registration, e.g. `opp-0-slot-1-${dealNonce}`. */
  flipKey: string;
}

/**
 * A 3D `rotateY` reveal: a face-down back that flips over to a face-up card, never mounting the
 * face art until the instant the reveal begins (T-03-12 leak guard — a hidden opponent's hole
 * cards must not exist in the DOM at all, not merely be visually hidden behind CSS). Registers
 * with the TBL-04 animation gate (03-03) for exactly the transition from hidden to face-up; a
 * card that stays hidden its whole lifetime never touches the gate.
 *
 * Structure follows 03-RESEARCH Pattern 3 / Assumption A2 exactly: `perspective` on the OUTER
 * element, `transform-style: preserve-3d` on the ROTATING element, and `backface-visibility:
 * hidden` on BOTH faces — omitting any one of the three collapses the rotation into a flat
 * squash instead of a true 3D flip, the single most common failure of this technique.
 *
 * Both faces are absolutely stacked (see `.flip-card`/`.flip-card-face` in App.css) inside a box
 * whose own width/aspect-ratio come from the card-slot tokens, never from either face's own
 * intrinsic image size — so a reveal never changes the seat's box dimensions (no layout shift).
 */
export function FlipCard({ card, faceUp, flipKey }: FlipCardProps) {
  const reduce = useReducedMotion();
  const enabled = !reduce;
  // WR-02/D-07 fix (05-REVIEW): captured ONCE at mount. Registration is for exactly the
  // hidden -> face-up TRANSITION — a FlipCard that mounts ALREADY face-up (only possible when a
  // mode switch-back re-mounts a revealed seat, or a test seeds a revealed mask before first
  // render; every dealt seat starts face-down because deal() resets revealedMask) has no
  // transition to animate: it renders instantly at rotateY 180 (`initial={false}` below, the
  // "exact table left behind") and must not arm the gate — a registration with no flip left to
  // complete would strand the unit until unmount.
  const [mountedFaceUp] = useState(faceUp);
  // Registers only for the transition into face-up — mounting (hidden OR already face-up) and
  // staying hidden never arm the gate; a hidden-to-face-up transition arms exactly one unit,
  // released by onAnimationComplete below (or on unmount, via useAnimationGate's own
  // unmount-safety net).
  const { complete } = useAnimationGate(flipKey, enabled && faceUp && !mountedFaceUp);

  const transition = enabled ? { duration: FLIP_DURATION_S, ease: 'easeInOut' as const } : { duration: 0 };

  return (
    <span className="flip-card" style={{ perspective: 1000 }}>
      <motion.span
        className="flip-card-inner"
        style={{ transformStyle: 'preserve-3d', position: 'relative', display: 'inline-block' }}
        // Mount directly at the current `animate` pose: a face-down mount starts at rotateY 0
        // exactly as before, and an already-face-up (restore) mount starts at rotateY 180 with
        // no mount-replay of the flip. Later faceUp CHANGES still animate normally.
        initial={false}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={transition}
        onAnimationComplete={complete}
      >
        <span className="flip-card-face flip-card-face--back" style={{ backfaceVisibility: 'hidden' }}>
          <CardBack />
        </span>
        {faceUp && card !== undefined && (
          <span
            className="flip-card-face flip-card-face--front"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <PlayingCard card={card} decorative />
          </span>
        )}
      </motion.span>
    </span>
  );
}
