import { WinTieLossDisplay } from './WinTieLossDisplay';
import { OddsTable } from './OddsTable';
import { useUiStore } from '../state/uiStore';

/**
 * Docks the odds displays OUTSIDE the felt (D-05) — a sibling of `TableScene`, never nested
 * inside it. `aria-busy` reflects the animation gate (D-11, UI-SPEC A9) so assistive tech knows
 * the region is mid-update rather than reporting stale/absent values as final.
 */
export function OddsPanel() {
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <div
      data-testid="odds-panel"
      aria-busy={pending}
      className={pending ? 'odds-panel--pending' : undefined}
    >
      <WinTieLossDisplay />
      <OddsTable />
    </div>
  );
}
