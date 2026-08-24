import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { formatPct } from './formatPct';

export function WinTieLossDisplay() {
  const { trialsCompleted, outcomes } = useOddsStore();
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <dl className="odds-stats">
      <div className="odds-stat">
        <dt className="odds-stat__label">Trials</dt>
        <dd className="odds-stat__value" data-testid="trial-counter">
          {pending ? '—' : trialsCompleted.toLocaleString()}
        </dd>
      </div>
      <div className="odds-stat">
        <dt className="odds-stat__label">Win</dt>
        <dd className="odds-stat__value" data-testid="win-pct">
          {formatPct(outcomes.win, trialsCompleted, pending)}
        </dd>
      </div>
      <div className="odds-stat">
        <dt className="odds-stat__label">Tie</dt>
        <dd className="odds-stat__value" data-testid="tie-pct">
          {formatPct(outcomes.tie, trialsCompleted, pending)}
        </dd>
      </div>
      <div className="odds-stat">
        <dt className="odds-stat__label">Loss</dt>
        <dd className="odds-stat__value" data-testid="lose-pct">
          {formatPct(outcomes.lose, trialsCompleted, pending)}
        </dd>
      </div>
    </dl>
  );
}
