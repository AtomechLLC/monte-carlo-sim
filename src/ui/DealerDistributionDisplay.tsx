import { useBlackjackOddsStore } from '../state/blackjackOddsStore';
import { useUiStore } from '../state/uiStore';
import { DEALER_BUCKET_LABELS, DEALER_BUCKET_TESTIDS } from './dealerBucketLabels';
import { formatPct } from './formatPct';

/**
 * The 7-bucket dealer final-outcome distribution (BJ-03, D-06) — the phase's educational
 * centrepiece: the display that visibly reshapes when the upcard changes or the hole is
 * revealed. Plain table mirroring `category-table`'s shipped structure (UI-SPEC A13) — no
 * bars, sparklines or highlight markers this phase (deferred to the visual-excellence pass).
 */
export function DealerDistributionDisplay() {
  // Per-field selectors (06-REVIEW IN-01): the codebase-wide store discipline — a
  // selector-less subscription re-renders on EVERY store write, including settledCache
  // copy-on-write Map replacements and clearCache() calls that change nothing shown here.
  const dealerOutcomeCounts = useBlackjackOddsStore((state) => state.dealerOutcomeCounts);
  const trialsCompleted = useBlackjackOddsStore((state) => state.trialsCompleted);
  const displayedDeckCount = useBlackjackOddsStore((state) => state.displayedDeckCount);
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  // A3 snapshot rule (checker FLAG 1): the subtitle names the shoe the DISPLAYED run was
  // computed under — `displayedDeckCount` from the ODDS store, never the round store's
  // `deckCount`. A deck toggle during an idle or resolved round only sets the selection for
  // the next Deal; it starts no run, so the retained numbers must keep naming the shoe they
  // were actually computed under. Only the deck-count digit is interpolated into the locked
  // subtitle string (U+00B7 middle dot, verbatim from the Copywriting Contract).
  const subtitle = `Given the cards you can see · ${displayedDeckCount}-deck shoe`;

  return (
    <table data-testid="blackjack-dealer-table">
      <caption className="bj-odds-group__caption">
        Dealer's final hand
        <span className="bj-odds-group__subtitle">{subtitle}</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Dealer total</th>
          <th scope="col">Probability</th>
        </tr>
      </thead>
      <tbody>
        {/* Rows are always derived from DEALER_BUCKET_LABELS, never from
            dealerOutcomeCounts.length, so a malformed or short snapshot cannot silently
            shrink the table (T-06-30 — copied from OddsTable's shipped defence). */}
        {DEALER_BUCKET_LABELS.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td data-testid={`blackjack-dealer-pct-${DEALER_BUCKET_TESTIDS[index]}`}>
              {formatPct(dealerOutcomeCounts[index] ?? 0, trialsCompleted, pending)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
