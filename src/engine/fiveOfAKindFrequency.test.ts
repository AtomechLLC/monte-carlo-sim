// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { getRank } from '@poker-apprentice/types';
import { evaluateHandTwoDeck, FIVE_OF_A_KIND } from './evaluatorTwoDeck';
import { evaluateHand } from './evaluator';
import { buildShoe, shoeWithout } from './shoe';
import { createRng, createDrawer } from './rng';

// D-13 seeded Five of a Kind frequency anchors (HE2-02): two INDEPENDENT statistical
// pins on the duplicate-aware evaluation layer, each with its closed form derived below,
// plus the impossible-at-1-deck companion sweep (the statistical form of D-11's parity
// contract).
//
// STANDING RULE (adapted from blackjackNaturalFrequency.test.ts / deckParity.golden):
// the correct response to a red test in this file is to fix the evaluation or sampling
// code, NEVER to widen a band or re-record an expected literal. If an assertion is flaky
// under the chosen seed, RAISE N or change the seed and RE-DERIVE the band from the new
// standard error — never widen a band to accommodate a failure. Record the final N, seed
// and both measured counts in the phase SUMMARY.
//
// 07-RESEARCH Assumption A3, stated explicitly: a seeded run is deterministic, so the
// realized count below is a FIXED number — the 3-sigma band exists so that a legitimate
// future change to draw-consumption order (which moves the realized count almost surely
// within the band) forces a conscious re-derivation instead of a silent retune.

const SEED = 20260824; // the house seed
const TRIALS_PER_ANCHOR = 200_000;
// Two 200,000-iteration arms of drawing plus wrapper evaluation take seconds, not
// milliseconds — give every statistical test explicit headroom above vitest's 5s
// default (the blackjackNaturalFrequency/blackjackDealerOutcome precedent). Statistical
// anchors get MORE room than the property suites: never let a slow CI box turn a
// correctness pin into a timeout flake.
const ANCHOR_TIMEOUT_MS = 120_000;

// WHY ANCHOR A (hero holds BOTH copies of one value) is the primary anchor rather than
// the distinct-rank alternative (07-RESEARCH Anchor B, p = 8.774e-5): at the same
// N = 200,000, Anchor A's 3-sigma band is about +/-20% relative width versus Anchor B's
// +/-96% — only Anchor A is tight enough to detect a real defect rather than noise.
// Hero ['Ah','Ah'] also doubles as the both-copies picker fixture D-07 exercises at the
// UI level.

