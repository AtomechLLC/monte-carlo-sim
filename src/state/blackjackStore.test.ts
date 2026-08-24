import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { ALL_CARDS } from '@poker-apprentice/types';
import { useBlackjackStore } from './blackjackStore';
import { useBlackjackOddsStore } from './blackjackOddsStore';
import { useUiStore } from './uiStore';
import { drawN } from '../engine/rng';
import { cardCounts } from '../engine/shoe';
import type { DeckCount } from '../engine/shoe';
import { liveShoeLedger } from '../engine/blackjackConditioning';
import { handTotal, classifyDealerOutcome, compareToDealer } from '../engine/blackjackHandValue';
import type { BlackjackProgressSnapshot } from '../worker/blackjackProtocol';

// Wrap drawN in a spy-able vi.fn that defaults to the REAL implementation, so ordinary
// tests draw genuinely random cards while natural/bust-path tests can force exact deals
// via mockReturnValueOnce (the plan's sanctioned "spy or wrapper" seam for the
// single-draw-call assertion and the deterministic natural-resolution cases).
vi.mock('../engine/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/rng')>();
  return {
    ...actual,
    drawN: vi.fn(actual.drawN),
  };
});

const actualRng = await vi.importActual<typeof import('../engine/rng')>('../engine/rng');
const drawNMock = vi.mocked(drawN);

/** A fully self-consistent settled snapshot for seeding the odds store's live display. */
function makeSnapshot(overrides: Partial<BlackjackProgressSnapshot> = {}): BlackjackProgressSnapshot {
  return {
    requestId: 1,
    dealerOutcomeCounts: [20, 15, 15, 15, 10, 5, 20],
    bustIfHitCount: 30,
    standOutcomes: { win: 40, push: 10, lose: 50 },
    hitOutcomes: { win: 30, push: 10, lose: 60 },
    trialsCompleted: 100,
    done: true,
    ...overrides,
  };
}

const IDLE_STATE = {
  round: null,
  playerHand: [] as Card[],
  dealerPlayoutCards: [] as Card[],
  roundPhase: 'idle' as const,
  revealedHole: false,
  outcome: null,
  playerNaturalWin: false,
  deckCount: 1 as DeckCount,
  roundNonce: 0,
};

let armSpy: MockInstance;

beforeEach(() => {
  useBlackjackStore.setState({ ...IDLE_STATE });
  // Placed AFTER the round-state reset (mirrors every existing store-test harness): a
  // reset must never leave a stale armed count behind from a previous test.
  useUiStore.getState().resetAnimations();
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().setDisplayedDeckCount(1);
  drawNMock.mockReset();
  drawNMock.mockImplementation(actualRng.drawN);
  // vi.spyOn returns the SAME spy when the method is already spied (every test after the
  // first), so clear its accumulated calls to keep per-test arm counts accurate.
  armSpy = vi.spyOn(useUiStore.getState(), 'beginAnimation');
  armSpy.mockClear();
});

function arms(): number {
  return armSpy.mock.calls.length;
}

/** Seeds a deterministic mid-round (player-turn) state directly, the harness precedent. */
function seedPlayerTurn(
  overrides: Partial<{
    playerHand: Card[];
    dealerUpcard: Card;
    dealerHole: Card;
    deckCount: DeckCount;
  }> = {},
) {
  const dealerUpcard = overrides.dealerUpcard ?? '9d';
  const dealerHole = overrides.dealerHole ?? '6s';
  useBlackjackStore.setState({
    round: { dealerUpcard, dealerHole },
    playerHand: overrides.playerHand ?? ['Kh', 'Qc'],
    dealerPlayoutCards: [],
    roundPhase: 'player-turn',
    revealedHole: false,
    outcome: null,
    playerNaturalWin: false,
    deckCount: overrides.deckCount ?? 1,
    roundNonce: 1,
  });
}

