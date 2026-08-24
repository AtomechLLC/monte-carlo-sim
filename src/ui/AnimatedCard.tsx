import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAnimationGate } from './useAnimationGate';

/** UI-SPEC "Animation Choreography Contract" — Deal fly-in: 300ms duration, 80ms stagger. */
const DEAL_DURATION_S = 0.3;
const DEAL_STAGGER_INTERVAL_S = 0.08;
/** UI-SPEC "Animation Choreography Contract" — Rewind exit: 150ms, easeIn. */
const EXIT_DURATION_S = 0.15;

interface AnimatedCardProps {
  /** Changing this unmounts the previous instance and mounts a fresh one — see the `key`/
   * `animationKey` convention in Seat.tsx (keyed by slot + `dealNonce`, never card identity). */
  animationKey: string | number;
  /** Pixel offset back to the deck origin (from `dealOriginOffset`) — this card's `initial`
   * position, so it appears to start on the deck and fly to `{ x: 0, y: 0 }` (its slot). */
  origin: { x: number; y: number };
  /** This card's position (0-7) in the A3 dealer-rotation stagger (from `dealIndex`). */
  dealIndex: number;
  className?: string;
  children: ReactNode;
}

/**
 * Motion wrapper that flies a card from the deck origin to its slot and reports completion to
 * the animation gate (D-11). Renders a `<span>` (not a `<div>`) because opponent hole-card slots
 * live inside a `<button>`, where flow content is invalid.
 *
 * NOTE (03-RESEARCH): Motion's `stagger()` helper returns a `DynamicOption<number>`
 * (`(i, total) => number`), which only typechecks against `transition.delayChildren` (parent
 * variant orchestration), not against a single element's own `transition.delay` (`number`).
 * Since every `AnimatedCard` instance is mounted independently (no shared `staggerChildren`
 * parent), this uses the arithmetic fallback the plan authorizes: `delay: stagger interval *
 * dealIndex`.
 */
export function AnimatedCard({ animationKey, origin, dealIndex, className, children }: AnimatedCardProps) {
  const reduce = useReducedMotion();
  const enabled = !reduce;
  const { pending, complete } = useAnimationGate(animationKey, enabled);

  const transition = enabled
    ? { duration: DEAL_DURATION_S, ease: 'easeOut' as const, delay: DEAL_STAGGER_INTERVAL_S * dealIndex }
    : { duration: 0, delay: 0 };

  // UI-SPEC "Rewind exit": opacity 1 -> 0 + translateY 0 -> 8px, 150ms easeIn — a real exit
  // transition, not an instant unmount. A `TargetAndTransition`'s own `transition` key overrides
  // the shared `transition` prop above for THIS variant only (motion.dev "Customize transition
  // timing on animation"), which is how the 150ms/easeIn exit coexists with the 300ms/easeOut
  // enter on the same element. This `exit` prop only has any effect when a caller wraps this
  // card's parent list in <AnimatePresence> (BoardDisplay, 03-04) — hole-card seats (Seat.tsx)
  // render AnimatedCard with no AnimatePresence ancestor, so Motion ignores this prop there and
  // their unmount behaviour is unchanged from 03-03 (instant, no exit transition ever plays).
  const exitTransition = enabled ? { duration: EXIT_DURATION_S, ease: 'easeIn' as const } : { duration: 0 };

  const classes = [className, pending ? 'card-in-flight' : null].filter(Boolean).join(' ');

  return (
    <motion.span
      className={classes || undefined}
      style={{ display: 'inline-block' }}
      initial={{ x: origin.x, y: origin.y, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={{ opacity: 0, y: 8, transition: exitTransition }}
      transition={transition}
      onAnimationComplete={complete}
    >
      {children}
    </motion.span>
  );
}
