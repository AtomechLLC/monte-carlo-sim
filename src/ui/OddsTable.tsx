import { useOddsStore } from '../state/oddsStore';
import { CATEGORY_LABELS } from './categoryLabels';

function formatPct(count: number, trialsCompleted: number): string {
  if (trialsCompleted === 0) return '—';
  return `${((count / trialsCompleted) * 100).toFixed(1)}%`;
}

export function OddsTable() {
  const { categoryCounts, trialsCompleted } = useOddsStore();

  return (
    <table data-testid="category-table">
      <thead>
        <tr>
          <th>Hand Category</th>
          <th>Probability</th>
        </tr>
      </thead>
      <tbody>
        {/* Rows are always derived from CATEGORY_LABELS, never from categoryCounts.length,
            so a malformed or short snapshot cannot silently shrink the table. */}
        {CATEGORY_LABELS.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td data-testid={`category-pct-${index}`}>
              {formatPct(categoryCounts[index] ?? 0, trialsCompleted)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
