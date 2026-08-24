// @vitest-environment node
import { it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { Card } from '@poker-apprentice/types';
import {
  runBlackjackTrials,
  unknownCardsPerTrial,
  BLACKJACK_TRIAL_CARD_BUDGET,
  type BlackjackConditionedState,
} from './blackjackEquity';
import { BUCKET_INDEX, DEALER_BUCKET_COUNT } from '../worker/blackjackProtocol';
import { playDealerHand, classifyDealerOutcome } from './blackjackHandValue';
import { FULL_DECK } from './cards';
import { shoeWithout, cardCounts, type DeckCount } from './shoe';
import { createRng, createDrawer } from './rng';

// BJ-03/BJ-04 (D-11, DECK-03): invariants that must hold for every input, not just the
// hand-picked cases. A biased sampler, an overlapping cursor prefix, or a dropped tally
// branch can pass every deterministic test while still producing wrong odds; these
// properties close that gap.

function stateFor(playerHand: Card[], dealerUpcard: Card, deckCount: DeckCount): BlackjackConditionedState {
  return {
    playerHand,
    dealerUpcard,
    remainingDeck: shoeWithout(deckCount, [...playerHand, dealerUpcard]),
    deckCount,
  };
}

/** A 12-card scripted draw for the exact-behavior single-trial cases below. */
function scriptedDraw(cards: readonly Card[]): () => Card[] {
  if (cards.length !== BLACKJACK_TRIAL_CARD_BUDGET) {
    throw new Error(`scripted draw must have exactly ${String(BLACKJACK_TRIAL_CARD_BUDGET)} cards`);
  }
  return () => [...cards];
}

test.prop([fc.integer({ min: 1, max: 200 }), fc.integer()])(
  '(a) every tally reconciles to trialsCompleted, for any trial count and seed',
  (trialCount, seed) => {
    const state = stateFor(['7h', '7c'], 'Th', 1);
    const drawUnknown = createDrawer(createRng(seed), state.remainingDeck, unknownCardsPerTrial(state));

    const result = runBlackjackTrials(state, trialCount, drawUnknown);

    expect(result.trialsCompleted).toBe(trialCount);
    expect(result.dealerOutcomeCounts).toHaveLength(DEALER_BUCKET_COUNT);
    expect(result.dealerOutcomeCounts.reduce((a, b) => a + b, 0)).toBe(trialCount);
    expect(result.standOutcomes.win + result.standOutcomes.push + result.standOutcomes.lose).toBe(trialCount);
    expect(result.hitOutcomes.win + result.hitOutcomes.push + result.hitOutcomes.lose).toBe(trialCount);
    // bustIfHitCount is its own tally, bounded only by the trial count — a hit can lose
    // WITHOUT busting, so it is deliberately NOT derivable from hitOutcomes.lose.
    expect(result.bustIfHitCount).toBeLessThanOrEqual(trialCount);
  },
);

test.prop([
  fc.constantFrom<DeckCount>(1, 2),
  fc.uniqueArray(fc.integer({ min: 0, max: FULL_DECK.length - 1 }), { minLength: 3, maxLength: 6 }),
])('(b) unknownCardsPerTrial is the fixed 12-card budget for EVERY state shape', (deckCount, indices) => {
  const cards = indices.map((i) => FULL_DECK[i]);
  const state = stateFor(cards.slice(1), cards[0], deckCount);
  expect(unknownCardsPerTrial(state)).toBe(BLACKJACK_TRIAL_CARD_BUDGET);
  expect(BLACKJACK_TRIAL_CARD_BUDGET).toBe(12);
});

test.prop([
  fc.uniqueArray(fc.integer({ min: 0, max: FULL_DECK.length - 1 }), { minLength: 3, maxLength: 3 }),
])(
  '(c) at 1 deck every trial samples 12 distinct cards, none of them a known card',
  (indices) => {
    const playerHand: Card[] = [FULL_DECK[indices[0]], FULL_DECK[indices[1]]];
    const dealerUpcard = FULL_DECK[indices[2]];
    const state = stateFor(playerHand, dealerUpcard, 1);

    const baseDraw = createDrawer(createRng(2026), state.remainingDeck, unknownCardsPerTrial(state));
    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    // 100 trials is enough — this property is about sampling structure, not statistics.
    runBlackjackTrials(state, 100, drawUnknown);

    expect(captured).toHaveLength(100);
    for (const sample of captured) {
      expect(sample).toHaveLength(BLACKJACK_TRIAL_CARD_BUDGET);
      expect(new Set(sample).size).toBe(BLACKJACK_TRIAL_CARD_BUDGET);
      expect(sample).not.toContain(playerHand[0]);
      expect(sample).not.toContain(playerHand[1]);
      expect(sample).not.toContain(dealerUpcard);
    }
  },
);

test.prop([
  fc.uniqueArray(fc.integer({ min: 0, max: FULL_DECK.length - 1 }), { minLength: 3, maxLength: 3 }),
])(
  '(d) at 2 decks no card VALUE is drawn more times than the shoe holds copies after the known cards are spent (count-aware, never Set uniqueness)',
  (indices) => {
    const playerHand: Card[] = [FULL_DECK[indices[0]], FULL_DECK[indices[1]]];
    const dealerUpcard = FULL_DECK[indices[2]];
    const state = stateFor(playerHand, dealerUpcard, 2);
    const knownCounts = cardCounts([...playerHand, dealerUpcard]);

    const baseDraw = createDrawer(createRng(20260824), state.remainingDeck, unknownCardsPerTrial(state));
    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };

    runBlackjackTrials(state, 100, drawUnknown);

    for (const sample of captured) {
      const sampleCounts = cardCounts(sample);
      for (const [card, sampleCount] of sampleCounts) {
        expect(sampleCount + (knownCounts.get(card) ?? 0)).toBeLessThanOrEqual(2);
      }
    }
  },
);

