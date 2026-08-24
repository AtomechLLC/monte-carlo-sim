// @vitest-environment node
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { Card } from '@poker-apprentice/types';
import { deriveConditionedState, isOpponentRevealed, type PredeterminedRunout } from './conditioning';
import { STREET_ORDER } from './streets';
import { FULL_DECK } from './cards';
import { cardCounts, shoeSize, type DeckCount } from './shoe';
import { createRng, createDrawer } from './rng';
import { unknownCardsPerTrial } from './equity';

// DECK-01 / DECK-03 additive property suite — the 2-deck-aware siblings of
// conditioning.test.ts's 1-deck-only properties (D-10, PITFALLS.md Pitfall 12: additive,
// never a loosening of the existing single-deck invariants).

// Fixed fixture built from 13 disjoint slices of FULL_DECK (2 hero + 5 board + 3x2
// opponents) — same shape as conditioning.test.ts's canonical `runout` fixture.
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

describe('DECK-01 / DECK-03 additive property suite — 2-deck multiset closure and without-replacement guard', () => {
  // Property A — 2-deck conditioning closure, asserted by COUNT. This is the count-shaped
  // sibling of conditioning.test.ts's line-111 dedup-then-measure-length property (D-10,
  // PITFALLS Pitfall 12): that property stays a 1-deck-only invariant and is deliberately
  // not generalised, because at deckCount=2 a dedup-then-measure-length assertion would be
  // FALSE for correct output (two legitimate physical copies of the same value coexist).
  test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
    'DECK-01: at deckCount=2, every (street, revealedMask) combination reconstitutes exactly 2 copies of every FULL_DECK value across known+remaining',
    (streetIndex, revealedMask) => {
      const street = STREET_ORDER[streetIndex];
      const result = deriveConditionedState(runout, street, revealedMask, 2);

      const revealedOpponentCards = result.knownOpponentHoles.flatMap((hole) =>
        hole ? [hole[0], hole[1]] : [],
      );
      const allCards: Card[] = [
        ...result.heroHole,
        ...result.knownBoard,
        ...revealedOpponentCards,
        ...result.remainingDeck,
      ];

      expect(allCards).toHaveLength(shoeSize(2));
      const counts = cardCounts(allCards);
      for (const card of FULL_DECK) {
        expect(counts.get(card)).toBe(2);
      }
    },
  );

  // Property B — 2-deck remaining-deck arithmetic, the exact analogue of
  // conditioning.test.ts's untouched line-132 1-deck property. This is the formula plan
  // 04-05's worker validation must implement at deckCount=2.
  test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
    'DECK-01: at deckCount=2, remainingDeck.length always equals shoeSize(2) - 2 - knownBoard.length - 2 * revealedCount',
    (streetIndex, revealedMask) => {
      const street = STREET_ORDER[streetIndex];
      const result = deriveConditionedState(runout, street, revealedMask, 2);
      const revealedCount = [0, 1, 2].filter((i) => isOpponentRevealed(revealedMask, i)).length;

      expect(result.remainingDeck.length).toBe(shoeSize(2) - 2 - result.knownBoard.length - 2 * revealedCount);
    },
  );

  // Property C — the DECK-03 without-replacement guard (D-05), run at BOTH deck counts.
  // A future with-replacement shortcut (PITFALLS Pitfall 1) breaks this immediately at
  // deckCount=1 as well as 2: it would let a sample draw more copies of a value than the
  // shoe physically holds.
  test.prop([fc.constantFrom(1, 2), fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
    'DECK-03: no single draw ever uses more copies of a card than the shoe physically holds, at both deck counts',
    (deckCount, streetIndex, revealedMask) => {
      const street = STREET_ORDER[streetIndex];
      const state = deriveConditionedState(runout, street, revealedMask, deckCount as DeckCount);

      const knownCards: Card[] = [...state.heroHole, ...state.knownBoard];
      for (const hole of state.knownOpponentHoles) {
        if (hole !== null) knownCards.push(hole[0], hole[1]);
      }
      const knownCounts = cardCounts(knownCards);

      const n = unknownCardsPerTrial(state);
      const drawUnknown = createDrawer(createRng(20260824), state.remainingDeck, n);

      // CRITICAL (PITFALLS.md Pitfall 7): drive createDrawer DIRECTLY here — do NOT route
      // this sample through the shared Monte Carlo trial-batch runner (equity.ts's batch
      // executor). At deckCount === 2 a drawn sample legitimately contains duplicate
      // values, and that batch executor calls evaluateHand, which reaches evaluateHoldem,
      // which throws `TypeError: C is not iterable` on any duplicate rank+suit
      // co-occurrence (empirically confirmed). Duplicate-aware evaluation is Phase 7 scope,
      // deliberately not this phase — do not "helpfully" wrap this sample-drawing loop in
      // that trial-batch executor.
      for (let i = 0; i < 200; i++) {
        const sample = drawUnknown();
        expect(sample).toHaveLength(n);

        const sampleCounts = cardCounts(sample);
        for (const [card, sampleCount] of sampleCounts) {
          const knownCount = knownCounts.get(card) ?? 0;
          expect(sampleCount + knownCount).toBeLessThanOrEqual(deckCount);
        }
      }
    },
  );

  // Property D — the deck-count effect is real, not a no-op (the compact, non-statistical
  // form of PITFALLS Pitfall 1's "1-deck and 2-deck must measurably differ" check available
  // in an engine-only phase).
  test.prop([fc.integer({ min: 0, max: 3 })])(
    'deck count measurably changes the pool: remainingDeck grows by exactly 52 cards, and a hero card goes from 0 copies (1 deck) to 1 copy (2 decks)',
    (streetIndex) => {
      const street = STREET_ORDER[streetIndex];
      const oneDeck = deriveConditionedState(runout, street, 0, 1);
      const twoDeck = deriveConditionedState(runout, street, 0, 2);

      expect(twoDeck.remainingDeck.length - oneDeck.remainingDeck.length).toBe(52);

      const heroCard = runout.heroHole[0];
      expect(oneDeck.remainingDeck.filter((c) => c === heroCard)).toHaveLength(0);
      expect(twoDeck.remainingDeck.filter((c) => c === heroCard)).toHaveLength(1);
    },
  );
});
