/**
 * Blackjack hand values, natural detection, S17 dealer playout and outcome comparison
 * (D-03, D-03a, D-04). Pure rank arithmetic — no evaluator involvement anywhere (D-08).
 * Defends against the three silent-correctness traps PITFALLS.md documents for this
 * engine: Pitfall 2 (soft totals demoted once instead of in a loop), Pitfall 3 (S17
 * checked against a naively-computed total), and Pitfall 4 (any 21 priced as a natural).
 */
import { ALL_CARDS, getRank } from '@poker-apprentice/types';
import type { Card, Rank } from '@poker-apprentice/types';

/**
 * Blackjack point value per rank. Ace starts at 11 and is demoted by `handTotal`'s loop
 * as needed. Declared as an exhaustive `Record<Rank, number>` object literal so a missing
 * rank is a compile error (the `RANK_TO_ASSET` discipline from `PlayingCard.tsx`).
 */
const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

// Module-scope card lookups, built ONCE at load by iterating ALL_CARDS. `getRank`
// validates and throws on every invocation, so calling it per card inside a trial-loop
// function would be measurable waste across a 200k-trial run — it is never called below
// this block.
const CARD_VALUE = new Map<Card, number>();
const ACE_CARDS = new Set<Card>();
for (const card of ALL_CARDS) {
  const rank = getRank(card);
  CARD_VALUE.set(card, RANK_VALUE[rank]);
  if (rank === 'A') ACE_CARDS.add(card);
}

/**
 * Total over the closed `Card` union by construction (CARD_VALUE is built from ALL_CARDS
 * above), so the throw is an unreachable type-narrowing guard, not a real runtime path.
 */
function cardValue(card: Card): number {
  const value = CARD_VALUE.get(card);
  if (value === undefined) {
    throw new Error(`blackjackHandValue: unknown card ${String(card)}`);
  }
  return value;
}

export interface HandTotal {
  total: number;
  /** True iff at least one Ace is STILL being counted as 11 after the demotion loop. */
  soft: boolean;
  bust: boolean;
}

/**
 * The dealer's final-outcome bucket (BJ-03's 7 buckets). Closed literal union, mirroring
 * `DeckCount`'s style in `./shoe` — never a wider string, never a numeric code.
 */
export type DealerBucket = '17' | '18' | '19' | '20' | '21' | 'natural' | 'bust';

/** S17 (D-04): the dealer stands on ALL 17s — this threshold has no soft/hard variant. */
export const DEALER_STANDS_ON = 17;

/**
 * Hard/soft hand total (D-04). Accumulates with every ace worth 11 while counting soft
 * aces, then demotes ONE ace at a time until the hand is no longer bust or no soft ace
 * remains.
 */
export function handTotal(cards: readonly Card[]): HandTotal {
  let total = 0;
  let softAces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (ACE_CARDS.has(card)) softAces += 1;
  }
  // Demote ONE ace at a time, in a LOOP. The loop (not a single one-time `if` demotion)
  // is what makes 1, 2 and 3 aces uniformly correct — a single demotion misclassifies
  // [A,A,9] (soft 21) and wrongly busts [A,A,A,8] (PITFALLS Pitfall 2).
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return { total, soft: softAces > 0, bust: total > 21 };
}

/**
 * Natural detection (D-03). The `cards.length === 2` guard is what keeps a hit-into-21
 * from being priced 3:2 — a 21 reached via 3+ cards is a plain 21, never a natural
 * (PITFALLS Pitfall 4). Only ever evaluated at deal time, on the initial 2-card hand.
 */
export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

/**
 * Plays the dealer's hand out under S17 (D-04): hit while total < DEALER_STANDS_ON, no
 * soft/hard branch. S17 means "stand on ALL 17s, hard or soft", so the ABSENCE of a
 * softness branch here is correct — the trap is a naively-computed total (aces always 11
 * or always 1), not a missing branch, which is why the loop condition reads `handTotal`'s
 * fully-demoted result on every iteration (PITFALLS Pitfall 3).
 */
export function playDealerHand(
  upcard: Card,
  hole: Card,
  drawNext: () => Card,
): { cards: Card[]; result: HandTotal } {
  const cards: Card[] = [upcard, hole];
  let result = handTotal(cards);
  while (!result.bust && result.total < DEALER_STANDS_ON) {
    cards.push(drawNext());
    result = handTotal(cards);
  }
  return { cards, result };
}

/**
 * Buckets a completed dealer hand into BJ-03's 7 buckets. A 2-card 21 is `'natural'`;
 * a 21 via 3+ cards is `'21'` (PITFALLS Pitfall 4's distinction, applied to the dealer).
 */
export function classifyDealerOutcome(cards: readonly Card[], result: HandTotal): DealerBucket {
  if (result.bust) return 'bust';
  if (cards.length === 2 && result.total === 21) return 'natural';
  return String(result.total) as '17' | '18' | '19' | '20' | '21';
}

/**
 * Win/push/lose comparison against a completed dealer hand (D-04), including the
 * natural-priority rule.
 */
export function compareToDealer(
  player: { total: number; bust: boolean },
  dealer: { total: number; bust: boolean; bucket: DealerBucket },
): 'win' | 'push' | 'lose' {
  if (player.bust) return 'lose';
  if (dealer.bust) return 'win';
  // Dealer natural beats ANY non-natural total, including a non-natural 21 — never a
  // push. The REAL round can never reach a Stand decision against an actual dealer
  // natural (D-03a resolves those at deal time), but the Monte Carlo trial loop
  // legitimately samples natural-shaped hypothetical holes under Option A — dropping
  // this branch would silently miscount those trials as pushes, a skew invisible to any
  // smoke test (06-RESEARCH Pitfall F).
  if (dealer.bucket === 'natural') return 'lose';
  if (player.total > dealer.total) return 'win';
  if (player.total < dealer.total) return 'lose';
  return 'push';
}