describe('deal() — single-shuffle draw and natural resolution (D-01, D-03, D-03a)', () => {
  it('draws all four initial cards from ONE drawN call, pairwise distinct at deckCount=1', () => {
    useBlackjackStore.getState().deal();

    expect(drawNMock).toHaveBeenCalledTimes(1);
    expect(drawNMock.mock.calls[0][2]).toBe(4);

    const { playerHand, round } = useBlackjackStore.getState();
    const dealt = [...playerHand, round!.dealerUpcard, round!.dealerHole];
    expect(dealt).toHaveLength(4);
    expect(new Set(dealt).size).toBe(4);
  });

  it('with neither side natural: player-turn, no outcome, hole hidden', () => {
    drawNMock.mockReturnValueOnce(['9h', '9c', '9d', '6s']);
    useBlackjackStore.getState().deal();

    const state = useBlackjackStore.getState();
    expect(state.roundPhase).toBe('player-turn');
    expect(state.outcome).toBeNull();
    expect(state.revealedHole).toBe(false);
    expect(state.playerNaturalWin).toBe(false);
    expect(state.playerHand).toEqual(['9h', '9c']);
    expect(state.round).toEqual({ dealerUpcard: '9d', dealerHole: '6s' });
  });

  it('with a player-only natural: resolved win at 3:2, hole revealed', () => {
    drawNMock.mockReturnValueOnce(['Ah', 'Kc', '9d', '6s']);
    useBlackjackStore.getState().deal();

    const state = useBlackjackStore.getState();
    expect(state.roundPhase).toBe('resolved');
    expect(state.outcome).toBe('win');
    expect(state.playerNaturalWin).toBe(true);
    expect(state.revealedHole).toBe(true);
  });

  it('with a dealer-only natural: resolved loss, hole revealed (D-03a)', () => {
    drawNMock.mockReturnValueOnce(['9h', '9c', 'Ac', 'Ks']);
    useBlackjackStore.getState().deal();

    const state = useBlackjackStore.getState();
    expect(state.roundPhase).toBe('resolved');
    expect(state.outcome).toBe('lose');
    expect(state.playerNaturalWin).toBe(false);
    expect(state.revealedHole).toBe(true);
  });

  it('with both naturals: resolved push, hole revealed', () => {
    drawNMock.mockReturnValueOnce(['Ah', 'Kc', 'Ad', 'Qs']);
    useBlackjackStore.getState().deal();

    const state = useBlackjackStore.getState();
    expect(state.roundPhase).toBe('resolved');
    expect(state.outcome).toBe('push');
    expect(state.playerNaturalWin).toBe(false);
    expect(state.revealedHole).toBe(true);
  });

  it('always bumps roundNonce, arms exactly one gate unit, clears the cache, zeroes the display and snapshots displayedDeckCount', () => {
    useBlackjackStore.setState({ deckCount: 2 });
    const odds = useBlackjackOddsStore.getState();
    odds.applySnapshot(makeSnapshot());
    odds.cacheIfSettled(2, false, makeSnapshot());
    expect(useBlackjackOddsStore.getState().displayedDeckCount).toBe(1);

    const nonceBefore = useBlackjackStore.getState().roundNonce;
    useBlackjackStore.getState().deal();

    expect(useBlackjackStore.getState().roundNonce).toBe(nonceBefore + 1);
    expect(arms()).toBe(1);
    const oddsAfter = useBlackjackOddsStore.getState();
    expect(oddsAfter.settledCache.size).toBe(0);
    expect(oddsAfter.trialsCompleted).toBe(0);
    // A new round runs under the current shoe (A3 snapshot rule).
    expect(oddsAfter.displayedDeckCount).toBe(2);
  });

  it('dealing into a natural from a settled odds state leaves the display in the zero-trials state (A16, D-03a)', () => {
    // Seed a fully converged, settled display from a previous round.
    const odds = useBlackjackOddsStore.getState();
    odds.applySnapshot(makeSnapshot());
    odds.cacheIfSettled(2, false, makeSnapshot());
    expect(useBlackjackOddsStore.getState().trialsCompleted).toBe(100);

    // The natural round starts NO simulation, so nothing downstream will ever zero the
    // display — deal() itself must do it.
    drawNMock.mockReturnValueOnce(['Ah', 'Kc', '9d', '6s']);
    useBlackjackStore.getState().deal();

    const after = useBlackjackOddsStore.getState();
    expect(useBlackjackStore.getState().roundPhase).toBe('resolved');
    expect(after.trialsCompleted).toBe(0);
    expect(after.dealerOutcomeCounts).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(after.bustIfHitCount).toBe(0);
    expect(after.standOutcomes).toEqual({ win: 0, push: 0, lose: 0 });
    expect(after.hitOutcomes).toEqual({ win: 0, push: 0, lose: 0 });
    expect(after.done).toBe(false);
    expect(after.settledCache.size).toBe(0);
    // deal() arms unconditionally — the four cards still fly in on a natural (CR-02 class).
    expect(arms()).toBe(1);
  });

  it('mid-round deal silently abandons and starts a fresh round (A2)', () => {
    drawNMock.mockReturnValueOnce(['9h', '9c', '9d', '6s']);
    useBlackjackStore.getState().deal();
    useBlackjackStore.getState().hit(); // real random hit card
    const nonceBefore = useBlackjackStore.getState().roundNonce;

    drawNMock.mockReturnValueOnce(['7h', '8c', 'Td', '5s']);
    useBlackjackStore.getState().deal();

    const state = useBlackjackStore.getState();
    expect(state.roundNonce).toBe(nonceBefore + 1);
    expect(state.playerHand).toHaveLength(2);
    expect(state.dealerPlayoutCards).toEqual([]);
    expect(state.revealedHole).toBe(false);
    expect(state.roundPhase).toBe('player-turn');
  });

  it('deal from a resolved round also starts fresh', () => {
    drawNMock.mockReturnValueOnce(['Ah', 'Kc', '9d', '6s']); // resolves at deal
    useBlackjackStore.getState().deal();
    expect(useBlackjackStore.getState().roundPhase).toBe('resolved');

    drawNMock.mockReturnValueOnce(['7h', '8c', 'Td', '5s']);
    useBlackjackStore.getState().deal();
    expect(useBlackjackStore.getState().roundPhase).toBe('player-turn');
    expect(useBlackjackStore.getState().revealedHole).toBe(false);
  });
});

