import { SPINS_PER_BATCH } from '../engine/roulette';
import { hasPrediction, useRouletteStore } from '../state/rouletteStore';

/** Shown on the disabled Spin button: the one thing the user has to do first. */
const PICK_FIRST_TITLE = 'Pick a color or a number first';

/*
 * The roulette controls (quick task 261015-ch8), two exports in one file — the same split by
 * WHAT THEY ACT ON that the other two games use, each placed where it acts:
 *
 *   <RouletteSessionControls />  the wheel — ABOVE the felt, beside the game-mode switcher
 *   <RouletteControls />         Spin / Reset — FLOATING ON the felt, bottom-left
 *
 * Both read ONLY `useRouletteStore`: no other game's store, and no animation-gate state —
 * roulette never arms the gate, there are no cards to fly.
 */

/**
 * The wheel control, above the felt: the roulette mirror of the deck-count toggle. Single or
 * double zero is the ONE parameter that moves every probability on the table, so it sits with
 * the session context, not with the actions. Same segmented-control markup and the same
 * locked-label rule as the switcher: the labels never change, `aria-pressed` carries the state,
 * and clicking the active segment is a harmless no-op routed through the store's same-value
 * early return.
 */
export function RouletteSessionControls() {
  const wheel = useRouletteStore((state) => state.wheel);
  const setWheel = useRouletteStore((state) => state.setWheel);

  return (
    <div data-testid="roulette-wheel-toggle" role="group" aria-label="Wheel">
      <button
        type="button"
        data-testid="roulette-wheel-toggle-european"
        aria-pressed={wheel === 'european'}
        onClick={() => setWheel('european')}
      >
        Single zero
      </button>
      <button
        type="button"
        data-testid="roulette-wheel-toggle-american"
        aria-pressed={wheel === 'american'}
        onClick={() => setWheel('american')}
      >
        Double zero
      </button>
    </div>
  );
}

/**
 * The batch actions, floating on the felt at its bottom-left. Spin waits for a prediction —
 * there is nothing to score without one, and the idle copy says so — and carries the lilac
 * "press this next" signal whenever it is pressable, because once a prediction exists spinning
 * is always the next thing to do (there is no street to advance and no hand to play). Reset
 * waits for a history to clear. Neither is ever the next action while disabled: the attribute
 * is absent, not merely dimmed.
 */
export function RouletteControls() {
  const color = useRouletteStore((state) => state.color);
  const number = useRouletteStore((state) => state.number);
  const spinCount = useRouletteStore((state) => state.spins.length);
  const spin = useRouletteStore((state) => state.spin);
  const reset = useRouletteStore((state) => state.reset);

  const ready = hasPrediction({ color, number });

  return (
    <div className="felt-controls felt-controls--roulette">
      <div className="control-group control-group--hand-actions">
        <button
          type="button"
          data-testid="roulette-spin-button"
          disabled={!ready}
          title={ready ? undefined : PICK_FIRST_TITLE}
          onClick={spin}
          data-next-action={ready ? 'true' : undefined}
        >
          Spin {SPINS_PER_BATCH}
        </button>
        <button type="button" data-testid="roulette-reset-button" disabled={spinCount === 0} onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}
