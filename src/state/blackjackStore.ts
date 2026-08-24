import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { createRng, drawN } from '../engine/rng';
import { shoeWithout } from '../engine/shoe';
import type { DeckCount } from '../engine/shoe';
import { hasPhysicalDuplicate, liveShoeLedger, resolveNaturals } from '../engine/blackjackConditioning';
import type { BlackjackOutcome, PredeterminedBlackjackRound } from '../engine/blackjackConditioning';
import {
  classifyDealerOutcome,
  compareToDealer,
  handTotal,
  playDealerHand,
} from '../engine/blackjackHandValue';
import { useBlackjackOddsStore } from './blackjackOddsStore';
import { useUiStore } from './uiStore';

/**
 * Round phase (D-10). Closed literal union, mirroring `DeckCount`'s style in
 * `../engine/shoe` — never an enum, never a boolean pair.
 */
export type BlackjackRoundPhase = 'idle' | 'player-turn' | 'resolved';

// This store may import only uiStore (the animation gate), its own odds store and engine
// modules (D-10). It must never import any Hold'em store, and never the picker — blackjack
// is random-deal-only this phase (D-03b).

interface BlackjackState {
  /** The dealer's predetermined cards (upcard + face-down hole), or `null` before the first deal (D-01). */
  round: PredeterminedBlackjackRound | null;
  /** The player's initial two cards plus every hit card, in draw order (D-01). */
  playerHand: Card[];
  /** Cards the dealer drew AFTER the hole, during a Stand playout — live draws, never predetermined (D-01). */
  dealerPlayoutCards: Card[];
  /** Where the round lifecycle stands (D-03): idle before any deal, player-turn only when neither side dealt a natural, resolved after naturals/bust/stand. */
  roundPhase: BlackjackRoundPhase;
  /** One-way per round (D-14, BJ-06): set by revealHole()/stand()/resolution, reset ONLY by deal(). There is deliberately no un-reveal action. */
  revealedHole: boolean;
  /** Set only when roundPhase === 'resolved' (D-03, D-03a). */
  outcome: BlackjackOutcome | null;
  /** True only for the 3:2 player-natural path — drives the banner copy, never the odds (D-03). */
  playerNaturalWin: boolean;
  /** Blackjack-LOCAL shoe size (D-10) — lives here, never in the cross-game mode store. */
  deckCount: DeckCount;
  /**
   * Increments on every `deal()`; doubles as the simulation identity counter —
   * deliberately a single counter, not two. Also the card keys' re-mount nonce, so a
   * re-deal always unmounts/remounts, never morphs an in-flight card (A2).
   */
  roundNonce: number;
  /** Draws a fresh round (2 player cards + upcard + predetermined hole) and resolves naturals at deal (D-01, D-03, D-03a). */
  deal: () => void;
  /** Draws one live card from the shoe ledger; a bust resolves the round in the same commit (BJ-05). */
  hit: () => void;
  /** Reveals the hole, plays the dealer out under S17 from the shoe ledger, resolves (BJ-05, D-04). */
  stand: () => void;
  /** Early one-way hole reveal (BJ-06, D-14). */
  revealHole: () => void;
  /** Switches the blackjack-local shoe between 1 and 2 decks with UI-SPEC A3 semantics (BJ-07, D-12). */
  setDeckCount: (deckCount: DeckCount) => void;
}

