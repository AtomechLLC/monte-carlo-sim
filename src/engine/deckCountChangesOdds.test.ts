// @vitest-environment node
// NOTE: the pragma above must stay in the leading docblock and must not be named anywhere
// else in this file — vitest scans the WHOLE file for it, so a comment merely mentioning it
// can silently change the environment.
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { createRng, createDrawer } from './rng';
import {
  deriveBlackjackConditionedState,
  type PredeterminedBlackjackRound,
} from './blackjackConditioning';
import { runBlackjackTrials, unknownCardsPerTrial } from './blackjackEquity';
import type { DeckCount } from './shoe';
import { DEALER_BUCKET_ORDER } from '../worker/blackjackProtocol';

/**
 * THE MILESTONE'S HEADLINE CLAIM, closed end to end.
 *
 * v2.0's whole premise is that deck count is a first-class probability variable — "deck count
 * visibly changes the odds" (BJ-07 / DECK-02). Until now that claim was proven in two halves
 * that never met:
 *
 *   - `blackjackNaturalFrequency.test.ts` proves the MATH differs, but computes it from a
 *     standalone deal loop that never touches the app's conditioning or trial path.
 *   - The app-level suites prove the UI RE-RUNS on a toggle and renders different numbers, but
 *     they inject fixture snapshots — the "different numbers" are handed to them, not earned.
 *
 * So nothing connected "the shoe really changes the answer" to "the code the app actually runs
 * produces that change." The v2.0 milestone audit recorded that as gap W-04. This file is the
 * join: the SAME visible cards, through the SAME production conditioning reader and the SAME
 * production trial loop the worker calls, at one deck and at two — asserting the outputs differ
 * in the direction the combinatorics demand.
 *
 * Fixed seed and a single shared RNG stream per arm, so a failure is a real behaviour change
 * rather than sampling noise.
 */

const SEED = 20260825;
const TRIALS = 120_000;

/**
 * A decision point chosen because the shoe change is LARGE and DIRECTIONAL here: the player
 * holds two tens, so at one deck four of the sixteen ten-valued cards are already visible and
 * gone from a 52-card shoe. Doubling the shoe dilutes that removal, which must move the
 * dealer's outcome distribution by a measurable amount.
 */
const ROUND: PredeterminedBlackjackRound = {
  dealerUpcard: 'Ts',
  dealerHole: '7c',
};

/** The player's two visible cards. Held separately: the round predetermines only the dealer's
 * two cards (D-01), so the player's hand is passed to the conditioning reader alongside it. */
const PLAYER_CARDS: readonly Card[] = ['Td', 'Th'];

function runAt(deckCount: DeckCount) {
  const state = deriveBlackjackConditionedState(ROUND, PLAYER_CARDS, false, deckCount);
  const rng = createRng(SEED);
  const draw = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
  const totals = runBlackjackTrials(state, TRIALS, draw);
  return { state, totals };
}

describe('deck count changes the odds — through the production path, not a side channel', () => {
  const one = runAt(1);
  const two = runAt(2);

  const pct = (n: number) => (100 * n) / TRIALS;

  it('conditions on a genuinely larger shoe at two decks', () => {
    // The premise of everything below: same three visible cards, twice the remaining shoe.
    expect(one.state.remainingDeck).toHaveLength(52 - 3);
    expect(two.state.remainingDeck).toHaveLength(104 - 3);
    expect(two.state.playerHand).toEqual(one.state.playerHand);
    expect(two.state.dealerUpcard).toBe(one.state.dealerUpcard);
  });

  it('produces a dealer outcome distribution that measurably differs', () => {
    // Every bucket is a proportion over TRIALS trials, so the standard error on a single
    // bucket is at most 0.5/sqrt(TRIALS) ~= 0.145pp. A shift of a full percentage point is
    // therefore several standard errors of real signal, not noise.
    const perBucketShift = one.totals.dealerOutcomeCounts.map((count, i) =>
      Math.abs(pct(count) - pct(two.totals.dealerOutcomeCounts[i])),
    );
    const largestShift = Math.max(...perBucketShift);

    expect(
      largestShift,
      'doubling the shoe must move the dealer distribution by more than sampling noise',
    ).toBeGreaterThan(1);
  });

  it('moves the dealer NATURAL bucket in the direction the combinatorics demand', () => {
    // With a ten-value upcard the dealer's natural needs an ace in the hole. At one deck the
    // player's two tens have stripped ten-values from a 52-card shoe but left all four aces;
    // at two decks the pool is diluted toward its baseline composition. The audit's complaint
    // was that no test tied the app's numbers to the combinatorics, so assert the DIRECTION
    // rather than only that "something changed".
    // Index derived from the shipped bucket order, never hard-coded — a reorder there must
    // not silently retarget this assertion at a different bucket.
    const naturalIndex = DEALER_BUCKET_ORDER.indexOf('natural');
    const oneDeckNatural = pct(one.totals.dealerOutcomeCounts[naturalIndex]);
    const twoDeckNatural = pct(two.totals.dealerOutcomeCounts[naturalIndex]);

    const aces = (deck: readonly Card[]) => deck.filter((c) => c.startsWith('A')).length;
    const aceShareOne = aces(one.state.remainingDeck) / one.state.remainingDeck.length;
    const aceShareTwo = aces(two.state.remainingDeck) / two.state.remainingDeck.length;

    // One deck leaves a RICHER ace share (4/49 vs 8/101), so the dealer natural is likelier
    // there — and the measured numbers must agree with that pool arithmetic.
    expect(aceShareOne).toBeGreaterThan(aceShareTwo);
    expect(oneDeckNatural).toBeGreaterThan(twoDeckNatural);
  });

  it('keeps both arms internally consistent, so a difference cannot come from a broken run', () => {
    for (const [label, result] of [
      ['1 deck', one.totals],
      ['2 decks', two.totals],
    ] as const) {
      const bucketSum = result.dealerOutcomeCounts.reduce((a, b) => a + b, 0);
      expect(bucketSum, `${label}: dealer buckets must account for every trial`).toBe(TRIALS);

      const stand = result.standOutcomes;
      expect(
        stand.win + stand.push + stand.lose,
        `${label}: stand outcomes must account for every trial`,
      ).toBe(TRIALS);
    }
  });
});
