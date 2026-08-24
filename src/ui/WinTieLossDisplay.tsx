import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';

/** `pending` short-circuits to the SAME em dash already used for zero trials (UI-SPEC A9) —
 * reusing this literal rather than introducing a second dash constant elsewhere. */
function formatPct(count: number, trialsCompleted: number, pending: boolean): string {
  if (pending || trialsCompleted === 0) return '—';
  return `${((count / trialsCompleted) * 100).toFixed(1)}%`;
}

export function WinTieLossDisplay() {
  const { trialsCompleted, outcomes } = useOddsStore();
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <div>
      <span data-testid="trial-counter">{pending ? '—' : trialsCompleted.toLocaleString()}</span>
      <span data-testid="win-pct">{formatPct(outcomes.win, trialsCompleted, pending)}</span>
      <span data-testid="tie-pct">{formatPct(outcomes.tie, trialsCompleted, pending)}</span>
      <span data-testid="lose-pct">{formatPct(outcomes.lose, trialsCompleted, pending)}</span>
    </div>
  );
}
