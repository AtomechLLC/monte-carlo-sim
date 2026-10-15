/**
 * Scoring for every "pick an outcome, run trials, see how often it came in" game — roulette
 * first (quick task 261015-ch8), craps next. Game-agnostic by construction: it knows nothing
 * about wheels or dice, only about a hit count, a trial count, a closed-form probability and a
 * payout, so each game supplies its own four inputs and renders the same five readouts.
 */
export interface PredictionScore {
  trials: number;
  hits: number;
  /** The closed-form probability of a hit on one trial. */
  probability: number;
  /** Units won per unit staked on a hit (35 for a straight-up roulette number). */
  payout: number;
  /** `hits / trials`, or 0 before the first trial — never NaN. */
  observed: number;
  /** `probability × trials`: what the maths expected the hit count to be. */
  expectedHits: number;
  /** Net result at one unit per trial: hits pay `payout`, every miss loses the unit. */
  netUnits: number;
}

export function scorePrediction(
  hits: number,
  trials: number,
  probability: number,
  payout: number,
): PredictionScore {
  return {
    trials,
    hits,
    probability,
    payout,
    observed: trials === 0 ? 0 : hits / trials,
    expectedHits: probability * trials,
    netUnits: hits * payout - (trials - hits),
  };
}

/** `+4` / `−3` / `0` — a signed integer with a real minus sign, for the net-units readout. */
export function formatSignedUnits(units: number): string {
  if (units > 0) return `+${units}`;
  if (units < 0) return `−${Math.abs(units)}`;
  return '0';
}
