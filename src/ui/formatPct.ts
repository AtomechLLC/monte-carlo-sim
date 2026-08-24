/** `pending` short-circuits to the SAME em dash already used for zero trials (UI-SPEC A9) —
 * reusing this literal rather than introducing a second dash constant elsewhere.
 *
 * Single shared implementation (IMP-13) — this was previously byte-identical duplicated in
 * both `WinTieLossDisplay.tsx` and `OddsTable.tsx`. */
export function formatPct(count: number, trialsCompleted: number, pending: boolean): string {
  if (pending || trialsCompleted === 0) return '—';
  return `${((count / trialsCompleted) * 100).toFixed(1)}%`;
}
