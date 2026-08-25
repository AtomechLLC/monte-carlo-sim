import { useGameStore } from '../state/gameStore';

export function DealButton() {
  const deal = useGameStore((state) => state.deal);
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);

  // Which button to press NEXT. Deal owns that role at the two moments when there is no hand
  // to move forward: before the first deal, and once the river has been reached and the hand
  // is over. In between, Advance owns it (see StreetControls) — the signal moves with the
  // state, and exactly one control carries it at a time.
  const isNextAction = runout === null || street === 'river';

  return (
    <button type="button" onClick={deal} data-next-action={isNextAction ? 'true' : undefined}>
      Deal
    </button>
  );
}
