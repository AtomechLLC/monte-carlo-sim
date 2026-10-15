import { useEffect } from 'react';
import { useReducedMotion } from 'motion/react';

/** One spin (or roll) lands every 24 ms: a batch of 100 takes about 2.4 s to arrive. */
export const REVEAL_STEP_MS = 24;

/**
 * Walks a store's reveal cursor from `revealed` up to `total`, one step per tick (quick task
 * 261015-ch8, PLAN decision 3). This is the convergence display for the batch games: the
 * whole batch is computed synchronously, and what the user watches is the DISPLAY catching
 * up with it — the hit count climbing, the observed rate wobbling toward the true one.
 *
 * Game-agnostic by construction (roulette now, craps next): it is handed the two cursor
 * actions and knows nothing about what a step reveals.
 *
 * A timeout chain rather than an interval: each step changes `revealed`, which re-runs the
 * effect and arms the next step, so the cleanup always has exactly one timer to clear. That
 * makes it StrictMode-safe (the doubled first invocation's cleanup clears its own timer) and
 * makes an unmount mid-batch harmless — the cursor stays where it was, and the next mount
 * resumes the walk.
 *
 * Under `prefers-reduced-motion` the whole batch lands at once. This repo's test harness
 * forces that preference, which is what keeps every rendered roulette assertion synchronous.
 */
export function useProgressiveReveal(
  revealed: number,
  total: number,
  revealNext: () => void,
  revealAll: () => void,
): void {
  const reduce = useReducedMotion() === true;

  useEffect(() => {
    if (revealed >= total) return;
    if (reduce) {
      revealAll();
      return;
    }
    const timer = setTimeout(revealNext, REVEAL_STEP_MS);
    return () => clearTimeout(timer);
  }, [revealed, total, reduce, revealNext, revealAll]);
}
