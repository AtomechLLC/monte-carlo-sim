import { useOddsStore } from '../state/oddsStore';

function formatPct(count: number, trialsCompleted: number): string {
  if (trialsCompleted === 0) return '—';
  return `${((count / trialsCompleted) * 100).toFixed(1)}%`;
}

export function WinTieLossDisplay() {
  const { trialsCompleted, outcomes } = useOddsStore();

  return (
    <div>
      <span data-testid="trial-counter">{trialsCompleted.toLocaleString()}</span>
      <span data-testid="win-pct">{formatPct(outcomes.win, trialsCompleted)}</span>
      <span data-testid="tie-pct">{formatPct(outcomes.tie, trialsCompleted)}</span>
      <span data-testid="lose-pct">{formatPct(outcomes.lose, trialsCompleted)}</span>
    </div>
  );
}
