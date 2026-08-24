import type { Card } from '@poker-apprentice/types';
import { FULL_DECK } from './cards';

/**
 * Number of physical decks in the shoe (D-01, D-03). Closed literal union, mirroring
 * `Street`'s style in `./streets` — no enum, no arbitrary integers.
 */
export type DeckCount = 1 | 2;

/**
 * `deckCount` concatenated copies of `FULL_DECK` — 52 or 104 flat entries, duplicates
 * intact and never collapsed (D-01). Repeats the single canonical `FULL_DECK` source
 * rather than pulling a second 52-card source directly from the evaluator types
 * package, so there stays exactly one 52-card source of truth (D-03).
 *
 * Ordering is CONCATENATED (all 52, then all 52 again), not interleaved. This is a
 * deliberate, stated choice, not an accident: the shoe's order is an input to seeded
 * shuffling downstream, so callers relying on reproducible seeded draws depend on this
 * exact layout staying concatenated across releases.
 *
 * Returns a fresh mutable array on every call — never a shared/cached reference — so
 * mutating one call's result can never affect a later call or `FULL_DECK` itself.
 */
export function buildShoe(deckCount: DeckCount): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    shoe.push(...FULL_DECK);
  }
  return shoe;
}

/** Total physical cards a full shoe holds: `FULL_DECK.length * deckCount` (D-03). */
export function shoeSize(deckCount: DeckCount): number {
  return FULL_DECK.length * deckCount;
}

/**
 * Occurrence count per card VALUE, built in a single pass. This is the one shared
 * count-based multiset primitive for the whole phase (D-01) — `shoeWithout` uses it
 * here, and plans 04-04/04-05 import it directly rather than re-deriving the same
 * counting logic in the worker overlap check or the picker's block threshold.
 */
export function cardCounts(cards: readonly Card[]): Map<Card, number> {
  const counts = new Map<Card, number>();
  for (const card of cards) {
    counts.set(card, (counts.get(card) ?? 0) + 1);
  }
  return counts;
}

/**
 * `buildShoe(deckCount)` with ONE physical copy removed per occurrence in `excluded`
 * (D-01, D-03). This is the DECK-01 headline contract: excluding one occurrence of a
 * card removes exactly one physical copy, so at `deckCount=2` the sibling copy remains
 * drawable — excluding `'As'` once from a 2-deck shoe still leaves one `'As'` in the
 * result.
 *
 * Implemented as a single walk over `buildShoe(deckCount)` IN ORDER, decrementing a
 * budget built from `excluded` via `cardCounts` as each matching entry is skipped.
 * Deliberately never constructs a `Set` of card values and never checks membership by
 * scanning `excluded` per candidate — both are the same value-collapse bug that erases
 * physical copies (the bug this module exists to replace, PITFALLS.md Pitfall 6). Walking in
 * order (rather than rebuilding from counts) is what makes `shoeWithout(1, x)`
 * reproduce `deckWithout(x)`'s output exactly, including its ordering (D-08, D-10).
 *
 * `FULL_DECK`/`deckWithout` in `./cards` are deliberately left in place for existing
 * single-deck callers and are not redefined here (D-03, PITFALLS Pitfall 12) — this
 * module is purely additive.
 */
export function shoeWithout(deckCount: DeckCount, excluded: readonly Card[]): Card[] {
  const budget = cardCounts(excluded);
  const result: Card[] = [];
  for (const card of buildShoe(deckCount)) {
    const remaining = budget.get(card) ?? 0;
    if (remaining > 0) {
      budget.set(card, remaining - 1);
      continue;
    }
    result.push(card);
  }
  return result;
}
