import { BustEvDisplay } from './BustEvDisplay';
import { DealerDistributionDisplay } from './DealerDistributionDisplay';
import { useUiStore } from '../state/uiStore';

/**
 * Docks the Blackjack odds cluster OUTSIDE the felt (D-13, Phase 3 precedent) — a sibling
 * of the Blackjack table scene, never nested inside it. `aria-busy` reflects the animation
 * gate (UI-SPEC A9/TBL-04) so assistive tech knows the region is mid-update rather than
 * reporting stale/absent values as final — identical shape and timing to Hold'em's
 * `OddsPanel`. Reads ONLY blackjack stores plus the shared animation gate (D-10): no
 * Hold'em store, no shared odds cache key.
 */
export function BlackjackOddsPanel() {
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <div
      data-testid="blackjack-odds-panel"
      aria-busy={pending}
      className={pending ? 'odds-panel--pending' : undefined}
    >
      <BustEvDisplay />
      <DealerDistributionDisplay />
    </div>
  );
}
