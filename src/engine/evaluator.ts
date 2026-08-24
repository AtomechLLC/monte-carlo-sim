import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
// The library is published as CJS with an ESM build and no `exports` map — named ESM
// imports throw. Use a default import and destructure. This is the ONLY module in the
// codebase permitted to import `@poker-apprentice/hand-evaluator` directly.
import pkg from '@poker-apprentice/hand-evaluator';

const { evaluateHoldem, compare } = pkg;

export { HandStrength };

/** The evaluated best-5-card hand: its category strength and the cards forming it. */
export interface Hand {
  strength: HandStrength;
  hand: Card[];
}

/**
 * Evaluates the best possible Hold'em hand (best-5-of-7, including "playing the board")
 * from the given hole and community cards. Delegates to `evaluateHoldem`, which hardcodes
 * the correct Hold'em hole-card usage rule (`minimumHoleCards: 0, maximumHoleCards: 2`).
 */
export function evaluateHand(holeCards: [Card, Card], communityCards: Card[]): Hand {
  return evaluateHoldem({ holeCards, communityCards });
}

/**
 * Compares two evaluated hands with a NORMALISED sign convention: `+1` when `a` is the
 * stronger hand, `-1` when `a` is weaker, `0` when tied.
 *
 * The raw library `compare(a, b)` returns `-1` when `a` is STRONGER and `+1` when `a` is
 * WEAKER — a "sort strongest-first" comparator, the reverse of naive numeric intuition.
 * This function is the single place in the codebase that handles that inversion; no other
 * module may call the raw `compare` (see `rawCompareForTesting` below, exposed only for
 * the regression guard in `evaluator.test.ts`).
 *
 * Negation alone (`-compare(a, b)`) would produce `-0` for a tie (`compare === 0`), which
 * fails strict `Object.is`-based equality checks (e.g. Vitest's `toBe(0)`) — so ties are
 * special-cased to return exactly `0`, never `-0`.
 */
export function compareHands(a: Hand, b: Hand): number {
  const raw = compare(a, b);
  if (raw === 0) return 0;
  return raw > 0 ? -1 : 1;
}

/**
 * Re-exports the raw, UN-normalised library comparator for `evaluator.test.ts`'s dedicated
 * sign-convention regression guard only. No other call site may use this — always use
 * `compareHands` instead.
 */
export const rawCompareForTesting = compare;
