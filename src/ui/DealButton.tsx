import { useGameStore } from '../state/gameStore';

export function DealButton() {
  const deal = useGameStore((state) => state.deal);

  return (
    <button type="button" onClick={deal}>
      Deal
    </button>
  );
}
