import { useGameStore } from '../state/gameStore';
import { STREET_BOARD_COUNT } from '../engine/streets';

export function BoardDisplay() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);

  const visibleBoard = runout ? runout.board.slice(0, STREET_BOARD_COUNT[street]) : [];

  return (
    <div>
      <h2>Board</h2>
      {visibleBoard.length === 0 ? (
        <div data-testid="board-empty-state">No community cards yet</div>
      ) : (
        <div data-testid="board-cards">
          {visibleBoard.map((card) => (
            <span key={card}>{card}</span>
          ))}
        </div>
      )}
    </div>
  );
}
