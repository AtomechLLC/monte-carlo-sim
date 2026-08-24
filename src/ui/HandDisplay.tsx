import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';

export function HandDisplay() {
  const heroHole = useGameStore((state) => state.runout?.heroHole);

  return (
    <div>
      <div data-testid="hero-hole">
        {heroHole?.map((card) => <span key={card}>{card}</span>)}
      </div>
      <div data-testid="opponents">
        {Array.from({ length: OPPONENT_COUNT }, (_, i) => (
          <span key={i}>Hidden</span>
        ))}
      </div>
    </div>
  );
}
