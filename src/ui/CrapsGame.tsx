import { GameModeSwitcher } from './GameModeSwitcher';
import { CrapsControls, CrapsSessionControls } from './CrapsControls';
import { CrapsTable } from './CrapsTable';
import { CrapsOddsPanel } from './CrapsOddsPanel';
import { useProgressiveReveal } from './useProgressiveReveal';
import { useCrapsStore } from '../state/crapsStore';

/** Locked idle copy — a reword goes through the plan, never silently in code. */
const CRAPS_IDLE_HEADING = 'No rolls yet';
const CRAPS_IDLE_BODY =
  "Pick a bet on the layout, then click Roll 100 to see how often it wins. Switch the Field's 12 between triple and double to see the house edge shift.";

/**
 * The craps game root (quick task 261015-d7o) — the fourth sibling under the shell's mode fork,
 * shaped exactly like the roulette root: a page-level idle block, the session bar (game-mode
 * switcher, then the Field house rule), and the table row (felt with the floating action cluster,
 * odds panel beside it). No odds effect, no simulation service, no cache: a batch of 100
 * decisions is resolved synchronously in the store, and the one effect here is the shared
 * progressive reveal that lands it decision by decision.
 */
export function CrapsGame() {
  const total = useCrapsStore((state) => state.trials.length);
  const revealed = useCrapsStore((state) => state.revealed);
  const revealNext = useCrapsStore((state) => state.revealNext);
  const revealAll = useCrapsStore((state) => state.revealAll);
  useProgressiveReveal(revealed, total, revealNext, revealAll);

  return (
    <>
      {total === 0 && (
        <div className="empty-hand-state" data-testid="craps-empty-state">
          <h2>{CRAPS_IDLE_HEADING}</h2>
          <p>{CRAPS_IDLE_BODY}</p>
        </div>
      )}
      <div className="control-bar control-bar--session">
        <GameModeSwitcher />
        <CrapsSessionControls />
      </div>
      <div className="table-row">
        <CrapsTable>
          <CrapsControls />
        </CrapsTable>
        <CrapsOddsPanel />
      </div>
    </>
  );
}
