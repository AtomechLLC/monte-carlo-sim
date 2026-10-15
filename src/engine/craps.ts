import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import type { TalliedOutcomes } from './predictionScore';

/**
 * Craps (quick task 261015-d7o): two dice, seven bets, and the resolution rules that turn a
 * sequence of rolls into one decision. Every probability here is a closed form; the seeded
 * anchors in craps.test.ts check the sampler against them, and the scripted-roll tests check
 * the resolution rules roll by roll.
 *
 * Nothing here is random on its own: every roll takes an injected `RandomGenerator` from
 * `./rng`, the project-wide rule.
 */
export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Roll = readonly [Die, Die];

/** Decisions per press of the Roll button — the user's "run 100 simulations". */
export const TRIALS_PER_BATCH = 100;

/** The eleven totals two dice can make. */
export const DICE_TOTALS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Ways to roll each total out of the 36 ordered pairs — the triangle under everything. */
export const WAYS_TO_ROLL: Readonly<Record<number, number>> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export function totalProbability(total: number): number {
  return (WAYS_TO_ROLL[total] ?? 0) / 36;
}

export type CrapsBet = 'pass' | 'dontPass' | 'field' | 'anySeven' | 'anyCraps' | 'place6' | 'place8';

export const CRAPS_BETS: readonly CrapsBet[] = ['pass', 'dontPass', 'field', 'anySeven', 'anyCraps', 'place6', 'place8'];

export const BET_LABELS: Readonly<Record<CrapsBet, string>> = {
  pass: 'Pass line',
  dontPass: "Don't pass",
  field: 'Field',
  anySeven: 'Any seven',
  anyCraps: 'Any craps',
  place6: 'Place 6',
  place8: 'Place 8',
};

/** The house rule most tables vary: whether a Field 12 pays triple or double. */
export type FieldRule = 'triple12' | 'double12';

/** The headline payout per unit staked — what the score card prints as "pays N to 1". */
export function betPayout(bet: CrapsBet): number {
  switch (bet) {
    case 'pass':
    case 'dontPass':
    case 'field':
      return 1;
    case 'anySeven':
      return 4;
    case 'anyCraps':
      return 7;
    case 'place6':
    case 'place8':
      return 7 / 6;
  }
}

export function betPayoutText(bet: CrapsBet, fieldRule: FieldRule): string {
  switch (bet) {
    case 'field':
      return `pays 1 to 1 · 2 pays double · 12 pays ${fieldRule === 'triple12' ? 'triple' : 'double'}`;
    case 'place6':
    case 'place8':
      return 'pays 7 to 6';
    case 'dontPass':
      return 'pays 1 to 1 · bar 12';
    default:
      return `pays ${betPayout(bet)} to 1`;
  }
}

/** Where a Field roll pays, and how much: the one bet whose payout depends on the total. */
function fieldUnits(total: number, fieldRule: FieldRule): number {
  if (total === 2) return 2;
  if (total === 12) return fieldRule === 'triple12' ? 3 : 2;
  if (total === 3 || total === 4 || total === 9 || total === 10 || total === 11) return 1;
  return -1;
}

/**
 * Closed-form win probabilities. Pass line: 8/36 on the come-out, then each point's chance of
 * repeating before a 7 (4/10: 1/3, 5/9: 2/5, 6/8: 5/11) weighted by its chance of being set —
 * 244/495. Don't pass wins where pass loses EXCEPT the come-out 12, which pushes: 949/1980.
 */
export function winProbability(bet: CrapsBet): number {
  switch (bet) {
    case 'pass':
      return 244 / 495;
    case 'dontPass':
      return 949 / 1980;
    case 'field':
      return 16 / 36;
    case 'anySeven':
      return 6 / 36;
    case 'anyCraps':
      return 4 / 36;
    case 'place6':
    case 'place8':
      return 5 / 11;
  }
}

/** Only Don't pass can push — a 12 on the come-out, 1/36. */
export function pushProbability(bet: CrapsBet): number {
  return bet === 'dontPass' ? 1 / 36 : 0;
}

/** Expected value per unit staked, as a (negative) fraction. */
export function expectedValue(bet: CrapsBet, fieldRule: FieldRule): number {
  switch (bet) {
    case 'pass':
      return -7 / 495;
    case 'dontPass':
      return -27 / 1980;
    case 'field':
      return fieldRule === 'triple12' ? -1 / 36 : -2 / 36;
    case 'anySeven':
      return -1 / 6;
    case 'anyCraps':
      return -1 / 9;
    case 'place6':
    case 'place8':
      return -1 / 66;
  }
}

/** The house's expected take per unit staked, as a positive fraction. */
export function houseEdge(bet: CrapsBet, fieldRule: FieldRule): number {
  return -expectedValue(bet, fieldRule);
}

