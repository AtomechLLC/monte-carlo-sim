// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import {
  deriveBlackjackConditionedState,
  liveShoeLedger,
  resolveNaturals,
  type PredeterminedBlackjackRound,
} from './blackjackConditioning';
import { FULL_DECK } from './cards';
import { shoeSize, type DeckCount } from './shoe';

// Fixed FULL_DECK-sliced fixtures (the streamingParity.golden.test.ts /
// simulationApi.test.ts convention) rather than random hands, so a failure names an
// exact card. FULL_DECK[0..3] = 2c, 2d, 2h, 2s.
const round: PredeterminedBlackjackRound = {
  dealerUpcard: FULL_DECK[2],
  dealerHole: FULL_DECK[3],
};
const playerHand: Card[] = [FULL_DECK[0], FULL_DECK[1]];

describe('deriveBlackjackConditionedState — the odds-conditioning reader (D-02)', () => {
  it('the hidden hole card is STILL IN the odds pool (remainingDeck) while revealedHole is false', () => {
    const state = deriveBlackjackConditionedState(round, playerHand, false, 1);

    expect(state.remainingDeck).toContain(round.dealerHole);
    expect(state.remainingDeck).toHaveLength(shoeSize(1) - playerHand.length - 1);
    expect(state.playerHand).toEqual(playerHand);
    expect(state.dealerUpcard).toBe(round.dealerUpcard);
    expect(state.deckCount).toBe(1);
  });

  it('revealing the hole removes exactly its one physical copy from the odds pool', () => {
    const hidden = deriveBlackjackConditionedState(round, playerHand, false, 1);
    const revealed = deriveBlackjackConditionedState(round, playerHand, true, 1);

    expect(revealed.remainingDeck).not.toContain(round.dealerHole);
    expect(revealed.remainingDeck).toHaveLength(hidden.remainingDeck.length - 1);
  });

  it('carries the revealed hole card IDENTITY as knownDealerHole — absent while hidden, the exact card once revealed (06-REVIEW CR-01, BJ-06)', () => {
    // Pool exclusion alone conditions on "the hole is some card OTHER than the revealed
    // one" — the contradiction of what the user can see. The revealed hole must travel
    // to the trial loop as the dealer's ACTUAL hole, not merely leave the pool.
    const hidden = deriveBlackjackConditionedState(round, playerHand, false, 1);
    expect(hidden.knownDealerHole).toBeUndefined();

    const revealed = deriveBlackjackConditionedState(round, playerHand, true, 1);
    expect(revealed.knownDealerHole).toBe(round.dealerHole);
  });

  it('at deckCount=2 the sibling copy of a card the player AND the hole both hold legitimately remains (count-aware subtraction, not value-collapse)', () => {
    const sharedValueRound: PredeterminedBlackjackRound = { dealerUpcard: '5d', dealerHole: 'As' };
    const sharedValueHand: Card[] = ['As', '7c'];

    const hidden = deriveBlackjackConditionedState(sharedValueRound, sharedValueHand, false, 2);
    // 104 minus the player's 2 cards and the upcard; the hidden hole is NOT removed.
    expect(hidden.remainingDeck).toHaveLength(shoeSize(2) - 3);
    // The player holds one physical 'As'; the second copy stays in the pool (the hidden
    // hole's copy is deliberately not subtracted while face-down).
    expect(hidden.remainingDeck.filter((card) => card === 'As')).toHaveLength(1);

    const revealed = deriveBlackjackConditionedState(sharedValueRound, sharedValueHand, true, 2);
    expect(revealed.remainingDeck).toHaveLength(shoeSize(2) - 4);
    expect(revealed.remainingDeck.filter((card) => card === 'As')).toHaveLength(0);
  });
});

describe('liveShoeLedger — the live-draw reader (D-01, D-11)', () => {
  it('NEVER contains the predetermined hole card — its signature has no revealedHole parameter, so reveal state cannot change its output by construction', () => {
    // There is deliberately no revealed/hidden variant to pass: calling it "before" and
    // "after" a reveal is the same call, and both exclude the hole (a real, already-dealt
    // physical card).
    const ledgerWhileHidden = liveShoeLedger(round, playerHand, [], 1);
    const ledgerAfterReveal = liveShoeLedger(round, playerHand, [], 1);

    expect(ledgerWhileHidden).not.toContain(round.dealerHole);
    expect(ledgerAfterReveal).toEqual(ledgerWhileHidden);
    expect(ledgerWhileHidden).toHaveLength(shoeSize(1) - playerHand.length - 2);
  });

  it('additionally removes every card in liveDrawnSoFar', () => {
    const liveDrawn: Card[] = [FULL_DECK[4], FULL_DECK[5]];
    const ledger = liveShoeLedger(round, playerHand, liveDrawn, 1);

    expect(ledger).toHaveLength(shoeSize(1) - playerHand.length - 2 - liveDrawn.length);
    expect(ledger).not.toContain(liveDrawn[0]);
    expect(ledger).not.toContain(liveDrawn[1]);
  });

  it.each<{ deckCount: DeckCount }>([{ deckCount: 1 }, { deckCount: 2 }])(
    'coincides with the odds pool ONLY once the hole is revealed (deckCount $deckCount, no live draws)',
    ({ deckCount }) => {
      const ledger = liveShoeLedger(round, playerHand, [], deckCount);
      const revealedOdds = deriveBlackjackConditionedState(round, playerHand, true, deckCount);
      const hiddenOdds = deriveBlackjackConditionedState(round, playerHand, false, deckCount);

      // Same exclusion set, same deterministic shoeWithout walk order — exact equality.
      expect(ledger).toEqual(revealedOdds.remainingDeck);
      // While hidden the two sets are structurally DIFFERENT — the whole point of the
      // dual-exclusion-set rule.
      expect(ledger.length).toBe(hiddenOdds.remainingDeck.length - 1);
    },
  );
});

describe('resolveNaturals — deal-time natural resolution (D-03, D-03a)', () => {
  it('player natural vs. dealer 18 resolves immediately as a win', () => {
    expect(resolveNaturals({ dealerUpcard: '9d', dealerHole: '6s' }, ['Ah', 'Kc'])).toEqual({
      resolved: true,
      outcome: 'win',
      playerNatural: true,
      dealerNatural: false,
    });
  });

  it('both naturals push', () => {
    expect(resolveNaturals({ dealerUpcard: 'Ac', dealerHole: 'Ks' }, ['Ah', 'Kc'])).toEqual({
      resolved: true,
      outcome: 'push',
      playerNatural: true,
      dealerNatural: true,
    });
  });

  it('a dealer-only natural resolves immediately as a loss (D-03a)', () => {
    expect(resolveNaturals({ dealerUpcard: 'Ac', dealerHole: 'Ks' }, ['9h', '9c'])).toEqual({
      resolved: true,
      outcome: 'lose',
      playerNatural: false,
      dealerNatural: true,
    });
  });

  it('neither natural leaves the round unresolved', () => {
    expect(resolveNaturals({ dealerUpcard: '9d', dealerHole: '6s' }, ['Ah', '8c'])).toEqual({
      resolved: false,
      outcome: null,
      playerNatural: false,
      dealerNatural: false,
    });
  });

  it('never reports a natural for a 3-card 21 — the 2-card guard holds even if handed a longer hand', () => {
    expect(resolveNaturals({ dealerUpcard: '9d', dealerHole: '6s' }, ['7h', '7c', '7d'])).toEqual({
      resolved: false,
      outcome: null,
      playerNatural: false,
      dealerNatural: false,
    });
  });
});
