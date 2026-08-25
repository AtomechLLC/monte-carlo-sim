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
 * construct a `cards/...` asset path or a "{Rank} of {Suit}" alt string — no other component
 * may hand-compose rank/suit art or an asset URL. (CardBack.tsx owns the one back-of-card path
 * and follows the same base-prefix rule.)
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

/**
 * `'As'` -> `/cards/S-A.svg`, `'Td'` -> `/cards/D-10.svg` (at the default root base).
 *
 * The path is prefixed with `import.meta.env.BASE_URL` because the app also ships as a GitHub
 * Pages PROJECT site served from a subpath (`/monte-carlo-sim/`). Vite rewrites root-relative
 * URLs it can see statically (those in index.html), but this path is composed at RUNTIME, so
 * nothing would rewrite it — every card would 404 on the deployed site. `BASE_URL` always ends
 * in `/`, and it is `'/'` under both `vite dev` and Vitest, so the emitted string is unchanged
 * everywhere except a subpath production build.
 */
export function cardAssetPath(card: Card): string {
  const suit = SUIT_TO_ASSET[getSuit(card)];
  const rank = RANK_TO_ASSET[getRank(card)];
  return `${import.meta.env.BASE_URL}cards/${suit}-${rank}.svg`;
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
  /** Renders the D-08 second-copy badge beside the card face (HE2-03, 2-deck only —
   * callers derive it from copyCuedSlots). Ignored when faceUp is false: a face-down
   * card can never show a cue. When absent or false, the rendered output is byte-
   * identical to the shipped single <img> — no wrapper, no siblings (D-11). */
  copyCue?: boolean;
}

export function PlayingCard({ card, faceUp = true, decorative = false, copyCue = false }: PlayingCardProps) {
  if (!faceUp) return <CardBack />;

  if (copyCue) {
    // The badge is a fragment SIBLING of the shipped <img>, never a wrapper around it,
    // so the no-cue path below stays the shipped expression untouched. Aria reasoning
    // (07-UI-SPEC A11, adapting BlackjackDealerArea's in-comment convention): the
    // visible ×2 glyph is aria-hidden because it is a symbol; its meaning is delivered
    // by the visually-hidden sibling sentence in unlabelled containers (hero-hole,
    // board-cards) — and, inside a revealed-opponent button whose aria-label overrides
    // inner content for the accessible name, by the aria-label suffix Seat.tsx appends.
    // The D-03 alt bridge stays the single card-code-to-art source: cardAssetPath/
    // cardAltText are untouched and the cue deliberately composes NO alt text.
    return (
      <>
        <img
          className="playing-card"
          src={cardAssetPath(card)}
          alt={decorative ? '' : cardAltText(card)}
          draggable={false}
        />
        <span className="copy-cue" data-testid="holdem-copy-cue" aria-hidden="true">
          ×2
        </span>
        <span className="visually-hidden">Second copy — two physical copies of this card are in play</span>
      </>
    );
  }

  return (
    <img
      className="playing-card"
      src={cardAssetPath(card)}
      alt={decorative ? '' : cardAltText(card)}
      draggable={false}
    />
  );
}
