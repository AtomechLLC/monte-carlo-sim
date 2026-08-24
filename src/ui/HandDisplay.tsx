import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';
import { isOpponentRevealed } from '../engine/conditioning';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';

const HERO_HOLE_SLOTS = [0, 1] as const;

export function HandDisplay() {
  const heroHole = useGameStore((state) => state.runout?.heroHole);
  // Display read of already-revealed information (which cards to SHOW once a seat is revealed),
  // not a simulation-conditioning read — this does not violate the D-02 rule that confines
  // *conditioning* reads to deriveConditionedState, which is the only function permitted to
  // read runout.board/opponentHoles for feeding the worker. Reading opponentHoles here is
  // purely for rendering a seat the user has already clicked to reveal.
  const opponentHoles = useGameStore((state) => state.runout?.opponentHoles);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const reveal = useGameStore((state) => state.reveal);

  return (
    <div>
      <div data-testid="hero-hole">
        {HERO_HOLE_SLOTS.map((slot) => {
          const card = heroHole?.[slot];
          return (
            <span key={slot} className="card-slot card-slot--hero">
              {card && <PlayingCard card={card} />}
            </span>
          );
        })}
      </div>
      <div data-testid="opponents">
        {Array.from({ length: OPPONENT_COUNT }, (_, i) => {
          const revealed = opponentHoles !== undefined && isOpponentRevealed(revealedMask, i);
          const hole = opponentHoles?.[i];

          if (revealed && hole) {
            return (
              <button
                key={i}
                type="button"
                data-testid={`opponent-seat-${i}`}
                disabled
                aria-label={`Opponent ${i + 1} hole cards: ${hole[0]} ${hole[1]} (revealed)`}
              >
                <span className="card-slot card-slot--opponent">
                  <PlayingCard card={hole[0]} decorative />
                </span>
                <span className="card-slot card-slot--opponent">
                  <PlayingCard card={hole[1]} decorative />
                </span>
              </button>
            );
          }

          return (
            <button
              key={i}
              type="button"
              data-testid={`opponent-seat-${i}`}
              disabled={opponentHoles === undefined}
              onClick={() => reveal(i)}
              aria-label={`Reveal Opponent ${i + 1} hole cards`}
              title="Click to reveal this opponent's hole cards"
            >
              <span className="card-slot card-slot--opponent">
                <CardBack />
              </span>
              <span className="card-slot card-slot--opponent">
                <CardBack />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
