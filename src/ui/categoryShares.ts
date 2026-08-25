/**
 * The Share column's geometry, as a pure function of the odds snapshot.
 *
 * WHY RELATIVE TO THE MAX, NOT TO 100%: a real Hold'em distribution runs from ~17% (High
 * Card) down to ~0.003% (Royal Flush). Bars drawn as a share of 100% would render one short
 * stub and nine invisible slivers — no shape at all. Scaling every bar against the LARGEST
 * category instead makes the profile of the distribution legible at a glance, while the
 * percentage cell beside each bar keeps carrying the absolute number. The bar is a shape
 * cue; the digits are the value.
 *
 * WHY THIS IS A SEPARATE MODULE: it is the piece with real edge cases (empty snapshot, a
 * snapshot longer than the visible row count, an all-zero histogram, the animation gate), and
 * a pure function is directly testable without rendering a table.
 */

export interface CategoryShare {
  /** 0..1, relative to the largest VISIBLE category. `0` whenever the digits show an em dash. */
  share: number;
  /** True for the category holding the max count — or for all of them, on an exact tie. */
  leading: boolean;
}

const EMPTY: CategoryShare = { share: 0, leading: false };

/**
 * @param counts        The store's `categoryCounts` — may be shorter OR longer than `rowCount`.
 * @param rowCount      How many rows the table is rendering, taken from the LABEL source.
 * @param trialsCompleted Denominator of the percentage column.
 * @param pending       `pendingAnimationCount > 0` — the TBL-04 animation gate.
 *
 * The `pending || trialsCompleted === 0` short-circuit is deliberately the SAME condition
 * `formatPct` uses to return its em dash, so the two columns can never disagree: whenever a
 * percentage reads `—`, its bar is empty. Odds visuals never move while cards are in flight,
 * and — critically — a bar never holds the PREVIOUS street's shape behind an em dash.
 *
 * `rowCount` (not `counts.length`) bounds the scan for the same reason `OddsTable` derives its
 * rows from the label source: a stale 11-entry snapshot sitting in the store while the table
 * has dropped back to ten rows must not be able to set the max from an invisible row.
 */
export function categoryShares(
  counts: readonly number[],
  rowCount: number,
  trialsCompleted: number,
  pending: boolean,
): CategoryShare[] {
  if (pending || trialsCompleted === 0) {
    return Array.from({ length: Math.max(0, rowCount) }, () => ({ ...EMPTY }));
  }

  // A missing index reads as 0 (same `?? 0` fallback the percentage cells use), and a negative
  // count — which only a malformed snapshot could produce — is floored rather than inverted
  // into a negative width.
  const visible = Array.from({ length: Math.max(0, rowCount) }, (_, index) =>
    Math.max(0, counts[index] ?? 0),
  );
  const max = visible.reduce((highest, count) => (count > highest ? count : highest), 0);
  if (max === 0) return visible.map(() => ({ ...EMPTY }));

  return visible.map((count) => ({ share: count / max, leading: count === max }));
}

/**
 * A share as an inline CSS width. Fixed at one decimal place — the same precision the
 * percentage column prints — so the value is exact and assertable in tests rather than a
 * float with a long tail.
 */
export function shareWidth(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}
