import { useMemo } from 'react';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { useGameStore } from '../state/gameStore';
import { deriveConditionedState } from '../engine/conditioning';
import { CATEGORY_LABELS } from './categoryLabels';
import { formatPct } from './formatPct';
import { lockedInCategory } from './lockedCategory';

export function OddsTable() {
  const { categoryCounts, trialsCompleted } = useOddsStore();
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const lockedIndex = useMemo(() => {
    if (pending || runout === null) return null;
    // (1) Cards come from `deriveConditionedState` — the ONLY sanctioned reader of the
    // runout (D-02) — never from a raw board slice taken directly off the runout here, so a
    // hidden turn/river card can never influence the mark.
    const { heroHole, knownBoard } = deriveConditionedState(runout, street, revealedMask);
    // (2) The `pending` short-circuit above means no checkmark appears while cards are still
    // mid-flight, matching UI-SPEC A9's "no value while cards are in flight" rule that the
    // percentage cells already follow.
    return lockedInCategory(heroHole, knownBoard);
  }, [pending, runout, street, revealedMask]);

  return (
    <table data-testid="category-table">
      <caption className="category-table__caption">
        Final hand by the river
        <span className="category-table__subtitle">
          Each row is the hand you end up with — the rows are exclusive and add up to 100%.
        </span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Hand Category</th>
          <th scope="col">Probability</th>
          <th scope="col">Locked In</th>
        </tr>
      </thead>
      <tbody>
        {/* Rows are always derived from CATEGORY_LABELS, never from categoryCounts.length,
            so a malformed or short snapshot cannot silently shrink the table. */}
        {CATEGORY_LABELS.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td data-testid={`category-pct-${index}`}>
              {formatPct(categoryCounts[index] ?? 0, trialsCompleted, pending)}
            </td>
            <td data-testid={`category-locked-${index}`}>
              {lockedIndex === index ? (
                <>
                  <span aria-hidden="true">✓</span>
                  <span className="visually-hidden">You already have this</span>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
