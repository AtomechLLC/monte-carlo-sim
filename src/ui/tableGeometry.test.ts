import { describe, it, expect } from 'vitest';
import { POSITIONS, dealOriginOffset, dealIndex } from './tableGeometry';
import type { PositionKey } from './tableGeometry';

describe('tableGeometry — dealer-rotation ordering (A3)', () => {
  it('maps the 8 hole-card slots to the dealer rotation 0..7', () => {
    const sequence = [
      dealIndex(0, 0),
      dealIndex(1, 0),
      dealIndex(2, 0),
      dealIndex('hero', 0),
      dealIndex(0, 1),
      dealIndex(1, 1),
      dealIndex(2, 1),
      dealIndex('hero', 1),
    ];
    expect(sequence).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('tableGeometry — deck-origin offsets', () => {
  it('dealOriginOffset(deck-origin) is {x: 0, y: 0}', () => {
    expect(dealOriginOffset('deck-origin')).toEqual({ x: 0, y: 0 });
  });

  it('dealOriginOffset(seat-hero) has a positive x and a negative y (deck is right of and above hero)', () => {
    const offset = dealOriginOffset('seat-hero');
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeLessThan(0);
  });

  it('returns a distinct offset for each of the ten position keys', () => {
    const keys = Object.keys(POSITIONS) as PositionKey[];
    expect(keys).toHaveLength(10);

    const offsets = keys.map((key) => dealOriginOffset(key));
    const serialized = offsets.map((o) => `${o.x},${o.y}`);
    expect(new Set(serialized).size).toBe(10);
  });
});
