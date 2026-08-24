// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { runBlackjackTrials, unknownCardsPerTrial, type BlackjackConditionedState } from './blackjackEquity';
import { BUCKET_INDEX } from '../worker/blackjackProtocol';
import { shoeWithout } from './shoe';
import { createRng, createDrawer } from './rng';

// Seeded dealer-outcome sanity check (BJ-03, D-04).
//
// Shape provenance: 06-RESEARCH "Dealer bust / final-outcome distribution by upcard"
// (blackjackinfo.com + corroborating sources, MEDIUM confidence). Those published tables
// are 6-deck/infinite-deck S17 references, NOT this project's 1-2 deck shoe, so the exact
// percentages are deliberately NOT asserted here. What IS asserted is the structural
// RANKING (weak upcards 5/6 force the most hits and bust most; ten-value and Ace upcards
// bust least) and a generous overall band — properties of the game itself that hold at
// any deck count. Per the plan: if this ranking were ever unstable at this trial count,
// RAISE the trial count rather than loosening the ranking assertion.
//
// At 200,000 trials per upcard the binomial SE on a ~28% proportion is ~0.10pp; every
// ranking gap asserted below is 1pp+ (10+ sigma), so this test is deterministic in
// practice, not merely probably-green.

const TRIALS_PER_UPCARD = 200000;
const SEED = 20260824;
// 13 upcards x 200k trials of pure integer arithmetic — seconds, not minutes, but far
// beyond Vitest's 5s default. Explicit headroom, mirroring benchmark.test.ts.
const DEALER_OUTCOME_TIMEOUT_MS = 120000;

/** Every upcard rank once (suits held constant so only the rank varies across arms). */
const UPCARDS: Card[] = ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', 'Ts', 'Js', 'Qs', 'Ks', 'As'];
const TEN_VALUE_UPCARDS: Card[] = ['Ts', 'Js', 'Qs', 'Ks'];
const LOW_TO_NINE_UPCARDS: Card[] = ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s'];

describe('runBlackjackTrials — seeded dealer-outcome distribution sanity by upcard (BJ-03)', () => {
  it(
    'bust ranking: 5/6 are the two highest, ten-value/Ace the lowest, overall bust inside 25-32%',
    () => {
      // Fixture note: the player hand must be rank-NEUTRAL and the shoe 2 decks. A
      // rank-concentrated hand (e.g. a pair of 7s at 1 deck — half of all sevens gone)
      // measurably perturbs the upcard ranking through legitimate conditioning (7 is the
      // instant-17 hole for a T upcard and the instant-16 for a 9), which is real
      // probability but not the structural property this check pins. Two low cards of
      // different ranks in a 104-card shoe keep the conditioning perturbation ~10x
      // smaller than the 1-2pp ranking gaps asserted below.
      const playerHand: Card[] = ['2h', '3d'];
      const bustPctByUpcard = new Map<Card, number>();
      let totalBusts = 0;
      let totalTrials = 0;

      for (const upcard of UPCARDS) {
        const state: BlackjackConditionedState = {
          playerHand,
          dealerUpcard: upcard,
          remainingDeck: shoeWithout(2, [...playerHand, upcard]),
          deckCount: 2,
        };
        const drawUnknown = createDrawer(createRng(SEED), state.remainingDeck, unknownCardsPerTrial(state));
        const result = runBlackjackTrials(state, TRIALS_PER_UPCARD, drawUnknown);

        const busts = result.dealerOutcomeCounts[BUCKET_INDEX.bust];
        bustPctByUpcard.set(upcard, (busts / result.trialsCompleted) * 100);
        totalBusts += busts;
        totalTrials += result.trialsCompleted;
      }

      const sortedDescending = [...bustPctByUpcard.entries()].sort((a, b) => b[1] - a[1]);

      // Ranking, top end: upcards 5 and 6 are the two highest bust rates (weak upcards
      // force the most dealer hits).
      const topTwo = new Set([sortedDescending[0][0], sortedDescending[1][0]]);
      expect(topTwo).toEqual(new Set(['5s', '6s']));

      // Ranking, bottom end: Ace is the single lowest, and the second-lowest is a
      // ten-value upcard — i.e. "10 and Ace are the two lowest" in card-value terms
      // (J/Q/K are ten-values too, statistically identical to T, so the assertion is on
      // the value class, not on one specific ten-value rank winning a coin-flip).
      const lowest = sortedDescending[sortedDescending.length - 1][0];
      const secondLowest = sortedDescending[sortedDescending.length - 2][0];
      expect(lowest).toBe('As');
      expect(TEN_VALUE_UPCARDS).toContain(secondLowest);

      // Every ten-value upcard busts less often than every 2-9 upcard — the full-strength
      // form of the same structural ranking.
      for (const tenValue of TEN_VALUE_UPCARDS) {
        for (const low of LOW_TO_NINE_UPCARDS) {
          const tenValuePct = bustPctByUpcard.get(tenValue);
          const lowPct = bustPctByUpcard.get(low);
          if (tenValuePct === undefined || lowPct === undefined) throw new Error('missing upcard arm');
          expect(tenValuePct, `${tenValue} should bust less often than ${low}`).toBeLessThan(lowPct);
        }
      }

      // Overall (trial-count-weighted — all arms run equal trials, and each of the 13
      // ranks is equally likely as a real upcard, so the equal-weight mean IS the natural
      // weighting): a plausible band around the published ~28-30%, widened to cover both
      // statistical noise and the 1-deck-vs-published-6-deck gap.
      const overallBustPct = (totalBusts / totalTrials) * 100;
      expect(overallBustPct).toBeGreaterThanOrEqual(25);
      expect(overallBustPct).toBeLessThanOrEqual(32);
    },
    DEALER_OUTCOME_TIMEOUT_MS,
  );
});
