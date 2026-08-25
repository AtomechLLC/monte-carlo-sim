/**
 * TEST-ONLY brute-force best-of-C(n,5) multiset scorer, consumed exclusively by
 * `evaluatorTwoDeck.property.test.ts` as the independent oracle for the duplicate-aware
 * evaluation layer (D-06, D-13).
 *
 * This is a DELIBERATE second implementation whose whole value is being written
 * differently from the production path (07-RESEARCH candidate (b), licensed there as
 * disposable-quality test code — the licence that makes hand-rolling this scorer correct
 * rather than a Don't-Hand-Roll violation). It is slow and simple ON PURPOSE: no lookup
 * tables, no bit tricks, no code shared with the production module. It imports NOTHING
 * from `./evaluator` or `./evaluatorTwoDeck`, and no production module may import it —
 * `evaluatorTwoDeck.ts` is asserted not to.
 *
 * Semantics implemented (07-RESEARCH's specification, items 1-6): rank categories count
 * PHYSICAL cards (two identical cards are a real pair); >= 5 of one rank is Five of a
 * Kind (category 10); a flush is any 5 physical cards of one suit with the multiset rank
 * tiebreak (Assumption A1); straights and straight flushes require five DISTINCT
 * consecutive ranks with the wheel lowest.
 */
import type { Card } from '@poker-apprentice/types';

export interface OracleResult {
  strength: number;
  /** Within-category tiebreak, rank indices (2 -> 0 ... A -> 12), most significant first. */
  tiebreak: number[];
}

// Rank strength ascending; a card's rank index is its position in this string. Parsed
// straight off the card string so nothing is shared with the production lookup tables.
const RANK_ORDER = '23456789TJQKA';

function rankIndexOf(card: Card): number {
  const index = RANK_ORDER.indexOf(card.charAt(0));
  if (index < 0) {
    throw new Error(`twoDeckOracle: unknown rank in card ${String(card)}`);
  }
  return index;
}

function suitOf(card: Card): string {
  return card.charAt(1);
}

/** Scores exactly 5 physical cards under the multiset semantics above. */
function score5(five: readonly Card[]): OracleResult {
  const ranks = five.map(rankIndexOf);
  const counts = new Array<number>(13).fill(0);
  for (const r of ranks) counts[r] += 1;

  // Five of a Kind: >= 5 physical cards of one rank (category 10, above Royal Flush,
  // D-05). Rank-only tiebreak — a 5-card hand has no kicker slot.
  for (let r = 12; r >= 0; r -= 1) {
    if (counts[r] >= 5) return { strength: 10, tiebreak: [r] };
  }

  const isFlush = five.every((card) => suitOf(card) === suitOf(five[0]));

  // Straight: five DISTINCT consecutive ranks (a duplicate copy never extends a
  // straight), wheel-aware with the wheel as the LOWEST straight (high card the 5).
  const distinct: number[] = [];
  for (let r = 0; r < 13; r += 1) {
    if (counts[r] > 0) distinct.push(r);
  }
  let straightHigh = -1;
  if (distinct.length === 5) {
    if (distinct[4] - distinct[0] === 4) {
      straightHigh = distinct[4];
    } else if (distinct[0] === 0 && distinct[1] === 1 && distinct[2] === 2 && distinct[3] === 3 && distinct[4] === 12) {
      straightHigh = 3; // the wheel: A-2-3-4-5, the 5 is high
    }
  }

  if (isFlush && straightHigh === 12) return { strength: 9, tiebreak: [12] };
  if (isFlush && straightHigh >= 0) return { strength: 8, tiebreak: [straightHigh] };

  // Rank-group tiebreak: the 5 ranks sorted by (multiplicity desc, rank desc).
  const grouped = ranks.slice().sort((a, b) => counts[b] - counts[a] || b - a);
  const maxCount = Math.max(...counts);

  if (maxCount === 4) return { strength: 7, tiebreak: grouped };
  if (maxCount === 3 && distinct.length === 2) return { strength: 6, tiebreak: grouped };
  if (isFlush) {
    // Assumption A1: the flush tiebreak is the 5-rank MULTISET descending — two
    // identical cards contribute two entries.
    return { strength: 5, tiebreak: ranks.slice().sort((a, b) => b - a) };
  }
  if (straightHigh >= 0) return { strength: 4, tiebreak: [straightHigh] };
  if (maxCount === 3) return { strength: 3, tiebreak: grouped };

  let pairCount = 0;
  for (const r of distinct) {
    if (counts[r] === 2) pairCount += 1;
  }
  if (pairCount === 2) return { strength: 2, tiebreak: grouped };
  if (pairCount === 1) return { strength: 1, tiebreak: grouped };
  return { strength: 0, tiebreak: ranks.slice().sort((a, b) => b - a) };
}

/** Total order over oracle results: category first, then lexicographic tiebreak. */
function compareOracleResults(a: OracleResult, b: OracleResult): number {
  if (a.strength !== b.strength) return a.strength > b.strength ? 1 : -1;
  const length = Math.min(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < length; i += 1) {
    if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] > b.tiebreak[i] ? 1 : -1;
  }
  return 0;
}

/**
 * Brute-force best-of-C(n,5): enumerates every 5-card subset of the window (21 subsets
 * for a 7-card window), scores each, and returns the maximum under the same total order
 * the production comparator implements.
 */
export function oracleScore(cards: readonly Card[]): OracleResult {
  const n = cards.length;
  if (n < 5) {
    throw new Error(`twoDeckOracle: need at least 5 cards, got ${String(n)}`);
  }
  // Iterative combination enumeration over index tuples idx[0] < ... < idx[4].
  const idx = [0, 1, 2, 3, 4];
  let best: OracleResult | null = null;
  for (;;) {
    const scored = score5([cards[idx[0]], cards[idx[1]], cards[idx[2]], cards[idx[3]], cards[idx[4]]]);
    if (best === null || compareOracleResults(scored, best) > 0) {
      best = scored;
    }
    // Advance to the next combination, rightmost index first.
    let i = 4;
    while (i >= 0 && idx[i] === n - 5 + i) i -= 1;
    if (i < 0) break;
    idx[i] += 1;
    for (let j = i + 1; j < 5; j += 1) idx[j] = idx[j - 1] + 1;
  }
  if (best === null) {
    throw new Error('twoDeckOracle: no subset scored — unreachable for n >= 5');
  }
  return best;
}