describe('hit() — live-ledger draws with conditional arming (D-11, D-13, T-06-18)', () => {
  it('is a no-op with no arm unless roundPhase is player-turn', () => {
    const idleBefore = useBlackjackStore.getState();
    useBlackjackStore.getState().hit();
    expect(useBlackjackStore.getState()).toBe(idleBefore);
    expect(arms()).toBe(0);

    seedPlayerTurn();
    useBlackjackStore.setState({ roundPhase: 'resolved', outcome: 'lose', revealedHole: true });
    const resolvedBefore = useBlackjackStore.getState();
    useBlackjackStore.getState().hit();
    expect(useBlackjackStore.getState()).toBe(resolvedBefore);
    expect(arms()).toBe(0);
  });

  it('appends exactly one card drawn from liveShoeLedger and arms exactly once', () => {
    drawNMock.mockReturnValueOnce(['9h', '9c', '9d', '6s']);
    useBlackjackStore.getState().deal();
    armSpy.mockClear();
    const { round, playerHand: handBefore, deckCount } = useBlackjackStore.getState();

    useBlackjackStore.getState().hit();

    const state = useBlackjackStore.getState();
    expect(state.playerHand).toHaveLength(3);
    expect(state.playerHand.slice(0, 2)).toEqual(handBefore);
    expect(arms()).toBe(1);

    // The pool handed to the draw is EXACTLY the live ledger — the hidden hole card is
    // already spent in it, so it is physically impossible for a hit to re-deal it.
    const hitCall = drawNMock.mock.calls[drawNMock.mock.calls.length - 1];
    expect(hitCall[2]).toBe(1);
    expect(hitCall[1]).toEqual(liveShoeLedger(round!, handBefore, [], deckCount));
    expect(hitCall[1]).not.toContain(round!.dealerHole);
  });

  it('a bust resolves the round in the SAME set(): lose + hole revealed, one arm', () => {
    seedPlayerTurn({ playerHand: ['Kh', 'Qc'] }); // 20
    drawNMock.mockReturnValueOnce(['Kd']); // forces 30 — bust

    useBlackjackStore.getState().hit();

    const state = useBlackjackStore.getState();
    expect(state.playerHand).toEqual(['Kh', 'Qc', 'Kd']);
    expect(state.roundPhase).toBe('resolved');
    expect(state.outcome).toBe('lose');
    expect(state.revealedHole).toBe(true);
    expect(arms()).toBe(1);
  });

  it('can never draw the predetermined hole card — the ledger spends it, leaving the pool empty, not "the hole card"', () => {
    const HOLE: Card = 'As';
    const UPCARD: Card = 'Qh';

    // Force every card except the hole onto the table: the odds-style pool would contain
    // exactly [the hole card]; the live ledger must instead be EMPTY (T-06-18).
    const everythingElse = ALL_CARDS.filter((card) => card !== HOLE && card !== UPCARD);
    useBlackjackStore.setState({
      round: { dealerUpcard: UPCARD, dealerHole: HOLE },
      playerHand: [...everythingElse],
      dealerPlayoutCards: [],
      roundPhase: 'player-turn',
      revealedHole: false,
      deckCount: 1,
    });
    const state = useBlackjackStore.getState();
    expect(liveShoeLedger(state.round!, state.playerHand, state.dealerPlayoutCards, 1)).toEqual([]);

    // Behavioral reinforcement: leave exactly ONE legal card. A ledger draw must always
    // produce that card; a buggy odds-pool draw would produce the hole card ~half the time.
    const LAST: Card = 'Kd';
    const handCards = ALL_CARDS.filter((card) => card !== HOLE && card !== UPCARD && card !== LAST);
    for (let i = 0; i < 10; i++) {
      useBlackjackStore.setState({
        round: { dealerUpcard: UPCARD, dealerHole: HOLE },
        playerHand: [...handCards],
        dealerPlayoutCards: [],
        roundPhase: 'player-turn',
        revealedHole: false,
        outcome: null,
        deckCount: 1,
        roundNonce: 1,
      });
      useBlackjackStore.getState().hit();
      const hand = useBlackjackStore.getState().playerHand;
      expect(hand[hand.length - 1]).toBe(LAST);
      expect(hand[hand.length - 1]).not.toBe(HOLE);
    }
  });
});

