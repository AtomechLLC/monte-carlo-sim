import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { useGameStore } from './gameStore';
import { useOddsStore } from './oddsStore';
import { usePickerStore } from './pickerStore';
import { useUiStore } from './uiStore';
import { FULL_DECK } from '../engine/cards';
import { cardCounts } from '../engine/shoe';
import type { ProgressSnapshot } from '../worker/protocol';

const EMPTY_PICKS = {
  'hero-0': null,
  'hero-1': null,
  'flop-0': null,
  'flop-1': null,
  'flop-2': null,
  turn: null,
  river: null,
} as const;

describe('gameStore — predetermined runout and street pointer', () => {
  beforeEach(() => {
    // deckCount MUST be reset to 1 here: without it a 2-deck test leaks into the
    // 1-deck-only distinct-cards assertion below, which is only valid at one deck.
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
    useUiStore.getState().resetAnimations();
  });

  it('starts with no runout, preflop street, no reveals, and dealNonce 0', () => {
    const state = useGameStore.getState();
    expect(state.runout).toBeNull();
    expect(state.street).toBe('preflop');
    expect(state.revealedMask).toBe(0);
    expect(state.dealNonce).toBe(0);
  });

  it('deal() produces a runout whose 13 cards are all distinct and all members of FULL_DECK', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    expect(runout).not.toBeNull();

    const allCards = [
      ...runout!.heroHole,
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];

    expect(allCards).toHaveLength(13);
    expect(new Set(allCards).size).toBe(13);
    for (const card of allCards) {
      expect(FULL_DECK).toContain(card);
    }
  });

  it('deal() resets street to preflop and revealedMask to 0, and increments dealNonce by exactly 1', () => {
    useGameStore.setState({ street: 'river', revealedMask: 0b101 });
    useGameStore.getState().deal();

    const state = useGameStore.getState();
    expect(state.street).toBe('preflop');
    expect(state.revealedMask).toBe(0);
    expect(state.dealNonce).toBe(1);
  });

  it('advanceStreet walks preflop -> flop -> turn -> river and is a no-op at river', () => {
    useGameStore.getState().deal();

    expect(useGameStore.getState().street).toBe('preflop');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('flop');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('turn');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
  });

  it('rewindStreet walks river -> turn -> flop -> preflop and is a no-op at preflop', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'river' });

    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('turn');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('flop');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
  });

  it('advancing to river, rewinding to preflop and advancing back to river leaves runout object-identical', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    expect(useGameStore.getState().runout).toBe(runout);

    useGameStore.getState().rewindStreet();
    useGameStore.getState().rewindStreet();
    useGameStore.getState().rewindStreet();
    expect(useGameStore.getState().street).toBe('preflop');
    expect(useGameStore.getState().runout).toBe(runout);

    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    useGameStore.getState().advanceStreet();
    expect(useGameStore.getState().street).toBe('river');
    expect(useGameStore.getState().runout).toBe(runout);
  });

  it('calling deal() twice produces two different runouts and dealNonce of 2', () => {
    useGameStore.getState().deal();
    const firstRunout = useGameStore.getState().runout;

    useGameStore.getState().deal();
    const secondRunout = useGameStore.getState().runout;

    expect(useGameStore.getState().dealNonce).toBe(2);
    expect(secondRunout).not.toBe(firstRunout);

    // Probabilistic — assert the two 13-card sets are not identical across a handful of deals.
    let sawDifference = false;
    let previous = secondRunout;
    for (let i = 0; i < 5; i++) {
      useGameStore.getState().deal();
      const current = useGameStore.getState().runout;
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        sawDifference = true;
      }
      previous = current;
    }
    expect(sawDifference).toBe(true);
  });

  it('reveal(1) sets bit 1 of revealedMask; calling reveal(1) again leaves the mask unchanged', () => {
    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).toBe(0b010);

    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).toBe(0b010);
  });

  it('reveal(0) followed by reveal(2) yields a mask of 5; no action clears an individual bit', () => {
    useGameStore.getState().reveal(0);
    useGameStore.getState().reveal(2);
    expect(useGameStore.getState().revealedMask).toBe(5);
  });

  it('deal() resets revealedMask to 0', () => {
    useGameStore.getState().reveal(0);
    useGameStore.getState().reveal(1);
    expect(useGameStore.getState().revealedMask).not.toBe(0);

    useGameStore.getState().deal();

    expect(useGameStore.getState().revealedMask).toBe(0);
  });

  it('deal() increments pendingAnimationCount by exactly 1', () => {
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    useGameStore.getState().deal();
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);
  });

  it('advanceStreet() from preflop arms the gate; a second call at river (no-op) does not', () => {
    useGameStore.getState().deal();
    useUiStore.getState().resetAnimations();

    useGameStore.getState().advanceStreet(); // preflop -> flop, changes state
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    useGameStore.setState({ street: 'river' });
    useUiStore.getState().resetAnimations();
    useGameStore.getState().advanceStreet(); // river -> river, no-op
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(useGameStore.getState().street).toBe('river');
  });

  it('rewindStreet() from flop arms the gate; a call at preflop (no-op) does not', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'flop' });
    useUiStore.getState().resetAnimations();

    useGameStore.getState().rewindStreet(); // flop -> preflop, changes state
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    useUiStore.getState().resetAnimations();
    useGameStore.getState().rewindStreet(); // preflop -> preflop, no-op
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(useGameStore.getState().street).toBe('preflop');
  });

  it('reveal(0) on a hidden opponent arms the gate; a repeat reveal(0) does not', () => {
    useUiStore.getState().resetAnimations();
    useGameStore.getState().reveal(0);
    expect(useUiStore.getState().pendingAnimationCount).toBe(1);

    useUiStore.getState().resetAnimations();
    useGameStore.getState().reveal(0); // already revealed, no-op
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(useGameStore.getState().revealedMask).toBe(0b001);
  });

  it('no-op navigation actions never change runout, street, revealedMask or dealNonce', () => {
    useGameStore.getState().deal();
    const stateAfterDeal = useGameStore.getState();
    useGameStore.setState({ street: 'river' });
    const before = useGameStore.getState();

    useGameStore.getState().advanceStreet(); // no-op at river
    const after = useGameStore.getState();
    expect(after.runout).toBe(before.runout);
    expect(after.street).toBe(before.street);
    expect(after.revealedMask).toBe(before.revealedMask);
    expect(after.dealNonce).toBe(before.dealNonce);
    expect(after.dealNonce).toBe(stateAfterDeal.dealNonce);
  });

  it('deal() clears the settled odds cache even when entries existed for the previous hand', () => {
    useOddsStore.getState().clearCache();
    const snapshot: ProgressSnapshot = {
      requestId: 1,
      categoryCounts: new Array(10).fill(0),
      outcomes: { win: 60, tie: 10, lose: 30 },
      trialsCompleted: 100,
      done: true,
    };
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);
    expect(useOddsStore.getState().settledCache.size).toBe(1);

    useGameStore.getState().deal();

    expect(useOddsStore.getState().settledCache.size).toBe(0);
  });
});

