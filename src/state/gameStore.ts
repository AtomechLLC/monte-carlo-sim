import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { CARDS_PER_DEAL, HOLE_CARDS_PER_PLAYER, OPPONENT_COUNT } from '../engine/cards';
import type { DeckCount } from '../engine/shoe';
import { shoeWithout } from '../engine/shoe';
import { createRng, drawN } from '../engine/rng';
import type { PredeterminedRunout } from '../engine/conditioning';
import type { Street } from '../engine/streets';
import { nextStreet, previousStreet } from '../engine/streets';
import { useOddsStore } from './oddsStore';
import { usePickerStore, pickedCards, hasDuplicatePick } from './pickerStore';
import { useUiStore } from './uiStore';

interface GameState {
  /** The full predetermined runout for the current hand, or `null` before the first deal (D-01). */
  runout: PredeterminedRunout | null;
  /** The street currently visible to the user. Navigation moves this pointer; it never redraws cards. */
  street: Street;
  /** Bitmask of revealed opponents (bit `i` set = opponent `i` revealed). Always `0` until plan 02-03 adds `reveal()`. */
  revealedMask: number;
  /**
   * Increments on every `deal()`. Doubles as the simulation `requestId` in later plans —
   * deliberately a single counter, not two.
   */
  dealNonce: number;
  /**
   * Hold'em-LOCAL shoe size (D-14) — lives here, never in the cross-game store,
   * following the D-10 store-locality precedent.
   */
  deckCount: DeckCount;
  /** Draws a fresh predetermined runout (hero + board + 3 opponents) and resets navigation state. */
  deal: () => void;
  /** Moves the visible street forward one step; no-op at `'river'`. Never redraws cards. */
  advanceStreet: () => void;
  /** Moves the visible street backward one step; no-op at `'preflop'`. Never redraws cards. */
  rewindStreet: () => void;
  /**
   * Reveals opponent `opponentIndex`'s hole cards. Monotonic (D-08): OR-in a bit, never clear
   * one — there is deliberately no un-reveal/toggle action exposed anywhere in this store.
   */
  reveal: (opponentIndex: number) => void;
  /**
   * D-02: a same-value click is a no-op; while idle this only sets the field; with a runout
   * on the table it sets the field and immediately re-deals (which clears the odds cache,
   * bumps `dealNonce` and arms the gate). Refuses a 2 -> 1 switch while the picks hold a
   * duplicated value (UI-SPEC A4).
   */
  setDeckCount: (deckCount: DeckCount) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  runout: null,
  street: 'preflop',
  revealedMask: 0,
  dealNonce: 0,
  deckCount: 1,
  deal: () => {
    // Merge-on-deal (D-03, D-06): picked cards are honoured exactly where placed; every unset
    // slot is filled from ONE shuffle of what's left over. Never draw a second time for a
    // different slot category — independent draws from the same starting pool can collide
    // (RESEARCH Pitfall 5), and picks persist across deals (UI-SPEC A2) so the draft is read
    // here but never cleared.
    const { picks } = usePickerStore.getState();
    const picked = pickedCards(picks);
    // Count-aware pool (D-14, HE2-01). Provably byte-identical at one deck: shoe.ts
    // documents that walking the shoe IN ORDER is what makes `shoeWithout(1, x)`
    // reproduce the previous single-deck pool helper's output exactly, ordering
    // included, and deckParity.golden.test.ts pins that equivalence against recorded
    // seeded output.
    const pool = shoeWithout(get().deckCount, picked);
    const rng = createRng();
    const fill: Card[] = drawN(rng, pool, CARDS_PER_DEAL - picked.length);

    let cursor = 0;
    const nextFill = (): Card => fill[cursor++];

    const heroHole: [Card, Card] = [
      picks['hero-0'] ?? nextFill(),
      picks['hero-1'] ?? nextFill(),
    ];
    const board: [Card, Card, Card, Card, Card] = [
      picks['flop-0'] ?? nextFill(),
      picks['flop-1'] ?? nextFill(),
      picks['flop-2'] ?? nextFill(),
      picks['turn'] ?? nextFill(),
      picks['river'] ?? nextFill(),
    ];
    // Opponent hole cards are always random and never taken from the picks (D-07) — the picker
    // has no opponent slots, so every remaining fill card lands here.
    const drawOpponentHole = (): [Card, Card] => {
      const hole = Array.from({ length: HOLE_CARDS_PER_PLAYER }, () => nextFill());
      return [hole[0], hole[1]];
    };
    const opponentHoles = Array.from({ length: OPPONENT_COUNT }, drawOpponentHole) as [
      [Card, Card],
      [Card, Card],
      [Card, Card],
    ];

    const runout: PredeterminedRunout = { heroHole, board, opponentHoles };

    set({ runout, street: 'preflop', revealedMask: 0, dealNonce: get().dealNonce + 1 });
    // Arm the animation gate synchronously alongside the state write above (same synchronous
    // tick, so React batches both into one render) — deal() always animates, unconditionally
    // (D-11). Armed BEFORE the odds cache is cleared so a stale odds effect can never observe
    // an already-open gate before the newly mounted cards register (03-RESEARCH Pitfall 2).
    useUiStore.getState().beginAnimation();
    // A fresh hand must never serve a previous hand's settled odds (RESEARCH Pitfall 4,
    // option (a) — clear the whole cache on every deal rather than namespacing keys).
    useOddsStore.getState().clearCache();
  },
  advanceStreet: () => {
    const current = get().street;
    const next = nextStreet(current);
    // Arm CONDITIONALLY — nextStreet clamps at 'river', and arming a no-op would increment a
    // count that nothing will ever release, deadlocking the odds effect permanently (D-11).
    if (next !== current) {
      set({ street: next });
      useUiStore.getState().beginAnimation();
    }
  },
  rewindStreet: () => {
    const current = get().street;
    const previous = previousStreet(current);
    // Same conditional-arming rationale as advanceStreet: previousStreet clamps at 'preflop'.
    if (previous !== current) {
      set({ street: previous });
      useUiStore.getState().beginAnimation();
    }
  },
  reveal: (opponentIndex) => {
    const alreadyRevealed = (get().revealedMask & (1 << opponentIndex)) !== 0;
    // Same conditional-arming rationale: reveal() ORs a bit that may already be set.
    if (!alreadyRevealed) {
      set((state) => ({ revealedMask: state.revealedMask | (1 << opponentIndex) }));
      useUiStore.getState().beginAnimation();
    }
  },
  setDeckCount: (deckCount) => {
    // The already-selected segment is a harmless no-op (D-02): nothing changes, nothing
    // arms, the cache stays.
    if (get().deckCount === deckCount) return;
    // A4 store-boundary refusal: switching DOWN to one deck while the picks hold two
    // copies of one value is refused outright. The picks are the ONLY state surviving a
    // toggle into the next deal() — they flow through `shoeWithout(deckCount, picked)`
    // above — so they are the only impossibility source. The UI disables that segment
    // with an explanatory title, so this branch is normally unreachable; it exists as
    // the correctness backstop, deliberately structured so a deck toggle can NEVER
    // silently clear a pick (UI-SPEC A4).
    if (deckCount === 1 && hasDuplicatePick(usePickerStore.getState().picks)) return;
    // D-02: set the field; with a hand on the table, re-deal immediately. deal() already
    // owns the three things that make the mid-hand path correct: it clears the odds
    // cache (D-03), it bumps `dealNonce` (the CR-02 generation guard the in-flight
    // snapshot stream checks), and it arms the animation gate. setDeckCount itself must
    // NOT call beginAnimation() and must NOT touch the odds store — a deck toggle is not
    // a card animation, and duplicating either call would double-arm the gate or race
    // the cache clear.
    set({ deckCount });
    if (get().runout !== null) {
      get().deal();
    }
    // Deliberate divergence from the D-10 store-locality precedent's toggle: there is no
    // retained-hand refusal branch for the mid-hand case, because D-02's fresh deal
    // discards the table rather than preserving it — the only refusal is the picks-based
    // one above.
  },
}));