describe('Five of a Kind frequency anchors — seeded, 200,000 trials per arm (D-13, HE2-02)', () => {
  it(
    'conditional anchor: hero [Ah,Ah] sees Five of a Kind inside the 3-sigma count band [179, 269]',
    () => {
      const heroHole: [Card, Card] = ['Ah', 'Ah'];
      // The conditioned pool: both hero copies removed from the 104-card shoe. The two
      // assertions below are what make the closed form auditable rather than asserted —
      // 102 cards total, exactly 6 aces remaining (8 minus hero's two Ah).
      const pool = shoeWithout(2, ['Ah', 'Ah']);
      expect(pool).toHaveLength(102);
      expect(pool.filter((card) => getRank(card) === 'A')).toHaveLength(6);

      // Closed form (07-RESEARCH Anchor A, exact combinatorics over C(102,5) boards):
      //   P(five of a kind | hero holds Ah,Ah)
      //     = [C(6,3)*C(96,2) + C(6,4)*C(96,1) + C(6,5)] / C(102,5)  (3+ more aces)
      //       + 12*C(8,5) / C(102,5)                                 (5 of another rank)
      //     = [91,200 + 1,440 + 6 + 672] / 83,291,670
      //     = 93318 / 83291670
      //     = 1.1204e-3
      // Band arithmetic: at N = 200,000, E[count] = N*p = 224.1 and
      // SE = sqrt(N*p*(1-p)) = 14.96, so the 3-sigma band on the COUNT is [179, 269].
      const rng = createRng(SEED);
      const drawBoard = createDrawer(rng, pool, 5);
      let count = 0;
      for (let trial = 0; trial < TRIALS_PER_ANCHOR; trial += 1) {
        const board = drawBoard();
        if (evaluateHandTwoDeck(heroHole, board).strength === FIVE_OF_A_KIND) count += 1;
      }

      // Failure meaning: a gate that MISSES a rank-count-5 shape reads LOW (five-of-a-
      // kind windows silently scored as lesser hands); a gate or branch that
      // MIS-DETECTS reads HIGH (lesser windows scored as Five of a Kind).
      expect(count, `conditional Five of a Kind count ${String(count)} must be >= 179 (3-sigma low bound)`).toBeGreaterThanOrEqual(179);
      expect(count, `conditional Five of a Kind count ${String(count)} must be <= 269 (3-sigma high bound)`).toBeLessThanOrEqual(269);
    },
    ANCHOR_TIMEOUT_MS,
  );

  it(
    'marginal anchor: uniform 7-of-104 windows see Five of a Kind inside the 3-sigma count band [15, 48]',
    () => {
      // Closed form (07-RESEARCH marginal anchor): the 13 per-rank events "window holds
      // >= 5 of rank r" are DISJOINT, because rank count >= 5 for two ranks would need
      // 10 cards in a 7-card window — which is what makes the closed form a simple sum
      // of 13 identical terms:
      //   P(five of a kind) = 13 * [C(8,5)*C(96,2) + C(8,6)*C(96,1) + C(8,7)] / C(104,7)
      //                     = 13 * [255,360 + 2,688 + 8] / 21,243,342,120
      //                     = 3,354,728 / 21,243,342,120
      //                     = 1.5792e-4
      // Band arithmetic: at N = 200,000, E[count] = 31.6 and SE = sqrt(N*p*(1-p)) =
      // 5.62, so the 3-sigma band on the COUNT is [15, 48].
      const shoe = buildShoe(2);
      const rng = createRng(SEED);
      const drawWindow = createDrawer(rng, shoe, 7);
      let count = 0;
      for (let trial = 0; trial < TRIALS_PER_ANCHOR; trial += 1) {
        const window = drawWindow();
        const hole: [Card, Card] = [window[0], window[1]];
        if (evaluateHandTwoDeck(hole, window.slice(2)).strength === FIVE_OF_A_KIND) count += 1;
      }

      expect(count, `marginal Five of a Kind count ${String(count)} must be >= 15 (3-sigma low bound)`).toBeGreaterThanOrEqual(15);
      expect(count, `marginal Five of a Kind count ${String(count)} must be <= 48 (3-sigma high bound)`).toBeLessThanOrEqual(48);
    },
    ANCHOR_TIMEOUT_MS,
  );

  it(
    'companion (D-11/D-12 mirror): 20,000 clean 1-deck windows produce ZERO Five of a Kind results and ZERO strength mismatches against the stock evaluator',
    () => {
      // The impossible-at-1-deck guard plus a second, statistical form of the D-11
      // parity contract: at 1 deck every window is duplicate-free, so the wrapper must
      // return the stock evaluator's strength every single time and can never reach the
      // Five of a Kind branch.
      const deck = buildShoe(1);
      const rng = createRng(SEED);
      const drawWindow = createDrawer(rng, deck, 7);
      let fiveOfAKindCount = 0;
      let strengthMismatches = 0;
      for (let trial = 0; trial < 20_000; trial += 1) {
        const window = drawWindow();
        const hole: [Card, Card] = [window[0], window[1]];
        const community = window.slice(2);
        const twoDeck = evaluateHandTwoDeck(hole, community);
        const stock = evaluateHand(hole, community);
        if (twoDeck.strength === FIVE_OF_A_KIND) fiveOfAKindCount += 1;
        if (twoDeck.strength !== stock.strength) strengthMismatches += 1;
      }

      expect(fiveOfAKindCount).toBe(0);
      expect(strengthMismatches).toBe(0);
    },
    ANCHOR_TIMEOUT_MS,
  );
});