describe('gameStore — merge-on-deal (picker draft honoured, unset slots randomly filled)', () => {
  beforeEach(() => {
    // deckCount reset for the same isolation reason as above: several assertions in this
    // block are 1-deck-only (13 DISTINCT cards) and must never inherit a 2-deck state.
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
    useUiStore.getState().resetAnimations();
  });

  it('with no picks set, deal() still produces 13 distinct random cards (unchanged 02-02 behavior)', () => {
    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    const allCards = [
      ...runout!.heroHole,
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];
    expect(new Set(allCards).size).toBe(13);
  });

  it('honours hero picks: heroHole deep-equals the picks and neither card appears elsewhere', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.heroHole).toEqual(['As', 'Ah']);
    const rest = [
      ...runout!.board,
      ...runout!.opponentHoles[0],
      ...runout!.opponentHoles[1],
      ...runout!.opponentHoles[2],
    ];
    expect(rest).not.toContain('As');
    expect(rest).not.toContain('Ah');
  });

  it('honours flop picks: board[0..2] equal the picks in order, board[3..4] random', () => {
    usePickerStore.getState().setPick('flop-0', '2c');
    usePickerStore.getState().setPick('flop-1', '3c');
    usePickerStore.getState().setPick('flop-2', '4c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.board.slice(0, 3)).toEqual(['2c', '3c', '4c']);
    expect(runout!.board[3]).not.toBe('2c');
    expect(runout!.board[4]).not.toBe('2c');
  });

  it('honours turn/river picks with the flop unset: board[3..4] equal the picks, board[0..2] random', () => {
    usePickerStore.getState().setPick('turn', '5c');
    usePickerStore.getState().setPick('river', '6c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    expect(runout!.board[3]).toBe('5c');
    expect(runout!.board[4]).toBe('6c');
    expect(runout!.board.slice(0, 3)).not.toContain('5c');
    expect(runout!.board.slice(0, 3)).not.toContain('6c');
  });

  it('opponent hole cards are always random and never taken from the picks (D-07)', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');
    usePickerStore.getState().setPick('flop-0', '2c');
    usePickerStore.getState().setPick('flop-1', '3c');
    usePickerStore.getState().setPick('flop-2', '4c');
    usePickerStore.getState().setPick('turn', '5c');
    usePickerStore.getState().setPick('river', '6c');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();

    const picked = ['As', 'Ah', '2c', '3c', '4c', '5c', '6c'];
    for (const hole of runout!.opponentHoles) {
      expect(picked).not.toContain(hole[0]);
      expect(picked).not.toContain(hole[1]);
    }
  });

  it('across 200 consecutive deals with a partial draft, every runout has 13 distinct cards (Pitfall 5)', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('turn', '5c');

    for (let i = 0; i < 200; i++) {
      useGameStore.getState().deal();
      const { runout } = useGameStore.getState();
      const allCards = [
        ...runout!.heroHole,
        ...runout!.board,
        ...runout!.opponentHoles[0],
        ...runout!.opponentHoles[1],
        ...runout!.opponentHoles[2],
      ];
      expect(new Set(allCards).size).toBe(13);
    }
  });

  it('picks persist after deal() — the draft is unchanged and a second deal() honours the same picks again', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');

    useGameStore.getState().deal();
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
    expect(usePickerStore.getState().picks['hero-1']).toBe('Ah');

    useGameStore.getState().deal();
    const { runout } = useGameStore.getState();
    expect(runout!.heroHole).toEqual(['As', 'Ah']);
  });
});

