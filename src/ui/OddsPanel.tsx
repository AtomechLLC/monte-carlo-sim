import { WinTieLossDisplay } from './WinTieLossDisplay';
import { OddsTable } from './OddsTable';

/**
 * Docks the odds displays OUTSIDE the felt (D-05) — a sibling of `TableScene`, never nested
 * inside it. `WinTieLossDisplay`/`OddsTable` are unchanged; this is a pure wrapper.
 */
export function OddsPanel() {
  return (
    <div data-testid="odds-panel">
      <WinTieLossDisplay />
      <OddsTable />
    </div>
  );
}
