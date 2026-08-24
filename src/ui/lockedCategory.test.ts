// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '../engine/evaluator';
import { lockedInCategory } from './lockedCategory';

describe('lockedInCategory', () => {
  it('returns null when fewer than 5 cards are known (pre-flop, even with a pocket pair)', () => {
    const heroHole: [Card, Card] = ['Ac', 'Ad'];
    expect(lockedInCategory(heroHole, [])).toBeNull();
  });

  it('returns One Pair for AK on an A-7-2 flop', () => {
    const heroHole: [Card, Card] = ['Ac', 'Kd'];
    const knownBoard: Card[] = ['Ah', '7c', '2d'];
    expect(lockedInCategory(heroHole, knownBoard)).toBe(HandStrength.OnePair);
  });

  it('returns Three of a Kind for pocket aces on an A-7-2 flop', () => {
    const heroHole: [Card, Card] = ['Ac', 'Ad'];
    const knownBoard: Card[] = ['Ah', '7c', '2d'];
    expect(lockedInCategory(heroHole, knownBoard)).toBe(HandStrength.ThreeOfAKind);
  });

  it('returns null when heroHole itself is null', () => {
    const knownBoard: Card[] = ['Ah', '7c', '2d', '3s', '4h'];
    expect(lockedInCategory(null, knownBoard)).toBeNull();
  });

  it('always returns a valid CATEGORY_LABELS index (0-9) when non-null', () => {
    const heroHole: [Card, Card] = ['Ac', 'Kd'];
    const knownBoard: Card[] = ['Ah', '7c', '2d'];
    const result = lockedInCategory(heroHole, knownBoard);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(9);
  });
});
