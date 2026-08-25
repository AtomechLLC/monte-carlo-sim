// @vitest-environment node
import { test, fc } from '@fast-check/vitest';
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
import { evaluateHand } from './evaluator';
import {
  evaluateHandTwoDeck,
  compareHandsTwoDeck,
  findDuplicatesForTesting,
  type HandTwoDeck,
} from './evaluatorTwoDeck';
import { oracleScore, type OracleResult } from './twoDeckOracle';
import { buildShoe, cardCounts } from './shoe';
import { createRng, drawN } from './rng';

// D-06/D-13: the invariants a hand-picked vector suite structurally cannot express —
// candidate-versus-oracle equivalence over GENERATED duplicate windows, monotonicity
// under copy-addition, gate totality against an independent recount, and comparator
// totality. The oracle (./twoDeckOracle) is a deliberate second implementation licensed
// as TEST-ONLY disposable-quality code (07-RESEARCH candidate (b)); Leg 1 below is what
// licenses it as the arbiter: its semantics coincide with standard poker on legal
// (clean) inputs.

const TWO_DECK_SHOE = buildShoe(2);
const ONE_DECK_SHOE = buildShoe(1);

function asWindow(cards: readonly Card[]): { hole: [Card, Card]; community: Card[] } {
  return { hole: [cards[0], cards[1]], community: cards.slice(2) };
}

// Rank parsing local to this test file — deliberately not imported from either
// implementation, so the tuple derivation below cannot inherit a shared bug.
const RANK_ORDER = '23456789TJQKA';
function rankIdx(card: Card): number {
  return RANK_ORDER.indexOf(card.charAt(0));
}

function wheelAwareHigh(ranksDesc: readonly number[]): number {
  // The wheel A-5-4-3-2 reads [12, 3, 2, 1, 0] descending; its straight high is the 5.
  if (ranksDesc[0] === 12 && ranksDesc[1] === 3) return 3;
  return ranksDesc[0];
}

/**
 * Canonical (strength, tiebreak) tuple for a candidate result, matching the oracle's
 * tiebreak conventions per category. Custom-scored results carry the vector directly;
 * stock-shaped results derive it from the best-5 hand array's RANKS — rank identity
 * survives the proxy's suit remap, so a synthetic card is safe to read here (07-RESEARCH
 * Pitfall 5 concerns physical-card accounting, never ranks).
 */
function candidateTuple(result: HandTwoDeck): OracleResult {
  if (result.tiebreak !== undefined) {
    return { strength: result.strength, tiebreak: result.tiebreak };
  }
  const ranksDesc = result.hand.map(rankIdx).sort((a, b) => b - a);
  if (result.strength === HandStrength.RoyalFlush) {
    return { strength: result.strength, tiebreak: [12] };
  }
  if (result.strength === HandStrength.StraightFlush || result.strength === HandStrength.Straight) {
    return { strength: result.strength, tiebreak: [wheelAwareHigh(ranksDesc)] };
  }
  if (result.strength === HandStrength.Flush || result.strength === HandStrength.HighCard) {
    return { strength: result.strength, tiebreak: ranksDesc };
  }
  // Rank-group categories: ranks sorted by (multiplicity desc, rank desc).
  const counts = new Array<number>(13).fill(0);
  for (const r of ranksDesc) counts[r] += 1;
  const grouped = ranksDesc.slice().sort((a, b) => counts[b] - counts[a] || b - a);
  return { strength: result.strength, tiebreak: grouped };
}

