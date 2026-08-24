// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';
import { evaluateHand, compareHands, rawCompareForTesting } from './evaluator';

describe('evaluateHand — hand-category correctness', () => {
  it('(a) ranks the A-2-3-4-5 wheel straight correctly', () => {
    const hole: [Card, Card] = ['As', '2h'];
    const community: Card[] = ['3d', '4c', '5s', 'Kd', 'Qh'];

    const hand = evaluateHand(hole, community);

    expect(hand.strength).toBe(HandStrength.Straight);
  });

  it('(b) treats a royal flush as its own category, distinct from a straight flush', () => {
    const hole: [Card, Card] = ['As', 'Ks'];
    const community: Card[] = ['Qs', 'Js', 'Ts', '2d', '3h'];

    const hand = evaluateHand(hole, community);

    expect(hand.strength).toBe(HandStrength.RoyalFlush);
    expect(hand.strength).not.toBe(HandStrength.StraightFlush);
  });

  it('(c) keeps a straight flush distinct from a royal flush', () => {
    const hole: [Card, Card] = ['9s', '8s'];
    const community: Card[] = ['7s', '6s', '5s', '2d', '3h'];

    const hand = evaluateHand(hole, community);

    expect(hand.strength).toBe(HandStrength.StraightFlush);
  });

  it('(d) resolves kicker comparisons correctly', () => {
    const community: Card[] = ['Ad', '7c', '2s', '9h', '3d'];
    const better = evaluateHand(['As', 'Kd'], community);
    const worse = evaluateHand(['Ah', 'Qd'], community);

    expect(compareHands(better, worse)).toBe(1);
    expect(compareHands(worse, better)).toBe(-1);
  });

  it('(e) recognises a split pot when the best hand is entirely on the board', () => {
    const community: Card[] = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
    const handA = evaluateHand(['2c', '3d'], community);
    const handB = evaluateHand(['4c', '5d'], community);

    expect(compareHands(handA, handB)).toBe(0);
  });

  it('(f) pins the raw library comparator sign convention so an upstream flip fails loudly here', () => {
    const community: Card[] = ['Ad', '7c', '2s', '9h', '3d'];
    const better = evaluateHand(['As', 'Kd'], community);
    const worse = evaluateHand(['Ah', 'Qd'], community);

    // Wrapper convention: +1 means `a` (first arg) is the STRONGER hand.
    expect(compareHands(better, worse)).toBe(1);
    // Raw library convention: -1 means `a` (first arg) is the STRONGER hand — the reverse.
    expect(rawCompareForTesting(better, worse)).toBe(-1);
  });
});