test.prop([fc.integer({ min: 1, max: 200 }), fc.integer()])(
  '(e) exactly ONE drawUnknown() call happens per trial',
  (trialCount, seed) => {
    const state = stateFor(['9h', '9c'], '6d', 1);
    const baseDraw = createDrawer(createRng(seed), state.remainingDeck, unknownCardsPerTrial(state));
    let calls = 0;
    const drawUnknown = (): Card[] => {
      calls += 1;
      return baseDraw();
    };

    runBlackjackTrials(state, trialCount, drawUnknown);

    expect(calls).toBe(trialCount);
  },
);

it('(f) the hit-hypothetical card is the DISJOINT cursor slot after the dealer playout, never a card the dealer already consumed', () => {
  // Player [Th,9h] = 19, upcard 6d. Scripted trial: hole 5c (dealer 11), dealer hits Td
  // (21, stands, 3 cards -> bucket '21'), so the dealer consumed drawn[0..1]. The hit card
  // MUST be drawn[2] = 2c -> player 21, no bust, push vs. the dealer's 21. A cursor-overlap
  // bug that reused drawn[1] (Td) as the hit card would bust the player at 29 instead.
  const state = stateFor(['Th', '9h'], '6d', 1);
  const drawn: Card[] = ['5c', 'Td', '2c', '3c', '4c', '8c', '9c', 'Jc', 'Qc', 'Kc', '6s', '7s'];

  const result = runBlackjackTrials(state, 1, scriptedDraw(drawn));

  expect(result.dealerOutcomeCounts[BUCKET_INDEX['21']]).toBe(1);
  expect(result.standOutcomes).toEqual({ win: 0, push: 0, lose: 1 }); // 19 vs 21
  expect(result.bustIfHitCount).toBe(0);
  expect(result.hitOutcomes).toEqual({ win: 0, push: 1, lose: 0 }); // 21 vs 21
});

it('(g) a hypothetical 2-card dealer 21 lands in the natural bucket, not the 21 bucket', () => {
  // Upcard Ah plus forced hole Kd is a 2-card 21 -> 'natural'. Both the Stand hand (18)
  // and the post-hit hand (20) lose to it through compareToDealer's dealer-natural branch
  // (06-RESEARCH Pitfall F) — under Option A these hypothetical naturals are legitimately
  // sampled and must never be miscounted as plain 21s or pushes.
  const state = stateFor(['9h', '9c'], 'Ah', 1);
  const drawn: Card[] = ['Kd', '2c', '3c', '4c', '5c', '6c', '7c', '8c', 'Jc', 'Qc', '6s', '7s'];

  const result = runBlackjackTrials(state, 1, scriptedDraw(drawn));

  expect(result.dealerOutcomeCounts[BUCKET_INDEX.natural]).toBe(1);
  expect(result.dealerOutcomeCounts[BUCKET_INDEX['21']]).toBe(0);
  expect(result.standOutcomes).toEqual({ win: 0, push: 0, lose: 1 });
  expect(result.hitOutcomes).toEqual({ win: 0, push: 0, lose: 1 });
  expect(result.bustIfHitCount).toBe(0);
});

it('(i) a revealed hole (knownDealerHole) IS the dealer\'s hole in every trial — never resampled, and the drawn prefix shifts by one slot (06-REVIEW CR-01, BJ-06)', () => {
  // Player [Th,9h] = 19, upcard 6d, REVEALED hole Td — the dealer is pinned at hard 16.
  // Scripted trial: drawn[0] is now the dealer's FIRST HIT (5c -> 21, 3 cards, bucket '21'),
  // and the hit hypothetical is drawn[1] = 2c -> player 21, push vs 21. A loop that still
  // consumed drawn[0] as a resampled hole would play dealer 6d+5c=11 instead — a totally
  // different tally — and a loop that ignored knownDealerHole would recondition on "the
  // hole is anything BUT the Td face-up on the table".
  const state: BlackjackConditionedState = {
    playerHand: ['Th', '9h'],
    dealerUpcard: '6d',
    knownDealerHole: 'Td',
    remainingDeck: shoeWithout(1, ['Th', '9h', '6d', 'Td']),
    deckCount: 1,
  };
  const drawn: Card[] = ['5c', '2c', '3c', '4c', '8c', '9c', 'Jc', 'Qc', 'Kc', '6s', '7s', '8s'];

  const result = runBlackjackTrials(state, 1, scriptedDraw(drawn));

  expect(result.dealerOutcomeCounts[BUCKET_INDEX['21']]).toBe(1);
  expect(result.standOutcomes).toEqual({ win: 0, push: 0, lose: 1 }); // 19 vs 21
  expect(result.bustIfHitCount).toBe(0);
  expect(result.hitOutcomes).toEqual({ win: 0, push: 1, lose: 0 }); // 21 vs 21
});

