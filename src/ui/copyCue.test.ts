// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { PredeterminedRunout } from '../engine/conditioning';
import { copyCuedSlots, heroCueKey, communityCueKey, opponentCueKey } from './copyCue';

// Headless known-vector suite for the D-08/HE2-03 canonical-scan second-copy derivation,
// in lockedCategory.test.ts's style: explicit PredeterminedRunout literals so a failure
// names exact cards, exact-set assertions, no store and no DOM.

describe('slot-key composers', () => {
  it('compose the exact slot-key formats the felt render paths consume', () => {
    expect(heroCueKey(0)).toBe('hero-0');
    expect(heroCueKey(1)).toBe('hero-1');
    expect(communityCueKey(0)).toBe('community-0');
    expect(communityCueKey(4)).toBe('community-4');
    expect(opponentCueKey(0, 0)).toBe('opponent-0-0');
    expect(opponentCueKey(2, 1)).toBe('opponent-2-1');
  });
});

describe('copyCuedSlots', () => {
  it('returns an empty set at deckCount 1 even for a runout that (impossibly) contains duplicates — the guard is structural, not incidental', () => {
    // Duplicates everywhere a duplicate could be: hero pair of Ah, board pair of Kd,
    // opponent 0 pair of Qs — all visible at river with every opponent revealed.
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Ah'],
      board: ['Kd', '2c', 'Kd', '9s', '4c'],
      opponentHoles: [
        ['Qs', 'Qs'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    expect(copyCuedSlots(runout, 'river', 0b111, 1).size).toBe(0);
    // And for every street/mask shape, still empty at one deck.
    expect(copyCuedSlots(runout, 'preflop', 0, 1).size).toBe(0);
    expect(copyCuedSlots(runout, 'flop', 0b001, 1).size).toBe(0);
  });

  it('returns an empty set when runout is null', () => {
    expect(copyCuedSlots(null, 'preflop', 0, 2).size).toBe(0);
    expect(copyCuedSlots(null, 'river', 0b111, 2).size).toBe(0);
  });

  it('returns an empty set when no duplicates exist among visible cards (all 13 distinct, everything revealed)', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['As', 'Kd'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    expect(copyCuedSlots(runout, 'river', 0b111, 2).size).toBe(0);
  });

  it('badges exactly hero-1 when the hero holds both copies preflop — the FIRST encounter is never badged', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Ah'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    const cued = copyCuedSlots(runout, 'preflop', 0, 2);
    expect(cued.has(heroCueKey(0))).toBe(false);
    expect(cued.has(heroCueKey(1))).toBe(true);
    expect(cued.size).toBe(1);
  });

  it("a settled hero card's twin arriving on the flop gains the cue at the board slot, and rewinding to preflop empties the set again", () => {
    // Hero holds one Ah; its twin is board index 1, first visible at the flop.
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Kd'],
      board: ['2c', 'Ah', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    // Preflop: the twin is not yet visible — nothing is badged.
    expect(copyCuedSlots(runout, 'preflop', 0, 2).size).toBe(0);
    // Flop: the twin boards — the BOARD copy (later in scan) wears the cue, not the
    // already-settled hero card.
    const atFlop = copyCuedSlots(runout, 'flop', 0, 2);
    expect([...atFlop]).toEqual([communityCueKey(1)]);
    // Rewind back to preflop: recomputed deterministically — empty again (both directions).
    expect(copyCuedSlots(runout, 'preflop', 0, 2).size).toBe(0);
  });

  it('badges exactly community-2 when the board holds both copies at flop positions 0 and 2', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['As', 'Kh'],
      board: ['Qd', '2c', 'Qd', '9s', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    const cued = copyCuedSlots(runout, 'flop', 0, 2);
    expect([...cued]).toEqual([communityCueKey(2)]);
  });

  it("an unrevealed opponent's twin of a hero card produces no badge — hidden cards are not visible cards", () => {
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Kd'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['Ah', '3s'], // opponent 1 holds the hero's twin — but is not revealed
        ['5h', '6c'],
      ],
    };
    expect(copyCuedSlots(runout, 'river', 0, 2).size).toBe(0);
  });

  it("revealing that opponent badges exactly that opponent's slot", () => {
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Kd'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['Ah', '3s'],
        ['5h', '6c'],
      ],
    };
    const cued = copyCuedSlots(runout, 'river', 1 << 1, 2);
    expect([...cued]).toEqual([opponentCueKey(1, 0)]);
  });

  it('with two DIFFERENT revealed opponents each holding one copy, the badge lands on the higher SEAT index regardless of mask construction order', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['As', 'Kh'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qd', 'Th'], // seat 0 holds one Qd
        ['8d', '3s'],
        ['Qd', '6c'], // seat 2 holds the other Qd
      ],
    };
    // revealedMask is a SET, not a chronology: build the same mask two different ways
    // (seat 0 revealed first vs seat 2 revealed first) and assert identical output.
    const maskSeat0First = (1 << 0) | (1 << 2);
    const maskSeat2First = (1 << 2) | (1 << 0);
    const a = copyCuedSlots(runout, 'river', maskSeat0First, 2);
    const b = copyCuedSlots(runout, 'river', maskSeat2First, 2);
    expect([...a]).toEqual([opponentCueKey(2, 0)]);
    expect([...b]).toEqual([opponentCueKey(2, 0)]);
  });

  it('badges exactly one slot per value with three distinct duplicated values visible at once', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Ah'], // dup value 1 -> hero-1
      board: ['Kd', 'Kd', '2c', '9s', '4c'], // dup value 2 -> community-1 (flop shows 0-2)
      opponentHoles: [
        ['Qs', 'Qs'], // dup value 3 -> opponent-0-1 (revealed)
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    const cued = copyCuedSlots(runout, 'flop', 1 << 0, 2);
    expect(cued.has(heroCueKey(1))).toBe(true);
    expect(cued.has(communityCueKey(1))).toBe(true);
    expect(cued.has(opponentCueKey(0, 1))).toBe(true);
    expect(cued.size).toBe(3);
  });

  it('never keys a value with only one visible copy, even though its twin exists in the undealt shoe at 2 decks', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['As', 'Kd'],
      board: ['2c', '7d', '9s', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    const cued = copyCuedSlots(runout, 'river', 0b111, 2);
    expect(cued.has(heroCueKey(0))).toBe(false);
    expect(cued.has(heroCueKey(1))).toBe(false);
    expect(cued.size).toBe(0);
  });

  it('is deterministic: two calls with identical arguments yield sets with identical contents', () => {
    const runout: PredeterminedRunout = {
      heroHole: ['Ah', 'Kd'],
      board: ['Ah', '7d', 'Kd', 'Jh', '4c'],
      opponentHoles: [
        ['Qs', 'Th'],
        ['8d', '3s'],
        ['5h', '6c'],
      ],
    };
    const first = copyCuedSlots(runout, 'turn', 0b101, 2);
    const second = copyCuedSlots(runout, 'turn', 0b101, 2);
    expect([...first].sort()).toEqual([...second].sort());
    expect(first.size).toBe(second.size);
  });
});
