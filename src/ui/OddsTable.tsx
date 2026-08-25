import { useMemo } from 'react';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { useGameStore } from '../state/gameStore';
import { deriveConditionedState } from '../engine/conditioning';
import { CATEGORY_LABELS, CATEGORY_LABELS_TWO_DECK } from './categoryLabels';
import { FIVE_OF_A_KIND_INDEX } from '../worker/protocol';
import { formatPct } from './formatPct';
import { lockedInCategory } from './lockedCategory';

export function OddsTable() {
  const { categoryCounts, trialsCompleted } = useOddsStore();
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const deckCount = useGameStore((state) => state.deckCount);
  const lockedIndex = useMemo(() => {
    if (pending || runout === null) return null;
    // (1) Cards come from `deriveConditionedState` — the ONLY sanctioned reader of the
    // runout (D-02) — never from a raw board slice taken directly off the runout here, so a
    // hidden turn/river card can never influence the mark.
    const { heroHole, knownBoard } = deriveConditionedState(runout, street, revealedMask, deckCount);
    // (2) The `pending` short-circuit above means no checkmark appears while cards are still
    // mid-flight, matching UI-SPEC A9's "no value while cards are in flight" rule that the
    // percentage cells already follow.
    // (3) At two decks the visible cards can contain a duplicate — a hero pocket pair of
    // identical copies, or a board card duplicating a hero card — so the evaluation must go
    // through the deck-count-aware helper: this is a MAIN-THREAD call site, and the raw
    // stock evaluator returns malformed results on duplicate input (07-RESEARCH Pitfall 3).
    return lockedInCategory(heroHole, knownBoard, deckCount);
  }, [pending, runout, street, revealedMask, deckCount]);

  // The row source is selected ONCE by deck count (D-05, D-09 as amended): the derived
  // 11-entry constant only where `deckCount === 2` flows, the shipped ten everywhere else —
  // so the 1-deck table renders zero trace of the extended row.
  const labels = deckCount === 2 ? CATEGORY_LABELS_TWO_DECK : CATEGORY_LABELS;

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
        {/* Rows are always derived from the LABEL SOURCE, never from categoryCounts.length,
            so a malformed or short snapshot cannot silently shrink the table. The row-level
            testid is applied conditionally by index (UI-SPEC A8): only the 2-deck-only
            index-10 row carries one — React omits an undefined attribute, so every shipped
            row's <tr> markup stays byte-identical. */}
        {labels.map((label, index) => (
          <tr key={label} data-testid={index === FIVE_OF_A_KIND_INDEX ? 'category-five-of-a-kind' : undefined}>
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
