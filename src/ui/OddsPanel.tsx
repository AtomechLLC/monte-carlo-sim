import { WinTieLossDisplay } from './WinTieLossDisplay';
import { OddsTable } from './OddsTable';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';

/**
 * Docks the odds displays OUTSIDE the felt (D-05) — a sibling of `TableScene`, never nested
 * inside it. `aria-busy` reflects the animation gate (D-11, UI-SPEC A9) so assistive tech knows
 * the region is mid-update rather than reporting stale/absent values as final.
 */
export function OddsPanel() {
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);
  const done = useOddsStore((state) => state.done);
  const trialsCompleted = useOddsStore((state) => state.trialsCompleted);

  // DERIVED, never stored: the run is settled when the worker reported its final snapshot,
  // the gate is clear, and there are actually trials behind the numbers. `done` is a field
  // oddsStore already owns (`applySnapshot` copies it straight off the snapshot, `reset`
  // clears it), so the settled affordance needs no schema change — and it cannot drift out of
  // sync with the numbers, because it is computed from the same store read that renders them.
  //
  // The `!pending` term matters: mid-animation every value is masked to an em dash, and a
  // "these numbers are final" cue under a row of dashes would be a lie. Settling is also
  // correctly TRANSIENT — advancing a street resets `done` to false, so the cue disappears
  // the moment a new run starts and returns only when that run finishes.
  const settled = done && !pending && trialsCompleted > 0;

  const classes = [
    pending ? 'odds-panel--pending' : null,
    settled ? 'odds-panel--settled' : null,
  ].filter((entry) => entry !== null);

  return (
    <div
      data-testid="odds-panel"
      aria-busy={pending}
      className={classes.length > 0 ? classes.join(' ') : undefined}
    >
      <WinTieLossDisplay />
      <OddsTable />
    </div>
  );
}
