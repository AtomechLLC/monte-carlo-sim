// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import {
  handTotal,
  isNatural,
  playDealerHand,
  classifyDealerOutcome,
  compareToDealer,
  DEALER_STANDS_ON,
  type DealerBucket,
} from './blackjackHandValue';

// Exact-value vectors transcribed from 06-RESEARCH "Reference test vectors — hand value".
// The Note column from that table is kept as the case name, so a failure names the trap it
// caught (D-04, PITFALLS Pitfalls 2/3/4).

/**
 * A scripted `drawNext` that throws the moment it is asked for more cards than were
 * scripted — every playDealerHand case below therefore doubles as the "never calls
 * drawNext more times than needed" assertion.
 */
function scriptedDrawer(cards: readonly Card[]): () => Card {
  let next = 0;
  return () => {
    if (next >= cards.length) {
      throw new Error(`drawNext called ${String(next + 1)} times but only ${String(cards.length)} cards were scripted`);
    }
    return cards[next++];
  };
}

describe('handTotal — hard/soft totals with the one-ace-at-a-time demotion loop', () => {
  it.each<{ cards: Card[]; total: number; soft: boolean; bust: boolean; note: string }>([
    { cards: ['7h', '7c'], total: 14, soft: false, bust: false, note: 'plain hard total, no aces' },
    { cards: ['Ah', '6c'], total: 17, soft: true, bust: false, note: 'canonical soft 17' },
    {
      cards: ['6h', '6c', 'Ad'],
      total: 13,
      soft: false,
      bust: false,
      note: 'canonical Pitfall-2 vector: naive "contains an ace" softness check would misclassify this as soft; correct demotion yields hard 13',
    },
    {
      cards: ['Ah', '6c', 'Td'],
      total: 17,
      soft: false,
      bust: false,
      note: 'canonical "hard 17 despite an Ace" vector (PITFALLS Pitfalls 2/3): 11+6+10=27>21, demote, 17 hard',
    },
    {
      cards: ['Ah', 'Ac', '9d'],
      total: 21,
      soft: true,
      bust: false,
      note: 'multiple-aces vector: 11+11+9=31>21, demote once, 21 with one ace still soft',
    },
    {
      cards: ['Ah', 'Ac', 'Ad', '8c'],
      total: 21,
      soft: true,
      bust: false,
      note: 'three-aces vector: 41>21, demote twice, 21 with one ace still soft',
    },
    { cards: ['Kh', 'Qc', '2d'], total: 22, soft: false, bust: true, note: 'plain bust, no aces involved' },
    { cards: ['Ah', 'Kc'], total: 21, soft: true, bust: false, note: 'two-card 21 (the natural shape) totals a soft 21' },
    {
      cards: ['7h', '7c', '7d'],
      total: 21,
      soft: false,
      bust: false,
      note: 'three-card 21: same total as a natural, reached via 3 cards — a plain hard 21',
    },
  ])('$note', ({ cards, total, soft, bust }) => {
    expect(handTotal(cards)).toEqual({ total, soft, bust });
  });
});

describe('isNatural — 2-card guard, never any-21 (PITFALLS Pitfall 4)', () => {
  it('a 2-card 21 is a natural', () => {
    expect(isNatural(['Ah', 'Kc'])).toBe(true);
  });

  it('a three-card 21 is never a natural — it must not be priced 3:2', () => {
    expect(isNatural(['7h', '7c', '7d'])).toBe(false);
  });

  it('a single card is never a natural', () => {
    expect(isNatural(['Ah'])).toBe(false);
  });
});

