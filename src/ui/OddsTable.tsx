import { useMemo } from 'react';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { useGameStore } from '../state/gameStore';
import { deriveConditionedState } from '../engine/conditioning';
import { CATEGORY_LABELS, CATEGORY_LABELS_TWO_DECK } from './categoryLabels';
import { FIVE_OF_A_KIND_INDEX } from '../worker/protocol';
import { formatPct } from './formatPct';
import { categoryShares, shareWidth } from './categoryShares';
import { lockedInCategory } from './lockedCategory';
import { HandCategoryIcon } from './HandCategoryIcon';

export function OddsTable() {
  const categoryCounts = useOddsStore((state) => state.categoryCounts);
  const trialsCompleted = useOddsStore((state) => state.trialsCompleted);
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

  // Bar geometry is derived from the SAME three inputs the percentage cells read, and is
  // bounded by `labels.length` rather than the snapshot length — so the eleventh row's count
  // can never influence the ten-row table's scale. See categoryShares.ts for why the bars are
  // relative to the max rather than to 100%.
  const shares = useMemo(
    () => categoryShares(categoryCounts, labels.length, trialsCompleted, pending),
    [categoryCounts, labels.length, trialsCompleted, pending],
  );

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
          {/* The illustration column has no visible heading — the example hand restates the
              category beside it, so a visible label would be noise. The name exists for
              assistive tech only. */}
          <th scope="col">
            <span className="visually-hidden">Example hand</span>
          </th>
          <th scope="col">Hand Category</th>
          {/* The bars themselves are decorative (see the row cell below), but the column they
              form is a real, visible part of the table and is titled like one. */}
          <th scope="col">Share</th>
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
            {/* The illustration is a <td> BEFORE the row header, never inside it: SVG <text>
                contributes to textContent, and a frozen v1 suite asserts the row <th>'s
                textContent is exactly the category label. Pinned by
                OddsTable.categoryIconCell.test.tsx (which carries a demonstrated negative
                control for this exact mistake). */}
            <td className="category-table__example">
              <HandCategoryIcon categoryIndex={index} />
            </td>
            <th scope="row">{label}</th>
            {/* The bar is DECORATIVE and says nothing the percentage cell to its right does
                not already say — `aria-hidden` on the track hides the whole widget, so a
                screen reader hears "One Pair, 30.0%" and never a second, wordless rendering
                of the same number. Width is an inline style because it is data, not theme;
                the TRANSITION on that width lives in App.css and is what makes a converging
                run visible. Nothing here tweens: React writes the final width for the
                current snapshot and the compositor does the settling. */}
            <td className="category-table__share">
              <div className="category-bar" aria-hidden="true">
                <div
                  className={
                    shares[index]?.leading
                      ? 'category-bar__fill category-bar__fill--leading'
                      : 'category-bar__fill'
                  }
                  data-testid={`category-bar-${index}`}
                  style={{ width: shareWidth(shares[index]?.share ?? 0) }}
                />
              </div>
            </td>
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
