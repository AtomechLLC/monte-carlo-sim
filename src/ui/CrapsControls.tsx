import { TRIALS_PER_BATCH } from '../engine/craps';
import { useCrapsStore } from '../state/crapsStore';

/** Shown on the disabled Roll button: the one thing the user has to do first. */
const PICK_FIRST_TITLE = 'Pick a bet first';

/*
 * The craps controls (quick task 261015-d7o), two exports in one file — the same split by
 * WHAT THEY ACT ON every other game uses, each placed where it acts:
 *
 *   <CrapsSessionControls />  the Field house rule — ABOVE the felt, beside the switcher
 *   <CrapsControls />         Roll / Reset — FLOATING ON the felt, bottom-left
 *
 * Both read ONLY `useCrapsStore`: no other game's store, and no animation-gate state.
 */

/**
 * The Field's 12 — triple or double — is the house rule most tables actually vary, and the
 * one parameter here that moves a probability on the table (the Field's house edge: 2.78% vs
 * 5.56%). It sits with the session context like the wheel and the shoe do. Same segmented-
 * control markup and locked-label rule as the other three.
 */
export function CrapsSessionControls() {
  const fieldRule = useCrapsStore((state) => state.fieldRule);
  const setFieldRule = useCrapsStore((state) => state.setFieldRule);

  return (
    <div data-testid="craps-field-toggle" role="group" aria-label="Field 12 pays">
      <button
        type="button"
        data-testid="craps-field-toggle-triple12"
        aria-pressed={fieldRule === 'triple12'}
        onClick={() => setFieldRule('triple12')}
      >
        12 pays triple
      </button>
      <button
        type="button"
        data-testid="craps-field-toggle-double12"
        aria-pressed={fieldRule === 'double12'}
        onClick={() => setFieldRule('double12')}
      >
        12 pays double
      </button>
    </div>
  );
}

/**
 * The batch actions, floating on the felt at its bottom-left. Roll waits for a bet (there is
 * nothing to resolve without one) and carries the lilac next-action signal whenever it is
 * pressable; Reset waits for a history to clear. Neither is ever marked while disabled.
 */
export function CrapsControls() {
  const bet = useCrapsStore((state) => state.bet);
  const trialCount = useCrapsStore((state) => state.trials.length);
  const roll = useCrapsStore((state) => state.roll);
  const reset = useCrapsStore((state) => state.reset);

  const ready = bet !== null;

  return (
    <div className="felt-controls felt-controls--craps">
      <div className="control-group control-group--hand-actions">
        <button
          type="button"
          data-testid="craps-roll-button"
          disabled={!ready}
          title={ready ? undefined : PICK_FIRST_TITLE}
          onClick={roll}
          data-next-action={ready ? 'true' : undefined}
        >
          Roll {TRIALS_PER_BATCH}
        </button>
        <button type="button" data-testid="craps-reset-button" disabled={trialCount === 0} onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}
