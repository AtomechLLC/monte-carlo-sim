import { HandDisplay } from './HandDisplay';
import { BoardDisplay } from './BoardDisplay';
import { CardBack } from './CardBack';

/**
 * The felt oval composition root (TBL-01). A pure layout shell: it mounts the seat/board data
 * sources and adds the deck-origin decoration, but reads no store state itself — `HandDisplay`/
 * `BoardDisplay` remain the single source of truth for street-driven visibility (03-PATTERNS:
 * that per-street card-count logic must not be duplicated here).
 */
export function TableScene() {
  return (
    <div data-testid="table-scene" className="felt">
      <HandDisplay />
      <BoardDisplay />
      <div data-testid="deck-origin" className="deck-origin" aria-hidden="true">
        <CardBack />
        <CardBack />
        <CardBack />
      </div>
    </div>
  );
}