describe('playDealerHand — S17 playout (stand on ALL 17s, D-04)', () => {
  it('exports DEALER_STANDS_ON = 17', () => {
    expect(DEALER_STANDS_ON).toBe(17);
  });

  it('stands on soft 17 [Ah,6c] without drawing (S17 — no draw taken)', () => {
    const { cards, result } = playDealerHand('Ah', '6c', scriptedDrawer([]));
    expect(cards).toEqual(['Ah', '6c']);
    expect(result).toEqual({ total: 17, soft: true, bust: false });
  });

  it('stands on hard 17 [6c,Td,Ah] reached through ace demotion mid-playout', () => {
    // 6+10=16 -> hit -> Ah -> 27 raw -> demote -> hard 17 -> stand. A naive always-11 ace
    // total would read 27 and misclassify; a naive always-1 total would read 17 the same way
    // here but diverge on the soft-17 case above (PITFALLS Pitfall 3).
    const { cards, result } = playDealerHand('6c', 'Td', scriptedDrawer(['Ah']));
    expect(cards).toEqual(['6c', 'Td', 'Ah']);
    expect(result).toEqual({ total: 17, soft: false, bust: false });
  });

  it('draws on 15 [9d,6s] until reaching at least 17', () => {
    const { cards, result } = playDealerHand('9d', '6s', scriptedDrawer(['2c']));
    expect(cards).toEqual(['9d', '6s', '2c']);
    expect(result).toEqual({ total: 17, soft: false, bust: false });
  });

  it('stops the instant it busts — no draw after the busting card', () => {
    const { cards, result } = playDealerHand('9d', '6s', scriptedDrawer(['Kh']));
    expect(cards).toEqual(['9d', '6s', 'Kh']);
    expect(result).toEqual({ total: 25, soft: false, bust: true });
  });
});

describe('classifyDealerOutcome — 7-bucket classification', () => {
  it('returns "natural" for a 2-card 21', () => {
    const cards: Card[] = ['Ac', 'Ks'];
    expect(classifyDealerOutcome(cards, handTotal(cards))).toBe<DealerBucket>('natural');
  });

  it('returns "21" for a 3-card 21 — never the natural bucket', () => {
    const cards: Card[] = ['7h', '7c', '7d'];
    expect(classifyDealerOutcome(cards, handTotal(cards))).toBe<DealerBucket>('21');
  });

  it('returns "bust" for 22+', () => {
    const cards: Card[] = ['Kh', 'Qc', '2d'];
    expect(classifyDealerOutcome(cards, handTotal(cards))).toBe<DealerBucket>('bust');
  });

  it.each<{ cards: Card[]; bucket: DealerBucket }>([
    { cards: ['Th', '7c'], bucket: '17' },
    { cards: ['Th', '8c'], bucket: '18' },
    { cards: ['Th', '9c'], bucket: '19' },
    { cards: ['Th', 'Qc'], bucket: '20' },
  ])('returns "$bucket" for a standing total of $bucket', ({ cards, bucket }) => {
    expect(classifyDealerOutcome(cards, handTotal(cards))).toBe(bucket);
  });
});

describe('compareToDealer — win/push/lose with dealer-natural priority (06-RESEARCH Pitfall F)', () => {
  it('player bust loses even when the dealer also busts', () => {
    expect(compareToDealer({ total: 22, bust: true }, { total: 25, bust: true, bucket: 'bust' })).toBe('lose');
  });

  it('dealer bust (player not bust) wins', () => {
    expect(compareToDealer({ total: 12, bust: false }, { total: 22, bust: true, bucket: 'bust' })).toBe('win');
  });

  it('dealer natural beats a non-natural 21 — LOSE, never a push', () => {
    // Reference vector: dealer [Ac,Ks] (natural) vs. player 21 via [7h,7c,7d].
    expect(compareToDealer({ total: 21, bust: false }, { total: 21, bust: false, bucket: 'natural' })).toBe('lose');
  });

  it('higher player total wins', () => {
    expect(compareToDealer({ total: 20, bust: false }, { total: 18, bust: false, bucket: '18' })).toBe('win');
  });

  it('lower player total loses', () => {
    expect(compareToDealer({ total: 17, bust: false }, { total: 19, bust: false, bucket: '19' })).toBe('lose');
  });

  it('equal non-natural totals push', () => {
    expect(compareToDealer({ total: 18, bust: false }, { total: 18, bust: false, bucket: '18' })).toBe('push');
  });
});