export const useBlackjackStore = create<BlackjackState>()((set, get) => ({
  round: null,
  playerHand: [],
  dealerPlayoutCards: [],
  roundPhase: 'idle',
  revealedHole: false,
  outcome: null,
  playerNaturalWin: false,
  deckCount: 1,
  roundNonce: 0,
  deal: () => {
    const { deckCount } = get();
    // Single-shuffle discipline (D-01): ALL four initial cards come from ONE drawN call
    // over the full shoe. Never draw a second time for a different slot category —
    // independent draws from the same starting pool can collide (the Hold'em deal's own
    // documented rule, carried in spirit). createRng() with NO seed: real,
    // non-reproducible-by-design draws, the same convention the Hold'em deal uses.
    const rng = createRng();
    const [p0, p1, upcard, hole] = drawN(rng, shoeWithout(deckCount, []), 4);
    const round: PredeterminedBlackjackRound = { dealerUpcard: upcard, dealerHole: hole };
    const playerHand: Card[] = [p0, p1];
    // resolveNaturals is the sole deal-time raw-hole reader for OUTCOME purposes
    // (D-03, D-03a): EITHER side's natural resolves the round before any player turn.
    const naturals = resolveNaturals(round, playerHand);

    set({
      round,
      playerHand,
      dealerPlayoutCards: [],
      roundPhase: naturals.resolved ? 'resolved' : 'player-turn',
      // A natural on either side reveals the hole as part of resolution (D-03a).
      revealedHole: naturals.resolved,
      outcome: naturals.outcome,
      playerNaturalWin: naturals.playerNatural && !naturals.dealerNatural,
      roundNonce: get().roundNonce + 1,
    });
    // Arm the animation gate synchronously alongside the state write above (same tick,
    // one render) — deal() always animates, UNCONDITIONALLY, including when a natural
    // resolves the round at once: the four cards still fly in, and BlackjackTable's
    // release effect will fire on the roundNonce change regardless — an unarmed release
    // would steal a card's own freshly-registered unit (05-REVIEW CR-02's failure
    // class). Armed BEFORE the odds store is touched, so a stale odds effect can never
    // observe an already-open gate before the newly mounted cards register (the
    // 03-RESEARCH Pitfall 2 ordering the Hold'em deal documents).
    useUiStore.getState().beginAnimation();
    const odds = useBlackjackOddsStore.getState();
    // A fresh round must never serve the previous round's settled numbers.
    odds.clearCache();
    // reset() is UNCONDITIONAL — including on the natural-resolved path. The Hold'em
    // deal needs no equivalent because its deal always starts a run that resets the
    // display on its own; a blackjack deal may resolve on a natural and start NO run
    // (the odds effect returns at its roundPhase gate), so deal() itself must zero the
    // display, or A16's zero-trials state is never reached and the previous round's
    // converged percentages would sit next to the new outcome banner (D-03a, A16).
    odds.reset();
    // A new round runs under the current shoe (UI-SPEC A3 snapshot rule).
    odds.setDisplayedDeckCount(deckCount);
  },
  hit: () => {
    const { roundPhase, round, playerHand, dealerPlayoutCards, deckCount } = get();
    // Conditional arming (D-13): guard on "did state actually change" — arming a no-op
    // would increment a count nothing will ever release, deadlocking the odds effect
    // permanently.
    if (roundPhase !== 'player-turn' || round === null) return;
    // Every real draw comes from liveShoeLedger — NEVER from the odds-conditioning
    // pool. The odds pool deliberately keeps the hidden hole card in play (so trials
    // resample it as unknown); drawing a live card from it would let a real hit
    // physically re-deal the hole card (06-RESEARCH Pattern 1). This store never calls
    // the odds-conditioning reader at all — that reader belongs to the odds effect.
    const ledger = liveShoeLedger(round, playerHand, dealerPlayoutCards, deckCount);
    const [card] = drawN(createRng(), ledger, 1);
    const nextHand = [...playerHand, card];
    // A bust resolves in the SAME set() as the card append — one commit, one release
    // (D-13). The round is over, so the bust also reveals the hole (D-03).
    if (handTotal(nextHand).bust) {
      set({ playerHand: nextHand, roundPhase: 'resolved', outcome: 'lose', revealedHole: true });
    } else {
      set({ playerHand: nextHand });
    }
    useUiStore.getState().beginAnimation();
  },
  stand: () => {
    const { roundPhase, round, playerHand, dealerPlayoutCards, deckCount } = get();
    // Same conditional-arming rationale as hit(): Stand after Stand is a no-op.
    if (roundPhase !== 'player-turn' || round === null) return;
    // Draw strategy: shuffle the ENTIRE remaining live ledger once (one
    // without-replacement drawN over the full pool) and thread playDealerHand's
    // drawNext through a cursor over that single pre-drawn slice. One shuffle means no
    // card can ever be drawn twice within the playout, and the dealer can never
    // outdraw the pool it came from — the count-aware no-duplicate property holds by
    // construction. The ledger (not the odds pool) is the source, so the hole card the
    // dealer is about to flip is already spent and unreachable (06-RESEARCH Pattern 1).
    const ledger = liveShoeLedger(round, playerHand, dealerPlayoutCards, deckCount);
    const shuffled = drawN(createRng(), ledger, ledger.length);
    let cursor = 0;
    const { cards, result } = playDealerHand(round.dealerUpcard, round.dealerHole, () => shuffled[cursor++]);
    const playout = cards.slice(2); // everything drawn AFTER the upcard + hole
    const bucket = classifyDealerOutcome(cards, result);
    const outcome = compareToDealer(handTotal(playerHand), {
      total: result.total,
      bust: result.bust,
      bucket,
    });
    set({
      revealedHole: true,
      dealerPlayoutCards: playout,
      outcome,
      roundPhase: 'resolved',
    });
    useUiStore.getState().beginAnimation();
  },
  revealHole: () => {
    const { roundPhase, revealedHole } = get();
    // Monotonic one-way reveal per round (D-14), reset only by deal(). Conditional
    // arming: a second call, or a call outside player-turn, changes nothing and must
    // not arm — same rationale as hit()/stand().
    if (roundPhase !== 'player-turn' || revealedHole) return;
    set({ revealedHole: true });
    useUiStore.getState().beginAnimation();
  },
  setDeckCount: (deckCount) => {
    // The already-selected segment is a harmless no-op (UI-SPEC A3/A4, the
    // mode-switcher precedent): nothing changes, nothing arms, the cache stays.
    if (get().deckCount === deckCount) return;
    // 06-REVIEW WR-01: REFUSE a 2 -> 1 switch while the round's PHYSICAL cards —
    // including the face-down hole, a real dealt card (D-01) — hold a duplicate. Such a
    // table is impossible under one deck, and accepting the switch would silently
    // corrupt every later liveShoeLedger read (shoeWithout under-removes: table +
    // ledger = 53 cards) with no crash and quietly skewed odds. This store-boundary
    // refusal is the correctness guarantee; the control's disabled state (same
    // hasPhysicalDuplicate reader) is the surfaced half. A refused switch is a
    // COMPLETE no-op, exactly like the same-value branch above.
    const { round, playerHand, dealerPlayoutCards } = get();
    if (deckCount === 1 && round !== null && hasPhysicalDuplicate(round, playerHand, dealerPlayoutCards)) {
      return;
    }
    set({ deckCount });
    const odds = useBlackjackOddsStore.getState();
    // clearCache() is UNCONDITIONAL — outside the roundPhase gate below — so the NEXT
    // deal is guaranteed a fresh run under the new shoe rather than a settled snapshot
    // computed under the other one (BJ-07, D-12).
    odds.clearCache();
    // reset() and setDisplayedDeckCount() are gated on player-turn: during player-turn
    // a new run starts under the new shoe in the same frame, so blanking the stats and
    // moving the subtitle together IS the BJ-07 findability moment. During
    // idle/resolved no run starts — blanking would destroy A16's retained numbers, and
    // moving the subtitle would retitle numbers that came from the other shoe (A3
    // snapshot rule, checker FLAG 1).
    if (get().roundPhase === 'player-turn') {
      odds.reset();
      odds.setDisplayedDeckCount(deckCount);
    }
    // Deliberately NO beginAnimation(): a deck toggle is not a card animation (A3).
  },
}));
