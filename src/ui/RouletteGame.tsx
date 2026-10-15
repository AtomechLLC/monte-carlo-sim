import { GameModeSwitcher } from './GameModeSwitcher';
import { RouletteControls, RouletteSessionControls } from './RouletteControls';
import { RouletteTable } from './RouletteTable';
import { RouletteOddsPanel } from './RouletteOddsPanel';
import { useProgressiveReveal } from './useProgressiveReveal';
import { useRouletteStore } from '../state/rouletteStore';

/** Locked idle copy — a reword goes through the plan, never silently in code. */
const ROULETTE_IDLE_HEADING = 'No spins yet';
const ROULETTE_IDLE_BODY =
  'Pick a color, a number, or both on the layout, then click Spin 100 to see how often your prediction comes in. Switch the wheel between single and double zero to see the odds shift.';

/**
 * The roulette game root (quick task 261015-ch8) — the third sibling under the shell's mode
 * fork, shaped like the two before it: a page-level idle block, the session bar (game-mode
 * switcher, then the wheel), and the table row (felt with the floating action cluster, odds
 * panel beside it).
 *
 * What it does NOT have, and why: no odds effect, no simulation service, no error banner and no
 * cache. A batch of 100 spins is computed synchronously inside the store, so there is no
 * streamed run to start, cancel, gate or cache (PLAN decision 2). The one effect here is the
 * progressive reveal — the batch landing spin by spin — which is what gives this game the
 * live-convergence feel the worker gives the other two (PLAN decision 3). Leaving the mode
 * unmounts this root and clears the pending reveal step; the store keeps its cursor, so coming
 * back resumes the walk rather than replaying it.
 */
export function RouletteGame() {
  const total = useRouletteStore((state) => state.spins.length);
  const revealed = useRouletteStore((state) => state.revealed);
  const revealNext = useRouletteStore((state) => state.revealNext);
  const revealAll = useRouletteStore((state) => state.revealAll);
  useProgressiveReveal(revealed, total, revealNext, revealAll);

  return (
    <>
      {total === 0 && (
        <div className="empty-hand-state" data-testid="roulette-empty-state">
          <h2>{ROULETTE_IDLE_HEADING}</h2>
          <p>{ROULETTE_IDLE_BODY}</p>
        </div>
      )}
      {/* Session bar, above the felt — the same split as the other two games: which game, and
          which wheel. Both persist across batches and neither acts on the table itself. */}
      <div className="control-bar control-bar--session">
        <GameModeSwitcher />
        <RouletteSessionControls />
      </div>
      <div className="table-row">
        {/* Spin / Reset float on the felt at its bottom-left, passed into the table's on-felt
            chrome slot so `.felt` is their positioning ancestor and DOM parent — exactly how
            the other two games mount their action clusters. */}
        <RouletteTable>
          <RouletteControls />
        </RouletteTable>
        <RouletteOddsPanel />
      </div>
    </>
  );
}
