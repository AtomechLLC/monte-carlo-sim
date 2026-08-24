import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';
import { isOpponentRevealed } from '../engine/conditioning';

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
        {heroHole?.map((card) => <span key={card}>{card}</span>)}
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
                {hole[0]} {hole[1]}
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
              Hidden
            </button>
          );
        })}
      </div>
    </div>
  );
}
