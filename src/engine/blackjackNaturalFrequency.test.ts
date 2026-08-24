// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isNatural } from './blackjackHandValue';
import { shoeWithout, type DeckCount } from './shoe';
import { createRng, drawN } from './rng';

// D-12 seeded natural-frequency anchor (BJ-07): 1 deck vs 2 decks.
//
// This is a test of the DEAL-TIME natural-resolution path (repeated complete deals,
// counting how many initial player hands are naturals), not of the per-decision trial
// loop — a structurally different kind of statistical test from the property suite.
//
// WHY N = 2,000,000 PER ARM (do not "optimise" this back down): the true 1-vs-2-deck gap
// is only 0.047 percentage points. At the 10,000 deals the 06-RESEARCH tolerance table
// suggests, the standard error (~0.21pp) dwarfs the effect — a bare direction assertion
// would be close to a coin flip per seed, and the with-replacement negative control
// would pass or fail at random. At 2,000,000 the SE is ~0.015pp, which makes the band
// below the real with-replacement detector and the direction assertion a genuine (not
// lucky) check. Each deal is one 4-card drawN with no evaluator call, so 2,000,000 is
// cheap — seconds per arm.
//
// STANDING RULE (adapted from deckParity.golden.test.ts): the correct response to a red
// test in this file is to fix the sampling code, NEVER to widen the band or re-record
// the expected literals. If any assertion is flaky under the chosen seed, RAISE N or
// change the seed and re-derive the band from the new SE — never widen the band to
// accommodate a failure. Record the final N, seed and both measured rates in the
// phase SUMMARY.

const NATURAL_DEALS_PER_ARM = 2_000_000;
/** Same seed in BOTH arms (the benchmark.test.ts two-arm convention) — apples-to-apples. */
const SEED = 20260824;
// Two 2,000,000-deal arms of pure array shuffling take seconds, not milliseconds — give
// the test explicit headroom above Vitest's 5s default, mirroring BENCHMARK_TIMEOUT_MS.
const NATURAL_FREQUENCY_TIMEOUT_MS = 120000;

// Provenance (06-RESEARCH "Verified Probability Anchors", independently re-derived by
// combinatorics and matched against forums.saliu.com's identical worked formula):
//   1 deck:  P(natural) = C(4,1)*C(16,1)/C(52,2) = 64 / 1326  = 4.8265...%
//   2 decks: P(natural) = (8*32)/C(104,2)        = 256 / 5356 = 4.7797...%
// These are closed-form probabilities, so the tolerance below is principled, not guessed.
const ONE_DECK_NATURAL_PCT = (64 / 1326) * 100;
const TWO_DECK_NATURAL_PCT = (256 / 5356) * 100;

// Band arithmetic: SE = sqrt(p(1-p)/n) with p ~= 0.048, n = 2,000,000 gives ~0.015pp, so
// +/-0.06pp is a ~4-sigma band around the closed form — wide enough never to flake,
// tight enough that a with-replacement sampler (which converges on ~4.734% at "1 deck",
// about 0.09pp low) falls OUTSIDE the band deterministically. This band — not the
// direction assertion — is the primary with-replacement detector (PITFALLS Pitfall 1).
const BAND_PP = 0.06;

function measureNaturalPct(deckCount: DeckCount): number {
  const rng = createRng(SEED);
  let naturals = 0;
  for (let deal = 0; deal < NATURAL_DEALS_PER_ARM; deal++) {
    // One complete deal: build the full shoe and draw all 4 initial cards (player x2,
    // upcard, hole) in ONE drawN call — the single-shuffle discipline gameStore.deal()
    // documents. Only the player's 2 cards feed the natural tally here.
    const pool = shoeWithout(deckCount, []);
    const [p0, p1] = drawN(rng, pool, 4);
    if (isNatural([p0, p1])) naturals += 1;
  }
  return (naturals / NATURAL_DEALS_PER_ARM) * 100;
}

describe('natural frequency anchor — seeded, 2,000,000 deals per arm (D-12, BJ-07)', () => {
  it(
    '1-deck and 2-deck natural rates land inside +/-0.06pp of their closed forms, and 1 deck is strictly more natural-prone',
    () => {
      const oneDeckPct = measureNaturalPct(1);
      const twoDeckPct = measureNaturalPct(2);

      // (1) Primary with-replacement detector: the 1-deck band. A with-replacement
      // sampler converges ~0.09pp below the closed form — outside this ~4-sigma band.
      expect(
        Math.abs(oneDeckPct - ONE_DECK_NATURAL_PCT),
        `1-deck natural rate ${oneDeckPct.toFixed(4)}% must be within ${String(BAND_PP)}pp of the closed-form ${ONE_DECK_NATURAL_PCT.toFixed(4)}%`,
      ).toBeLessThanOrEqual(BAND_PP);

      // (2) The 2-deck band around its own closed form.
      expect(
        Math.abs(twoDeckPct - TWO_DECK_NATURAL_PCT),
        `2-deck natural rate ${twoDeckPct.toFixed(4)}% must be within ${String(BAND_PP)}pp of the closed-form ${TWO_DECK_NATURAL_PCT.toFixed(4)}%`,
      ).toBeLessThanOrEqual(BAND_PP);

      // (3) Secondary detector — DIRECTION: a with-replacement/infinite-deck shortcut
      // makes both arms converge on the SAME number; at this N the 0.047pp true gap is
      // ~3 SE of the difference, so this ordering is a real signal, not a per-seed coin
      // flip (PITFALLS Pitfall 1).
      expect(
        oneDeckPct,
        `1-deck rate ${oneDeckPct.toFixed(4)}% must be STRICTLY greater than the 2-deck rate ${twoDeckPct.toFixed(4)}%`,
      ).toBeGreaterThan(twoDeckPct);
    },
    NATURAL_FREQUENCY_TIMEOUT_MS,
  );
});