describe('stand() — dealer playout from the live ledger (D-04, D-11)', () => {
  it('is a no-op with no arm unless roundPhase is player-turn', () => {
    const idleBefore = useBlackjackStore.getState();
    useBlackjackStore.getState().stand();
    expect(useBlackjackStore.getState()).toBe(idleBefore);
    expect(arms()).toBe(0);

    seedPlayerTurn();
    useBlackjackStore.getState().stand();
    armSpy.mockClear();
    const resolvedBefore = useBlackjackStore.getState();
    useBlackjackStore.getState().stand(); // Stand after Stand
    expect(useBlackjackStore.getState()).toBe(resolvedBefore);
    expect(arms()).toBe(0);
  });

  it('reveals the hole, plays the dealer out to 17+ (or bust), stores the playout, resolves, arms once', () => {
    seedPlayerTurn({ playerHand: ['Kh', 'Qc'], dealerUpcard: '9d', dealerHole: '6s' }); // dealer 15 must draw
    useBlackjackStore.getState().stand();

    const state = useBlackjackStore.getState();
    expect(state.revealedHole).toBe(true);
    expect(state.roundPhase).toBe('resolved');
    expect(state.dealerPlayoutCards.length).toBeGreaterThanOrEqual(1);
    expect(arms()).toBe(1);

    const dealerCards = [state.round!.dealerUpcard, state.round!.dealerHole, ...state.dealerPlayoutCards];
    const dealerResult = handTotal(dealerCards);
    // S17: the dealer finished at 17+ or busted — never stopped below 17.
    expect(dealerResult.bust || dealerResult.total >= 17).toBe(true);

    // The stored outcome is exactly the engine comparison of the two final hands.
    const expected = compareToDealer(handTotal(state.playerHand), {
      total: dealerResult.total,
      bust: dealerResult.bust,
      bucket: classifyDealerOutcome(dealerCards, dealerResult),
    });
    expect(state.outcome).toBe(expected);
  });
});