it('(j) with a revealed non-ten hole under an ace upcard, the Natural bucket is EXACTLY zero across every trial (06-REVIEW CR-01)', () => {
  // Upcard Ah, revealed hole 5d: the user can SEE the dealer has no natural. Resampling a
  // hypothetical hole from the pool (which still holds 16 ten-values) would show a ~30%
  // Natural bucket beside two face-up cards that contradict it.
  const playerHand: Card[] = ['9h', '9c'];
  const state: BlackjackConditionedState = {
    playerHand,
    dealerUpcard: 'Ah',
    knownDealerHole: '5d',
    remainingDeck: shoeWithout(1, [...playerHand, 'Ah', '5d']),
    deckCount: 1,
  };
  const drawUnknown = createDrawer(createRng(20260824), state.remainingDeck, unknownCardsPerTrial(state));

  const result = runBlackjackTrials(state, 2000, drawUnknown);

  expect(result.dealerOutcomeCounts[BUCKET_INDEX.natural]).toBe(0);
  expect(result.trialsCompleted).toBe(2000);
});

it('(k) revealing a ten under a 6 upcard moves dealer bust% from the upcard-6 marginal to the hard-16 conditional (06-REVIEW CR-01, seeded direction check)', () => {
  // Pre-reveal: upcard 6, hole unknown -> marginal bust ~42-44%. Post-reveal: hole Th known
  // -> dealer pinned at hard 16, busts iff the one forced draw is 6+ (28 of the 48 unseen
  // cards ~ 58%). The pre/post gap (~15pp) dwarfs seeded sampling noise at 4000 trials.
  const playerHand: Card[] = ['9h', '9c'];
  const trials = 4000;

  const preState: BlackjackConditionedState = {
    playerHand,
    dealerUpcard: '6d',
    remainingDeck: shoeWithout(1, [...playerHand, '6d']),
    deckCount: 1,
  };
  const postState: BlackjackConditionedState = {
    playerHand,
    dealerUpcard: '6d',
    knownDealerHole: 'Th',
    remainingDeck: shoeWithout(1, [...playerHand, '6d', 'Th']),
    deckCount: 1,
  };

  const pre = runBlackjackTrials(
    preState,
    trials,
    createDrawer(createRng(2026), preState.remainingDeck, unknownCardsPerTrial(preState)),
  );
  const post = runBlackjackTrials(
    postState,
    trials,
    createDrawer(createRng(2026), postState.remainingDeck, unknownCardsPerTrial(postState)),
  );

  const preBust = pre.dealerOutcomeCounts[BUCKET_INDEX.bust] / trials;
  const postBust = post.dealerOutcomeCounts[BUCKET_INDEX.bust] / trials;

  expect(preBust).toBeLessThan(0.5);
  expect(postBust).toBeGreaterThan(0.55);
  expect(postBust).toBeGreaterThan(preBust + 0.1);
});

it('(h) the trial loop delegates its dealer playout to playDealerHand — a multi-ace demotion chain tallies exactly the bucket playDealerHand itself produces', () => {
  // Upcard 5h, hole Ah (soft 16) -> hit Ac -> 5+11+11=27 -> demote -> SOFT 17 -> S17
  // stands. An inline hit-loop re-implementation with a naive total (aces always 11 or
  // always 1) diverges on exactly this chain: always-11 busts at 27, always-1 keeps
  // hitting at 7. Asserting the trial's tally against playDealerHand's own result on the
  // same scripted cards pins the two code paths as ONE code path.
  const state = stateFor(['Th', '7c'], '5h', 1);
  const drawn: Card[] = ['Ah', 'Ac', '3d', '2c', '4c', '6c', '8c', '9c', 'Jc', 'Qc', '6s', '7s'];

  const reference = playDealerHand('5h', 'Ah', (() => {
    const script: Card[] = ['Ac'];
    let next = 0;
    return () => script[next++];
  })());
  const referenceBucket = classifyDealerOutcome(reference.cards, reference.result);
  expect(referenceBucket).toBe('17');

  const result = runBlackjackTrials(state, 1, scriptedDraw(drawn));

  expect(result.dealerOutcomeCounts[BUCKET_INDEX[referenceBucket]]).toBe(1);
  expect(result.dealerOutcomeCounts.reduce((a, b) => a + b, 0)).toBe(1);
  expect(result.standOutcomes).toEqual({ win: 0, push: 1, lose: 0 }); // 17 vs 17
  expect(result.hitOutcomes).toEqual({ win: 1, push: 0, lose: 0 }); // 17+3=20 vs 17
  expect(result.bustIfHitCount).toBe(0);
});
