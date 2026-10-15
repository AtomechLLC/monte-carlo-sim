import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';

/**
 * The roulette wheel (quick task 261015-ch8).
 *
 * Two wheels, as the explorable variable: a single-zero wheel (37 pockets) and a double-zero
 * wheel (38). Pockets are their printed labels — '0', '00', '1'..'36' — never numbers, because
 * '00' is a distinct pocket that no integer can name without a sentinel.
 *
 * Nothing here is random on its own: every spin takes an injected `RandomGenerator` from
 * `./rng`, so the frequency anchors in roulette.test.ts are seeded and deterministic and
 * `Math.random()` never enters the picture (the project-wide rule).
 */
export type WheelKind = 'european' | 'american';
export type PocketColor = 'red' | 'black' | 'green';
/** A pocket as printed on the wheel: '0', '00' or '1'..'36'. */
export type Pocket = string;

/** Spins per press of the Spin button — the user's "run 100 simulations". */
export const SPINS_PER_BATCH = 100;

/**
 * Pocket order around the single-zero wheel, clockwise from the zero. This is the physical
 * layout every casino wheel shares; the SVG wheel draws it verbatim so the wheel on screen is
 * the wheel in the room.
 */
export const EUROPEAN_WHEEL: readonly Pocket[] = [
  '0', '32', '15', '19', '4', '21', '2', '25', '17', '34', '6', '27', '13', '36', '11', '30', '8',
  '23', '10', '5', '24', '16', '33', '1', '20', '14', '31', '9', '22', '18', '29', '7', '28', '12',
  '35', '3', '26',
];

/** Pocket order around the double-zero wheel, clockwise from the zero. */
export const AMERICAN_WHEEL: readonly Pocket[] = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36',
  '13', '1', '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4',
  '23', '35', '14', '2',
];

/** The eighteen red numbers. Every other number 1..36 is black; the zeros are green. */
export const RED_POCKETS: ReadonlySet<Pocket> = new Set([
  '1', '3', '5', '7', '9', '12', '14', '16', '18', '19', '21', '23', '25', '27', '30', '32', '34', '36',
]);

/** The numbers 1..36 in layout order — the betting grid's row source. */
export const LAYOUT_NUMBERS: readonly Pocket[] = Array.from({ length: 36 }, (_, i) => String(i + 1));

export function wheelPockets(wheel: WheelKind): readonly Pocket[] {
  return wheel === 'american' ? AMERICAN_WHEEL : EUROPEAN_WHEEL;
}

export function pocketCount(wheel: WheelKind): number {
  return wheelPockets(wheel).length;
}

/** The green pockets a wheel carries: ['0'] or ['0', '00']. */
export function greenPockets(wheel: WheelKind): readonly Pocket[] {
  return wheel === 'american' ? ['0', '00'] : ['0'];
}

export function isPocketOnWheel(wheel: WheelKind, pocket: Pocket): boolean {
  return wheelPockets(wheel).includes(pocket);
}

/** Throws on a label that is on neither wheel — a malformed pocket must fail loudly. */
export function pocketColor(pocket: Pocket): PocketColor {
  if (pocket === '0' || pocket === '00') return 'green';
  if (RED_POCKETS.has(pocket)) return 'red';
  if (LAYOUT_NUMBERS.includes(pocket)) return 'black';
  throw new Error(`pocketColor: "${pocket}" is not a roulette pocket`);
}

/**
 * What the player predicted: a colour, or one straight-up pocket. The store holds up to one of
 * each at a time and scores them independently — the user's "a number and/or a colour".
 */
export type PredictionTarget =
  | { readonly kind: 'color'; readonly color: PocketColor }
  | { readonly kind: 'number'; readonly pocket: Pocket };

/** Human label for a target: 'Red', 'Black', 'Green', or the pocket itself. */
export function targetLabel(target: PredictionTarget): string {
  if (target.kind === 'number') return target.pocket;
  return target.color.charAt(0).toUpperCase() + target.color.slice(1);
}

/** How many of the wheel's pockets make the target win. */
export function pocketsCovered(wheel: WheelKind, target: PredictionTarget): number {
  if (target.kind === 'number') return isPocketOnWheel(wheel, target.pocket) ? 1 : 0;
  if (target.color === 'green') return greenPockets(wheel).length;
  return 18;
}

/** The closed-form probability the target hits on one spin: covered pockets over all pockets. */
export function trueProbability(wheel: WheelKind, target: PredictionTarget): number {
  return pocketsCovered(wheel, target) / pocketCount(wheel);
}

/**
 * Payout in units per unit staked, derived rather than tabulated: `36 / covered − 1` gives
 * the real-table figures (35:1 straight up, 1:1 on a colour, 17:1 on the American 0–00 pair)
 * AND makes every bet's expected value exactly `(36 − N) / N` — the one house edge per wheel.
 * roulette.property.test.ts pins that equality for every target. 0 for a target that covers
 * nothing (a pocket not on this wheel), which the store never lets through.
 */
export function payoutFor(wheel: WheelKind, target: PredictionTarget): number {
  const covered = pocketsCovered(wheel, target);
  return covered === 0 ? 0 : 36 / covered - 1;
}

/** The house's expected take per unit staked, as a positive fraction: 1/37 or 2/38. */
export function houseEdge(wheel: WheelKind): number {
  const count = pocketCount(wheel);
  return (count - 36) / count;
}

export function targetHits(pocket: Pocket, target: PredictionTarget): boolean {
  return target.kind === 'number' ? pocket === target.pocket : pocketColor(pocket) === target.color;
}

export function countHits(spins: readonly Pocket[], target: PredictionTarget): number {
  let hits = 0;
  for (const pocket of spins) {
    if (targetHits(pocket, target)) hits += 1;
  }
  return hits;
}

/** One spin: a uniformly random pocket of the wheel. */
export function spinOnce(rng: RandomGenerator, wheel: WheelKind): Pocket {
  const pockets = wheelPockets(wheel);
  return pockets[uniformInt(rng, 0, pockets.length - 1)];
}

/** `count` independent spins, in order. */
export function spinMany(rng: RandomGenerator, wheel: WheelKind, count: number): Pocket[] {
  const spins: Pocket[] = [];
  for (let i = 0; i < count; i++) {
    spins.push(spinOnce(rng, wheel));
  }
  return spins;
}
