import type { Card } from '@poker-apprentice/types';

/**
 * How a single card in an example hand relates to the category it illustrates.
 *
 * - `plays`   — part of the matched group (or the run/suit) that names the hand.
 * - `second`  — the SECOND matched group, for the two categories built from two of them
 *               (Two Pair, Full House). Rendered a shade back from `plays` so the 3+2 and
 *               2+2 shapes are legible at a glance.
 * - `kicker`  — present in the five-card hand but contributing nothing to the category.
 */
export type ExampleCardRole = 'plays' | 'second' | 'kicker';

export interface ExampleCard {
  readonly card: Card;
  readonly role: ExampleCardRole;
}

/**
 * A concrete five-card hand for every category, indexed to match `CATEGORY_LABELS`
 * (0-9) with the 2-deck-only Five of a Kind at index 10 (`FIVE_OF_A_KIND_INDEX`).
 *
 * These are illustrations, not simulation output — their job is to teach the shape of each
 * category to a reader who does not already know it, which is why the suits are chosen as
 * carefully as the ranks:
 *
 * - Straight is deliberately MIXED-suit and Straight Flush is the same run in a single suit,
 *   so the two rows explain the difference to each other.
 * - Flush is deliberately out of sequence, for the same reason in reverse.
 * - Five of a Kind repeats the ace of hearts because that hand is only reachable once a
 *   second deck is in the shoe — the duplicate is the honest picture of why the row exists
 *   only at `deckCount === 2`.
 *
 * Every entry is exactly five cards; `HandCategoryIcon` renders them left to right.
 */
export const HAND_CATEGORY_EXAMPLES: readonly (readonly ExampleCard[])[] = [
  // 0 — High Card: the ace alone decides it.
  [
    { card: 'As', role: 'plays' },
    { card: 'Kd', role: 'kicker' },
    { card: '9c', role: 'kicker' },
    { card: '7h', role: 'kicker' },
    { card: '4s', role: 'kicker' },
  ],
  // 1 — One Pair
  [
    { card: '9s', role: 'plays' },
    { card: '9h', role: 'plays' },
    { card: 'Kd', role: 'kicker' },
    { card: '7c', role: 'kicker' },
    { card: '4s', role: 'kicker' },
  ],
  // 2 — Two Pair
  [
    { card: 'Js', role: 'plays' },
    { card: 'Jh', role: 'plays' },
    { card: '9d', role: 'second' },
    { card: '9c', role: 'second' },
    { card: '4s', role: 'kicker' },
  ],
  // 3 — Three of a Kind
  [
    { card: '7s', role: 'plays' },
    { card: '7h', role: 'plays' },
    { card: '7d', role: 'plays' },
    { card: 'Kc', role: 'kicker' },
    { card: '4s', role: 'kicker' },
  ],
  // 4 — Straight: mixed suits on purpose (contrast with index 8).
  [
    { card: '5c', role: 'plays' },
    { card: '6h', role: 'plays' },
    { card: '7s', role: 'plays' },
    { card: '8d', role: 'plays' },
    { card: '9c', role: 'plays' },
  ],
  // 5 — Flush: one suit, deliberately NOT a run.
  [
    { card: 'Ah', role: 'plays' },
    { card: 'Jh', role: 'plays' },
    { card: '8h', role: 'plays' },
    { card: '5h', role: 'plays' },
    { card: '2h', role: 'plays' },
  ],
  // 6 — Full House: three eights over two kings.
  [
    { card: '8s', role: 'plays' },
    { card: '8h', role: 'plays' },
    { card: '8d', role: 'plays' },
    { card: 'Kc', role: 'second' },
    { card: 'Ks', role: 'second' },
  ],
  // 7 — Four of a Kind
  [
    { card: 'Qs', role: 'plays' },
    { card: 'Qh', role: 'plays' },
    { card: 'Qd', role: 'plays' },
    { card: 'Qc', role: 'plays' },
    { card: '3s', role: 'kicker' },
  ],
  // 8 — Straight Flush: the index-4 run, now all clubs.
  [
    { card: '5c', role: 'plays' },
    { card: '6c', role: 'plays' },
    { card: '7c', role: 'plays' },
    { card: '8c', role: 'plays' },
    { card: '9c', role: 'plays' },
  ],
  // 9 — Royal Flush: 10 J Q K A of spades.
  [
    { card: 'Ts', role: 'plays' },
    { card: 'Js', role: 'plays' },
    { card: 'Qs', role: 'plays' },
    { card: 'Ks', role: 'plays' },
    { card: 'As', role: 'plays' },
  ],
  // 10 — Five of a Kind (2-deck only): note the repeated ace of hearts.
  [
    { card: 'Ah', role: 'plays' },
    { card: 'Ah', role: 'plays' },
    { card: 'As', role: 'plays' },
    { card: 'Ad', role: 'plays' },
    { card: 'Ac', role: 'plays' },
  ],
];
