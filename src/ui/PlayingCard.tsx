// react-refresh/only-export-components: this file's export shape (PlayingCard plus
// cardAssetPath/cardAltText) is a locked contract (03-01-PLAN.md target_contracts,
// UI-SPEC D-03 mapping component) — the utility functions are deliberately co-located with
// the component so they remain the single card-code -> art bridge; splitting them into a
// separate file would violate that contract for no correctness benefit (Fast Refresh still
// works fine, it just can't prove it statically here).
/* eslint-disable react-refresh/only-export-components */
import { getRank, getSuit } from '@poker-apprentice/types';
import type { Card, Rank, Suit } from '@poker-apprentice/types';
import { CardBack } from './CardBack';

/**
 * D-03's single card-code -> art bridge. This file is the ONLY place in the app permitted to
 * construct a `/cards/...` asset path or a "{Rank} of {Suit}" alt string — no other component
 * may hand-compose rank/suit art or an asset URL.
 *
 * Rank/suit are derived via `getRank`/`getSuit` (never manual string indexing/substring
 * extraction — RESEARCH Pitfall 5) because this project's `Card` union uses lowercase suits
 * and `'T'` for ten, while
 * the vendored deck's filenames use uppercase suits and `"10"` for ten. Both maps are
 * exhaustive `Record<Rank, ...>`/`Record<Suit, ...>` object literals so a missing case is a
 * TypeScript compile error, never a runtime 404.
 */
const SUIT_TO_ASSET: Record<Suit, string> = {
  c: 'C',
  d: 'D',
  h: 'H',
  s: 'S',
};

const RANK_TO_ASSET: Record<Rank, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

const SUIT_NAME: Record<Suit, string> = {
  c: 'Clubs',
  d: 'Diamonds',
  h: 'Hearts',
  s: 'Spades',
};

const RANK_NAME: Record<Rank, string> = {
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  T: 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
};

/** `'As'` -> `/cards/S-A.svg`, `'Td'` -> `/cards/D-10.svg`. */
export function cardAssetPath(card: Card): string {
  const suit = SUIT_TO_ASSET[getSuit(card)];
  const rank = RANK_TO_ASSET[getRank(card)];
  return `/cards/${suit}-${rank}.svg`;
}

/** `'As'` -> `'Ace of Spades'`, `'Td'` -> `'Ten of Diamonds'` — the screen-reader-facing name. */
export function cardAltText(card: Card): string {
  const rankName = RANK_NAME[getRank(card)];
  const suitName = SUIT_NAME[getSuit(card)];
  return `${rankName} of ${suitName}`;
}

interface PlayingCardProps {
  card: Card;
  /** Defaults to true. When false, renders <CardBack /> instead of the face. */
  faceUp?: boolean;
  /** When true the image is alt="" (an ancestor already carries the accessible name). */
  decorative?: boolean;
}

export function PlayingCard({ card, faceUp = true, decorative = false }: PlayingCardProps) {
  if (!faceUp) return <CardBack />;

  return (
    <img
      className="playing-card"
      src={cardAssetPath(card)}
      alt={decorative ? '' : cardAltText(card)}
      draggable={false}
    />
  );
}
