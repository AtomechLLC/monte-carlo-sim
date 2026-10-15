/**
 * Scoring for every "pick an outcome, run trials, see how often it came in" game — roulette
 * (quick task 261015-ch8) and craps (261015-d7o). Game-agnostic by construction: it knows
 * nothing about wheels or dice, only about a hit count, a trial count, a closed-form probability
 * and a payout, so each game supplies its own inputs and renders the same five readouts.
 */
export interface PredictionScore {
  trials: number;
  hits: number;
  /** Trials that neither won nor lost (craps' Don't pass on a come-out 12). 0 for every other bet. */
  pushes: number;
  /** The closed-form probability of a hit on one trial. */
  probability: number;
  /** Units won per unit staked on a hit (35 for a straight-up roulette number). */
  payout: number;
  /** `hits / trials`, or 0 before the first trial — never NaN. */
  observed: number;
  /** `probability × trials`: what the maths expected the hit count to be. */
  expectedHits: number;
  /** Net result at one unit per trial: hits pay `payout`, every loss costs the unit. */
  netUnits: number;
}

/** Fixed payout, no pushes — a hit pays `payout`, every other trial loses one unit. */
export function scorePrediction(
  hits: number,
  trials: number,
  probability: number,
  payout: number,
): PredictionScore {
  return {
    trials,
    hits,
    pushes: 0,
    probability,
    payout,
    observed: trials === 0 ? 0 : hits / trials,
    expectedHits: probability * trials,
    netUnits: hits * payout - (trials - hits),
  };
}

/** Outcomes the game has already settled trial by trial — for bets whose payout varies by
 * outcome (the craps Field) or that can push, where `hits × payout` would be the wrong net. */
export interface TalliedOutcomes {
  hits: number;
  pushes: number;
  trials: number;
  netUnits: number;
}

/** The same readouts from a tally the game settled itself; `payout` is the headline figure. */
export function scoreTallied(tally: TalliedOutcomes, probability: number, payout: number): PredictionScore {
  return {
    trials: tally.trials,
    hits: tally.hits,
    pushes: tally.pushes,
    probability,
    payout,
    observed: tally.trials === 0 ? 0 : tally.hits / tally.trials,
    expectedHits: probability * tally.trials,
    netUnits: tally.netUnits,
  };
}

/**
 * `+4` / `−3` / `0` — a signed number with a real minus sign, for the net-units readout. Whole
 * units print whole; a fractional net (the 7:6 place payout) prints to one decimal, and anything
 * that rounds to zero prints as the bare `0`.
 */
export function formatSignedUnits(units: number): string {
  const rounded = Math.round(units * 10) / 10;
  if (rounded === 0) return '0';
  const magnitude = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  return rounded > 0 ? `+${magnitude}` : `−${magnitude}`;
}