export type TrialOutcome = 'win' | 'lose' | 'push';

/** One resolved decision: every roll it took, how it ended, and the net at one unit staked. */
export interface CrapsTrial {
  rolls: Roll[];
  outcome: TrialOutcome;
  units: number;
  /** The point the trial was decided on, or null if it settled on the come-out / a single roll. */
  point: number | null;
}

export function rollDie(rng: RandomGenerator): Die {
  return uniformInt(rng, 1, 6) as Die;
}

export function rollDice(rng: RandomGenerator): Roll {
  return [rollDie(rng), rollDie(rng)];
}

export function rollTotal(roll: Roll): number {
  return roll[0] + roll[1];
}

function isPoint(total: number): boolean {
  return total === 4 || total === 5 || total === 6 || total === 8 || total === 9 || total === 10;
}

/**
 * Resolves one decision of `bet`, pulling rolls from `rollNext` until the bet settles. The
 * injected roll source is what makes every rule testable roll by roll with a scripted queue.
 */
export function resolveBet(bet: CrapsBet, fieldRule: FieldRule, rollNext: () => Roll): CrapsTrial {
  const rolls: Roll[] = [];
  const next = (): number => {
    const roll = rollNext();
    rolls.push(roll);
    return rollTotal(roll);
  };

  switch (bet) {
    case 'pass': {
      const comeOut = next();
      if (comeOut === 7 || comeOut === 11) return { rolls, outcome: 'win', units: 1, point: null };
      if (comeOut === 2 || comeOut === 3 || comeOut === 12) return { rolls, outcome: 'lose', units: -1, point: null };
      for (;;) {
        const total = next();
        if (total === comeOut) return { rolls, outcome: 'win', units: 1, point: comeOut };
        if (total === 7) return { rolls, outcome: 'lose', units: -1, point: comeOut };
      }
    }
    case 'dontPass': {
      const comeOut = next();
      if (comeOut === 2 || comeOut === 3) return { rolls, outcome: 'win', units: 1, point: null };
      if (comeOut === 7 || comeOut === 11) return { rolls, outcome: 'lose', units: -1, point: null };
      if (comeOut === 12) return { rolls, outcome: 'push', units: 0, point: null };
      for (;;) {
        const total = next();
        if (total === 7) return { rolls, outcome: 'win', units: 1, point: comeOut };
        if (total === comeOut) return { rolls, outcome: 'lose', units: -1, point: comeOut };
      }
    }
    case 'field': {
      const units = fieldUnits(next(), fieldRule);
      return { rolls, outcome: units > 0 ? 'win' : 'lose', units, point: null };
    }
    case 'anySeven': {
      const won = next() === 7;
      return { rolls, outcome: won ? 'win' : 'lose', units: won ? 4 : -1, point: null };
    }
    case 'anyCraps': {
      const total = next();
      const won = total === 2 || total === 3 || total === 12;
      return { rolls, outcome: won ? 'win' : 'lose', units: won ? 7 : -1, point: null };
    }
    case 'place6':
    case 'place8': {
      const number = bet === 'place6' ? 6 : 8;
      for (;;) {
        const total = next();
        if (total === number) return { rolls, outcome: 'win', units: 7 / 6, point: number };
        if (total === 7) return { rolls, outcome: 'lose', units: -1, point: number };
      }
    }
  }
}

/** `count` independent decisions of `bet`, each with every roll it took. */
export function runTrials(rng: RandomGenerator, bet: CrapsBet, fieldRule: FieldRule, count: number): CrapsTrial[] {
  const trials: CrapsTrial[] = [];
  const rollNext = () => rollDice(rng);
  for (let i = 0; i < count; i++) {
    trials.push(resolveBet(bet, fieldRule, rollNext));
  }
  return trials;
}

/** Wins, pushes, trials and the summed net — the tally `scoreTallied` reads. */
export function tallyTrials(trials: readonly CrapsTrial[]): TalliedOutcomes {
  let hits = 0;
  let pushes = 0;
  let netUnits = 0;
  for (const trial of trials) {
    if (trial.outcome === 'win') hits += 1;
    else if (trial.outcome === 'push') pushes += 1;
    netUnits += trial.units;
  }
  return { hits, pushes, trials: trials.length, netUnits };
}

/** How many times each total 2..12 was rolled across every roll of every trial, indexed by total. */
export function countTotals(trials: readonly CrapsTrial[]): Map<number, number> {
  const counts = new Map<number, number>(DICE_TOTALS.map((total) => [total, 0]));
  for (const trial of trials) {
    for (const roll of trial.rolls) {
      const total = rollTotal(roll);
      counts.set(total, (counts.get(total) ?? 0) + 1);
    }
  }
  return counts;
}

export function isPointTotal(total: number): boolean {
  return isPoint(total);
}