describe('evaluatorTwoDeck property suite (D-06, D-13)', () => {
  test.prop([fc.integer()], { numRuns: 100 })(
    '(a) ORACLE SELF-VALIDATION (Leg 1): oracleScore matches the stock evaluator category on every seeded clean 7-card window',
    (seed) => {
      const rng = createRng(seed);
      // 250 windows per fast-check run x 100 runs = 25,000 clean windows per suite run
      // (>= the 20,000 the plan mandates). 1-deck draws are duplicate-free by
      // construction, so no rejection sampling is needed here.
      for (let i = 0; i < 250; i += 1) {
        const window = drawN(rng, ONE_DECK_SHOE, 7);
        const { hole, community } = asWindow(window);
        expect(oracleScore(window).strength).toBe(evaluateHand(hole, community).strength);
      }
    },
    // The brute-force oracle scores 21 subsets per case, making this one of the phase's
    // two most CPU-hungry properties: comfortably fast alone but it must not race
    // vitest's 5s default under full-suite CPU contention (50+ parallel files) — the
    // equity.property.test.ts timeout precedent.
    30_000,
  );

  test.prop([fc.integer()], { numRuns: 100 })(
    '(b) CANDIDATE = ORACLE (Leg 2): evaluateHandTwoDeck matches oracleScore on the full (category, tiebreak) tuple over seeded duplicate windows',
    (seed) => {
      const rng = createRng(seed);
      // 200 accepted windows per run x 100 runs = 20,000 duplicate windows per suite
      // run. Rejection sampling is cheap: ~19.4% of uniform 7-card windows from the
      // 104-card shoe contain a duplicate (07-RESEARCH closed form), so the loop
      // terminates after ~5 draws per acceptance on average.
      let accepted = 0;
      while (accepted < 200) {
        const window = drawN(rng, TWO_DECK_SHOE, 7);
        if (!findDuplicatesForTesting(window)) continue;
        accepted += 1;
        const { hole, community } = asWindow(window);
        const candidate = candidateTuple(evaluateHandTwoDeck(hole, community));
        const oracle = oracleScore(window);
        expect(candidate.strength).toBe(oracle.strength);
        expect(candidate.tiebreak).toEqual(oracle.tiebreak);
      }
    },
    // Same CPU-contention rationale as (a): 21 oracle subsets per accepted window.
    30_000,
  );

  test.prop([fc.integer()], { numRuns: 100 })(
    '(c) MONOTONICITY (Leg 3, D-06): adding a second physical copy of a window card never weakens the hand',
    (seed) => {
      const rng = createRng(seed);
      for (let i = 0; i < 200; i += 1) {
        const window6 = drawN(rng, TWO_DECK_SHOE, 6);
        // The added copy must be a card with exactly one copy in the window (its shoe
        // twin is still available — the shoe holds exactly 2 of each value).
        const counts = cardCounts(window6);
        let copy: Card | null = null;
        for (const card of window6) {
          if (counts.get(card) === 1) {
            copy = card;
            break;
          }
        }
        if (copy === null) continue; // all three values already doubled — rare, skip
        const without = evaluateHandTwoDeck([window6[0], window6[1]], window6.slice(2));
        const withCopy = evaluateHandTwoDeck([window6[0], window6[1]], [...window6.slice(2), copy]);
        expect(compareHandsTwoDeck(withCopy, without)).toBeGreaterThanOrEqual(0);
      }
    },
    // 40,000 wrapper evaluations across the suite run — cheap alone, but budget the
    // same full-suite contention headroom as the sweeps above.
    30_000,
  );

  test.prop([fc.integer()], { numRuns: 100 })(
    '(d) NEVER HIGH CARD: any window the gate flags evaluates to at least One Pair (it always holds the identical pair)',
    (seed) => {
      const rng = createRng(seed);
      let accepted = 0;
      while (accepted < 200) {
        const window = drawN(rng, TWO_DECK_SHOE, 7);
        if (!findDuplicatesForTesting(window)) continue;
        accepted += 1;
        const { hole, community } = asWindow(window);
        expect(evaluateHandTwoDeck(hole, community).strength).toBeGreaterThanOrEqual(HandStrength.OnePair);
      }
    },
    30_000,
  );

  test.prop([fc.integer()], { numRuns: 100 })(
    '(e) GATE TOTALITY: the stamped gate verdict equals a naive per-value recount for any 7-card multiset from the 104-card shoe',
    (seed) => {
      const rng = createRng(seed);
      for (let i = 0; i < 300; i += 1) {
        const window = drawN(rng, TWO_DECK_SHOE, 7);
        // The naive recount is deliberately the slow, obviously-correct form (counts
        // via cardCounts, the codebase's one sanctioned multiset primitive — never
        // boolean membership); the fast stamped gate is the implementation under test.
        let naive = false;
        for (const count of cardCounts(window).values()) {
          if (count >= 2) naive = true;
        }
        expect(findDuplicatesForTesting(window)).toBe(naive);
      }
    },
    30_000,
  );

  test.prop([fc.integer()], { numRuns: 100 })(
    '(f) COMPARATOR TOTALITY: compareHandsTwoDeck is antisymmetric and transitive over generated 2-deck windows',
    (seed) => {
      const rng = createRng(seed);
      for (let t = 0; t < 50; t += 1) {
        const wa = asWindow(drawN(rng, TWO_DECK_SHOE, 7));
        const wb = asWindow(drawN(rng, TWO_DECK_SHOE, 7));
        const wc = asWindow(drawN(rng, TWO_DECK_SHOE, 7));
        const a = evaluateHandTwoDeck(wa.hole, wa.community);
        const b = evaluateHandTwoDeck(wb.hole, wb.community);
        const c = evaluateHandTwoDeck(wc.hole, wc.community);

        const ab = compareHandsTwoDeck(a, b);
        const ba = compareHandsTwoDeck(b, a);
        const bc = compareHandsTwoDeck(b, c);
        const cb = compareHandsTwoDeck(c, b);
        const ac = compareHandsTwoDeck(a, c);
        const ca = compareHandsTwoDeck(c, a);

        for (const value of [ab, ba, bc, cb, ac, ca]) {
          expect([-1, 0, 1]).toContain(value);
          expect(Object.is(value, -0)).toBe(false); // the never--0 discipline
        }
        // Antisymmetry (a 0 maps to 0 — checked via the sum, which sidesteps -0).
        expect(ab + ba).toBe(0);
        expect(bc + cb).toBe(0);
        expect(ac + ca).toBe(0);
        // Transitivity on the induced total preorder.
        if (ab >= 0 && bc >= 0) expect(ac).toBeGreaterThanOrEqual(0);
        if (ab > 0 && bc >= 0) expect(ac).toBeGreaterThan(0);
        if (ab >= 0 && bc > 0) expect(ac).toBeGreaterThan(0);
        if (ab === 0 && bc === 0) expect(ac).toBe(0);
      }
    },
    30_000,
  );

  // Explicit non-property assertion (plan mandate): clean-window results NEVER carry a
  // tiebreak field — a regression here would silently route clean hands through the
  // custom comparator branches instead of the stock comparator.
  it('(g) clean-window results carry no tiebreak field', () => {
    const rng = createRng(20260824);
    for (let i = 0; i < 1000; i += 1) {
      const window = drawN(rng, ONE_DECK_SHOE, 7);
      const { hole, community } = asWindow(window);
      expect(evaluateHandTwoDeck(hole, community).tiebreak).toBeUndefined();
    }
  });
});
