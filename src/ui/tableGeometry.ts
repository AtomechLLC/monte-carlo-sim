/**
 * Deck-origin offsets and dealer-rotation ordering derived from the locked felt geometry
 * (src/App.css, plan 03-02). This module does no DOM measurement (D-07 is desktop-first —
 * approximation at other viewport widths is accepted) — every offset is computed against a
 * fixed 760x475 reference felt, matching the locked `width: min(100%, 760px)` / `aspect-ratio:
 * 16 / 10` rule in `.felt`.
 */

export type PositionKey =
  | 'seat-hero'
  | 'seat-opponent-0'
  | 'seat-opponent-1'
  | 'seat-opponent-2'
  | 'community-0'
  | 'community-1'
  | 'community-2'
  | 'community-3'
  | 'community-4'
  | 'deck-origin';

/** The reference felt's locked dimensions (`.felt` in src/App.css: `width: min(100%, 1040px)`,
 * `aspect-ratio: 16 / 10` -> height = 1040 * 10 / 16 = 650). */
const FELT_WIDTH = 1040;
const FELT_HEIGHT = 650;

/**
 * Approximate centre of each slot, as a percentage of the felt's own box — mirroring the
 * `top`/`left`/`transform` percentages committed to `.seat-hero`/`.seat-opponent-*`/
 * `.community-area`/`.deck-origin` in src/App.css (plan 03-02), adjusted for each element's own
 * box size (card width/height, seat label height, community row width) so the value represents
 * the CENTRE of the card(s) at that slot, not the CSS anchor edge. Community cards are laid out
 * as a flex row inside `.community-area` (5 x 76px community cards, 16px gaps); their individual
 * centres are derived from that row's own locked centre/width rather than duplicated as five
 * separate CSS rules.
 */
export const POSITIONS: Record<PositionKey, { leftPct: number; topPct: number }> = {
  'seat-hero': { leftPct: 50, topPct: 83.6 },
  'seat-opponent-0': { leftPct: 20.5, topPct: 15.9 },
  'seat-opponent-1': { leftPct: 50, topPct: 9.9 },
  'seat-opponent-2': { leftPct: 79.5, topPct: 15.9 },
  'community-0': { leftPct: 32.3, topPct: 45.2 },
  'community-1': { leftPct: 41.2, topPct: 45.2 },
  'community-2': { leftPct: 50, topPct: 45.2 },
  'community-3': { leftPct: 58.8, topPct: 45.2 },
  'community-4': { leftPct: 67.7, topPct: 45.2 },
  'deck-origin': { leftPct: 93.1, topPct: 46.9 },
};

function toPx(position: { leftPct: number; topPct: number }): { x: number; y: number } {
  return {
    x: (position.leftPct / 100) * FELT_WIDTH,
    y: (position.topPct / 100) * FELT_HEIGHT,
  };
}

/**
 * Pixel offset from a target slot back to the deck origin, against the 760x475 reference felt.
 * Used as a card's `initial` transform so it appears to start on the deck: `deckPx - targetPx`
 * is exactly the translation that, when animated back to `{ x: 0, y: 0 }`, lands the card in its
 * slot.
 */
export function dealOriginOffset(target: PositionKey): { x: number; y: number } {
  const deckPx = toPx(POSITIONS['deck-origin']);
  const targetPx = toPx(POSITIONS[target]);
  return { x: deckPx.x - targetPx.x, y: deckPx.y - targetPx.y };
}

/** Per-seat position in the A3 dealer rotation: opponent-0, opponent-1, opponent-2, hero. */
const SEAT_ROTATION_INDEX: Record<'hero' | 0 | 1 | 2, number> = {
  0: 0,
  1: 1,
  2: 2,
  hero: 3,
};

/**
 * Dealer-rotation position (0-7) of a hole card: opp-0, opp-1, opp-2, hero, then repeat (A3).
 * Slot 0 (each seat's first hole card) fills positions 0-3; slot 1 fills positions 4-7.
 */
export function dealIndex(seat: 'hero' | 0 | 1 | 2, slotIndex: 0 | 1): number {
  return SEAT_ROTATION_INDEX[seat] + slotIndex * 4;
}
