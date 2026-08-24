import { useGameStore } from '../state/gameStore';
import { STREET_LABEL } from '../engine/streets';

export function StreetControls() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);
  const advanceStreet = useGameStore((state) => state.advanceStreet);
  const rewindStreet = useGameStore((state) => state.rewindStreet);

  const noHand = runout === null;

  return (
    <div>
      <h2>Street</h2>
      <button type="button" data-testid="rewind-button" onClick={rewindStreet} disabled={noHand || street === 'preflop'}>
        Rewind
      </button>
      <span data-testid="street-label">{STREET_LABEL[street]}</span>
      <button type="button" data-testid="advance-button" onClick={advanceStreet} disabled={noHand || street === 'river'}>
        Advance
      </button>
    </div>
  );
}
