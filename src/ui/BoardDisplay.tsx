import { useGameStore } from '../state/gameStore';
import { STREET_BOARD_COUNT } from '../engine/streets';
import { BOARD_SIZE } from '../engine/cards';
import { PlayingCard } from './PlayingCard';

export function BoardDisplay() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);

  const visibleBoard = runout ? runout.board.slice(0, STREET_BOARD_COUNT[street]) : [];
  const placeholderCount = BOARD_SIZE - visibleBoard.length;

  return (
    <div className="community-area">
      <h2 className="visually-hidden">Board</h2>
      {visibleBoard.length === 0 ? (
        <div data-testid="board-empty-state">No community cards yet</div>
      ) : (
        <div data-testid="board-cards">
          {visibleBoard.map((card) => (
            <span key={card} className="card-slot card-slot--community">
              <PlayingCard card={card} />
            </span>
          ))}
        </div>
      )}
      {/* UI-SPEC A8: not-yet-revealed community positions render as dashed placeholders,
          siblings of board-cards/board-empty-state — never children of board-cards, since
          existing acceptance tests assert board-cards' child count equals the visible count. */}
      {Array.from({ length: placeholderCount }, (_, i) => (
        <div key={i} className="card-slot card-slot--community card-placeholder" aria-hidden="true" />
      ))}
    </div>
  );
}
