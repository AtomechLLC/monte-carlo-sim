import { rollTotal, type CrapsBet, type CrapsTrial } from '../engine/craps';

/**
 * The decision's roll sequence in words (quick task 261015-d7o): the come-out and every roll
 * after it for the line bets ("Point 6 · 9 · 4 · 6 — win"), every roll for a place bet, the one
 * roll for a single-roll bet — and how it ended. Its own module rather than an export of
 * CrapsDice.tsx so that file exports only components (react-refresh/only-export-components).
 */
export function describeTrial(trial: CrapsTrial, bet: CrapsBet): string {
  const totals = trial.rolls.map(rollTotal);
  const ending = trial.outcome === 'win' ? 'win' : trial.outcome === 'lose' ? 'loss' : 'push';
  if (trial.point !== null && (bet === 'pass' || bet === 'dontPass')) {
    const [comeOut, ...rest] = totals;
    return `Point ${comeOut} · ${rest.join(' · ')} — ${ending}`;
  }
  return `${totals.join(' · ')} — ${ending}`;
}
