import { getRank, getSuit } from '@poker-apprentice/types';
import type { Card, Rank, Suit } from '@poker-apprentice/types';
import { HAND_CATEGORY_EXAMPLES, type ExampleCardRole } from './handCategoryExamples';

/**
 * A miniature five-card hand illustrating one odds-table category.
 *
 * PURELY DECORATIVE — the SVG carries `aria-hidden`, so a screen reader announces the row's
 * own label ("High Card") and never the illustrated cards ("A K 9 7 4"). That is both the
 * right reading order and a hard structural requirement: a frozen v1 acceptance suite asserts
 * `row.querySelector('th').textContent` equals the category label EXACTLY, and SVG `<text>`
 * contributes to `textContent`. The icon therefore lives in its own `<td>`, never inside the
 * row header — `OddsTable.categoryIconCell.test.tsx` pins that placement so the invariant
 * fails loudly here instead of in an untouchable file.
 *
 * Rank/suit are derived with `getRank`/`getSuit` rather than string indexing, matching the
 * convention `PlayingCard` established (RESEARCH Pitfall 5). This component draws its own
 * miniature card shapes and never constructs an asset path, so `PlayingCard` remains the sole
 * card-code -> art bridge.
 */

/** Geometry, in viewBox units. Five cards of `CARD_W` with `GAP` between them. */
const CARD_W = 14;
const CARD_H = 20;
const GAP = 1.5;
const VIEW_W = 5 * CARD_W + 4 * GAP + 1; // 78 — half a unit of bleed each side for the stroke
const VIEW_H = CARD_H + 1;

const SUIT_GLYPH: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

/** The vendored deck writes ten as "10"; the `Card` union spells it `'T'`. */
const RANK_GLYPH: Record<Rank, string> = {
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

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['d', 'h']);

function cardX(index: number): number {
  return 0.5 + index * (CARD_W + GAP);
}

interface MiniCardProps {
  card: Card;
  role: ExampleCardRole;
  index: number;
}

function MiniCard({ card, role, index }: MiniCardProps) {
  const suit = getSuit(card);
  const rank = getRank(card);
  const glyph = RANK_GLYPH[rank];
  const x = cardX(index);
  const centre = x + CARD_W / 2;
  // Kickers are drawn on dim stock with muted ink; played cards keep full-contrast ink so the
  // matched group reads first. Colour alone never carries meaning here — the row label does.
  const inkClass =
    role === 'kicker'
      ? 'hand-icon__ink--kicker'
      : RED_SUITS.has(suit)
        ? 'hand-icon__ink--red'
        : 'hand-icon__ink--black';

  return (
    <g>
      <rect
        className={`hand-icon__stock hand-icon__stock--${role}`}
        x={x}
        y={0.5}
        width={CARD_W}
        height={CARD_H}
        rx={2}
      />
      <text
        className={`hand-icon__rank ${glyph.length > 1 ? 'hand-icon__rank--wide' : ''} ${inkClass}`}
        x={centre}
        y={9.8}
        textAnchor="middle"
      >
        {glyph}
      </text>
      <text className={`hand-icon__pip ${inkClass}`} x={centre} y={17.3} textAnchor="middle">
        {SUIT_GLYPH[suit]}
      </text>
    </g>
  );
}

interface HandCategoryIconProps {
  /** Index into `CATEGORY_LABELS` (0-9), or `FIVE_OF_A_KIND_INDEX` (10) at two decks. */
  categoryIndex: number;
}

export function HandCategoryIcon({ categoryIndex }: HandCategoryIconProps) {
  const example = HAND_CATEGORY_EXAMPLES[categoryIndex];
  // Defensive: a category with no illustration renders nothing rather than an empty frame, so
  // a future eleventh-plus category cannot ship a blank card row unnoticed.
  if (!example) return null;

  return (
    <svg
      className="hand-icon"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={VIEW_W}
      height={VIEW_H}
      aria-hidden="true"
      focusable="false"
      data-testid={`category-example-${categoryIndex}`}
    >
      {example.map((entry, index) => (
        // Two copies of one physical card can appear in the same illustration (Five of a Kind
        // shows the ace of hearts twice), so the key is positional, never the card code.
        <MiniCard key={index} card={entry.card} role={entry.role} index={index} />
      ))}
    </svg>
  );
}