/** Flattens a runout into its 13 physical cards, in slot order. */
function runoutCards() {
  const { runout } = useGameStore.getState();
  return [
    ...runout!.heroHole,
    ...runout!.board,
    ...runout!.opponentHoles[0],
    ...runout!.opponentHoles[1],
    ...runout!.opponentHoles[2],
  ];
}

describe('gameStore — count-aware deal pool (D-14, HE2-01)', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
    useUiStore.getState().resetAnimations();
  });

  it('a fresh store defaults to deckCount 1', () => {
    expect(useGameStore.getState().deckCount).toBe(1);
  });

  it('at deckCount 2 with no picks, deal() produces 13 cards in which no VALUE appears more than twice', () => {
    useGameStore.setState({ deckCount: 2 });
    useGameStore.getState().deal();

    const allCards = runoutCards();
    expect(allCards).toHaveLength(13);
    // cardCounts assertion, never a Set-size assertion — the per-value cap is the 2-deck
    // invariant; distinctness is only a 1-deck property.
    for (const count of cardCounts(allCards).values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('at deckCount 2 with both copies of one value picked into two slots, deal() honours BOTH picks without re-drawing either', () => {
    useGameStore.setState({ deckCount: 2 });
    usePickerStore.getState().setPick('hero-0', 'As', 2);
    usePickerStore.getState().setPick('flop-0', 'As', 2);

    useGameStore.getState().deal();

    const { runout } = useGameStore.getState();
    expect(runout!.heroHole[0]).toBe('As');
    expect(runout!.board[0]).toBe('As');
    // Exactly the two picked physical copies exist in the runout: the shoe held only two
    // As, both were consumed by the picks, so the random fill can never re-draw one.
    const allCards = runoutCards();
    expect(allCards).toHaveLength(13);
    expect(cardCounts(allCards).get('As')).toBe(2);
  });
});

describe('gameStore — setDeckCount() (D-02 lifecycle + A4 store-boundary refusal)', () => {
  let armSpy: MockInstance;

  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0, deckCount: 1 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
    useUiStore.getState().resetAnimations();
    useOddsStore.getState().clearCache();
    // vi.spyOn returns the SAME spy when the method is already spied (every test after the
    // first), so clear its accumulated calls to keep per-test arm counts accurate.
    armSpy = vi.spyOn(useUiStore.getState(), 'beginAnimation');
    armSpy.mockClear();
  });

  function arms(): number {
    return armSpy.mock.calls.length;
  }

  /** Seeds one settled cache entry so cache retention/clearing can be asserted. */
  function seedCache() {
    const snapshot: ProgressSnapshot = {
      requestId: 1,
      categoryCounts: new Array(10).fill(0),
      outcomes: { win: 60, tie: 10, lose: 30 },
      trialsCompleted: 100,
      done: true,
    };
    useOddsStore.getState().cacheIfSettled('flop', 0, snapshot);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
  }

  it('same value while idle: the whole store state is reference-identical, nothing arms, the cache stays', () => {
    seedCache();
    const before = useGameStore.getState();

    useGameStore.getState().setDeckCount(1);

    expect(useGameStore.getState()).toBe(before);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
    expect(arms()).toBe(0);
  });

  it('same value with a hand on the table: identical no-op — dealNonce unchanged', () => {
    useGameStore.getState().deal();
    armSpy.mockClear();
    seedCache();
    const before = useGameStore.getState();

    useGameStore.getState().setDeckCount(1);

    expect(useGameStore.getState()).toBe(before);
    expect(useGameStore.getState().dealNonce).toBe(1);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
    expect(arms()).toBe(0);
  });

  it('different value while idle: deckCount changes, dealNonce unchanged, no arming, no odds-cache clear', () => {
    seedCache();

    useGameStore.getState().setDeckCount(2);

    const state = useGameStore.getState();
    expect(state.deckCount).toBe(2);
    expect(state.runout).toBeNull();
    expect(state.dealNonce).toBe(0);
    expect(useOddsStore.getState().settledCache.size).toBe(1);
    expect(arms()).toBe(0);
  });

  it('different value with a hand on the table: fresh deal — dealNonce +1 exactly, gate armed exactly once, cache emptied, street preflop, revealedMask 0', () => {
    useGameStore.getState().deal();
    useGameStore.setState({ street: 'river', revealedMask: 0b101 });
    armSpy.mockClear();
    seedCache();

    useGameStore.getState().setDeckCount(2);

    const state = useGameStore.getState();
    expect(state.deckCount).toBe(2);
    expect(state.dealNonce).toBe(2);
    expect(state.street).toBe('preflop');
    expect(state.revealedMask).toBe(0);
    expect(useOddsStore.getState().settledCache.size).toBe(0);
    expect(arms()).toBe(1);
  });

  it('refuses 2 -> 1 while the picks hold a duplicated value: deckCount stays 2, dealNonce unchanged, picks untouched', () => {
    useGameStore.setState({ deckCount: 2 });
    usePickerStore.getState().setPick('hero-0', 'As', 2);
    usePickerStore.getState().setPick('flop-0', 'As', 2);
    useGameStore.getState().deal();
    armSpy.mockClear();
    const storeBefore = useGameStore.getState();
    const picksBefore = usePickerStore.getState().picks;

    useGameStore.getState().setDeckCount(1);

    // A refused switch is a COMPLETE no-op, exactly like the same-value branch — and the
    // load-bearing guarantee: the picks are untouched (a deck toggle never silently
    // clears a pick, UI-SPEC A4).
    expect(useGameStore.getState()).toBe(storeBefore);
    expect(useGameStore.getState().deckCount).toBe(2);
    expect(useGameStore.getState().dealNonce).toBe(storeBefore.dealNonce);
    expect(usePickerStore.getState().picks).toBe(picksBefore);
    expect(arms()).toBe(0);
  });

  it('allows 2 -> 1 when the picks hold no duplicated value (the on-table hand never blocks)', () => {
    useGameStore.setState({ deckCount: 2 });
    usePickerStore.getState().setPick('hero-0', 'As', 2);
    useGameStore.getState().deal();

    useGameStore.getState().setDeckCount(1);

    expect(useGameStore.getState().deckCount).toBe(1);
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
  });

  it('always allows 1 -> 2 with any picks; picks untouched', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');
    const picksBefore = usePickerStore.getState().picks;

    useGameStore.getState().setDeckCount(2);

    expect(useGameStore.getState().deckCount).toBe(2);
    expect(usePickerStore.getState().picks).toBe(picksBefore);
  });
});
