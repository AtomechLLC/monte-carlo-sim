/**
 * U+2212 MINUS SIGN — the typographic minus of UI-SPEC A8's rendered form (`−0.18 units`),
 * NOT the ASCII hyphen-minus. Declared as a named constant so the character stays searchable.
 */
const MINUS_SIGN = '−';

/**
 * Signed per-unit EV in the locked A8 shape: `'+0.12 units'` / `'−0.18 units'` /
 * `'0.00 units'` — with the shared pending/zero-trials em dash convention of `formatPct`.
 *
 * EV per unit wagered = (win − lose) / trialsCompleted. Pushes contribute zero by
 * construction and never enter the arithmetic: 06-RESEARCH's "EV Computation Shape" proves
 * trial outcomes are always exactly {-1, 0, +1} — a natural's `+1.5` can never appear here
 * because naturals resolve at deal, before the Hit/Stand decision point ever exists (D-05).
 */
export function formatEv(
  outcomes: { win: number; push: number; lose: number },
  trialsCompleted: number,
  pending: boolean,
): string {
  // The SAME em dash literal `formatPct` returns — that file carries the convention's
  // comment ("reusing this literal rather than introducing a second dash constant").
  // `formatPct.ts` does not export the literal, so it is repeated verbatim here with this
  // pointer back to the source of the convention.
  if (pending || trialsCompleted === 0) return '—';

  const ev = (outcomes.win - outcomes.lose) / trialsCompleted;

  // Round FIRST (to hundredths), THEN choose the sign from the rounded value, so an EV that
  // rounds to zero from either side renders unsigned — a rendered `−0.00` or `+0.00` is a
  // bug. Sign and magnitude both derive from the same rounded integer, so they can never
  // disagree on a boundary value.
  const hundredths = Math.round(ev * 100);
  const magnitude = (Math.abs(hundredths) / 100).toFixed(2);
  if (hundredths > 0) return `+${magnitude} units`;
  if (hundredths < 0) return `${MINUS_SIGN}${magnitude} units`;
  return `${magnitude} units`;
}