describe('full-round shoe integrity — count-aware no-duplicate (D-11, DECK-03)', () => {
  it.each([1, 2] as const)('no card appears more often than deckCount=%i permits across a full round', (deckCount) => {
    for (let i = 0; i < 15; i++) {
      useBlackjackStore.setState({ ...IDLE_STATE, deckCount });
      useBlackjackStore.getState().deal();
      // Hit up to twice while still in player-turn (a bust ends the round early).
      for (let hits = 0; hits < 2 && useBlackjackStore.getState().roundPhase === 'player-turn'; hits++) {
        useBlackjackStore.getState().hit();
      }
      if (useBlackjackStore.getState().roundPhase === 'player-turn') {
        useBlackjackStore.getState().stand();
      }

      const state = useBlackjackStore.getState();
      const table = [
        ...state.playerHand,
        state.round!.dealerUpcard,
        state.round!.dealerHole,
        ...state.dealerPlayoutCards,
      ];
      for (const [card, count] of cardCounts(table)) {
        expect(count, `${card} appeared ${count} times at deckCount=${deckCount}`).toBeLessThanOrEqual(deckCount);
      }
    }
  });
});

describe('revealHole() — one-way per round, conditional arming (D-14, BJ-06)', () => {
  it('reveals during player-turn and arms exactly once; a second call arms nothing', () => {
    seedPlayerTurn();
    useBlackjackStore.getState().revealHole();
    expect(useBlackjackStore.getState().revealedHole).toBe(true);
    expect(arms()).toBe(1);

    useBlackjackStore.getState().revealHole(); // monotonic — already revealed
    expect(useBlackjackStore.getState().revealedHole).toBe(true);
    expect(arms()).toBe(1);
  });

  it('is a no-op with no arm while idle or resolved', () => {
    useBlackjackStore.getState().revealHole();
    expect(useBlackjackStore.getState().revealedHole).toBe(false);
    expect(arms()).toBe(0);

    seedPlayerTurn();
    useBlackjackStore.setState({ roundPhase: 'resolved', outcome: 'lose' });
    useBlackjackStore.getState().revealHole();
    expect(useBlackjackStore.getState().revealedHole).toBe(false);
    expect(arms()).toBe(0);
  });
});

describe('setDeckCount() — A3 semantics: unconditional cache clear, phase-gated display reset (BJ-07, D-12, A16)', () => {
  it('during player-turn: clears the cache, zeroes the live display, moves displayedDeckCount, never arms', () => {
    seedPlayerTurn();
    const odds = useBlackjackOddsStore.getState();
    odds.applySnapshot(makeSnapshot());
    odds.cacheIfSettled(2, false, makeSnapshot());

    useBlackjackStore.getState().setDeckCount(2);

    expect(useBlackjackStore.getState().deckCount).toBe(2);
    const after = useBlackjackOddsStore.getState();
    expect(after.settledCache.size).toBe(0);
    expect(after.trialsCompleted).toBe(0);
    expect(after.dealerOutcomeCounts).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(after.displayedDeckCount).toBe(2);
    expect(arms()).toBe(0);
  });

  it('while resolved: leaves every live display field byte-identical AND displayedDeckCount untouched, but still empties the cache', () => {
    seedPlayerTurn();
    useBlackjackStore.setState({ roundPhase: 'resolved', outcome: 'win', revealedHole: true });
    const odds = useBlackjackOddsStore.getState();
    odds.applySnapshot(makeSnapshot());
    odds.cacheIfSettled(3, true, makeSnapshot());
    const before = useBlackjackOddsStore.getState();

    useBlackjackStore.getState().setDeckCount(2);

    expect(useBlackjackStore.getState().deckCount).toBe(2);
    const after = useBlackjackOddsStore.getState();
    // Retained numbers survive untouched — reference-identical, not merely deep-equal (A16).
    expect(after.dealerOutcomeCounts).toBe(before.dealerOutcomeCounts);
    expect(after.bustIfHitCount).toBe(before.bustIfHitCount);
    expect(after.standOutcomes).toBe(before.standOutcomes);
    expect(after.hitOutcomes).toBe(before.hitOutcomes);
    expect(after.trialsCompleted).toBe(before.trialsCompleted);
    expect(after.done).toBe(before.done);
    // The subtitle keeps naming the shoe the retained numbers were computed under (A3, FLAG 1).
    expect(after.displayedDeckCount).toBe(1);
    // The cache guarantee still holds: the NEXT deal re-runs under the new shoe (BJ-07).
    expect(after.settledCache.size).toBe(0);
    expect(arms()).toBe(0);
  });

  it('while idle: same retention semantics as resolved', () => {
    const odds = useBlackjackOddsStore.getState();
    odds.applySnapshot(makeSnapshot());
    odds.cacheIfSettled(2, false, makeSnapshot());
    const before = useBlackjackOddsStore.getState();

    useBlackjackStore.getState().setDeckCount(2);

    const after = useBlackjackOddsStore.getState();
    expect(after.dealerOutcomeCounts).toBe(before.dealerOutcomeCounts);
    expect(after.trialsCompleted).toBe(before.trialsCompleted);
    expect(after.displayedDeckCount).toBe(1);
    expect(after.settledCache.size).toBe(0);
    expect(arms()).toBe(0);
  });

  it('with the value already selected: a harmless no-op that does not arm and keeps the cache', () => {
    const odds = useBlackjackOddsStore.getState();
    odds.cacheIfSettled(2, false, makeSnapshot());
    const before = useBlackjackStore.getState();

    useBlackjackStore.getState().setDeckCount(1);

    expect(useBlackjackStore.getState()).toBe(before);
    expect(useBlackjackOddsStore.getState().settledCache.size).toBe(1);
    expect(arms()).toBe(0);
  });
});

describe('gate-balance invariant — every armed unit has exactly one release (D-13, 05-REVIEW CR-02)', () => {
  it('over deal -> hit -> hit -> reveal -> stand, arms equal tracked-dep changes', () => {
    // Scripted, bust-free sequence: low player cards, dealer 16 (must draw on stand).
    drawNMock.mockReturnValueOnce(['2h', '3d', '7s', '9c']); // deal
    drawNMock.mockReturnValueOnce(['2c']); // hit 1 -> 7
    drawNMock.mockReturnValueOnce(['3h']); // hit 2 -> 10
    // reveal draws nothing; stand uses the real shuffle.

    type Tracked = { roundNonce: number; handLength: number; roundPhase: string; revealedHole: boolean };
    const snapshotTracked = (): Tracked => {
      const state = useBlackjackStore.getState();
      return {
        roundNonce: state.roundNonce,
        handLength: state.playerHand.length,
        roundPhase: state.roundPhase,
        revealedHole: state.revealedHole,
      };
    };

    let prev = snapshotTracked();
    let releases = 0;
    const runAndTrack = (action: () => void) => {
      action();
      const next = snapshotTracked();
      // BlackjackTable's release effect fires exactly once per commit in which any
      // tracked dep changed (the prevRef pattern) — simulate that accounting here.
      if (
        next.roundNonce !== prev.roundNonce ||
        next.handLength !== prev.handLength ||
        next.roundPhase !== prev.roundPhase ||
        next.revealedHole !== prev.revealedHole
      ) {
        releases += 1;
      }
      prev = next;
    };

    runAndTrack(() => useBlackjackStore.getState().deal());
    runAndTrack(() => useBlackjackStore.getState().hit());
    runAndTrack(() => useBlackjackStore.getState().hit());
    runAndTrack(() => useBlackjackStore.getState().revealHole());
    runAndTrack(() => useBlackjackStore.getState().stand());

    expect(useBlackjackStore.getState().playerHand).toEqual(['2h', '3d', '2c', '3h']);
    expect(useBlackjackStore.getState().roundPhase).toBe('resolved');
    expect(arms()).toBe(5);
    expect(releases).toBe(5);
    // Balanced by construction: after the simulated releases the gate would sit at zero.
    expect(useUiStore.getState().pendingAnimationCount - releases).toBe(0);
  });
});
