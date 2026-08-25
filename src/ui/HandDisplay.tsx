import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';
import { isOpponentRevealed } from '../engine/conditioning';
import { Seat } from './Seat';
import { useCopyCuedSlots } from './copyCue';

export function HandDisplay() {
  const heroHole = useGameStore((state) => state.runout?.heroHole);
  // Display read of already-revealed information (which cards to SHOW once a seat is revealed),
  // not a simulation-conditioning read — this does not violate the D-02 rule that confines
  // *conditioning* reads to deriveConditionedState, which is the only function permitted to
  // read runout.board/opponentHoles for feeding the worker. Reading opponentHoles here is
  // purely for rendering a seat the user has already clicked to reveal.
  const opponentHoles = useGameStore((state) => state.runout?.opponentHoles);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const dealNonce = useGameStore((state) => state.dealNonce);
  const reveal = useGameStore((state) => state.reveal);
  // ONE memoised D-08 derivation for every seat this component renders (BoardDisplay
  // holds the other consumer) — Seat itself stays props-driven and store-free.
  const cuedSlots = useCopyCuedSlots();

  return (
    <>
      <Seat variant="hero" heroHole={heroHole} dealNonce={dealNonce} cuedSlots={cuedSlots} />
      <div data-testid="opponents">
        {Array.from({ length: OPPONENT_COUNT }, (_, i) => {
          const revealed = opponentHoles !== undefined && isOpponentRevealed(revealedMask, i);
          const hole = opponentHoles?.[i];

          return (
            <Seat
              key={i}
              variant="opponent"
              index={i}
              hole={hole}
              revealed={revealed}
              hasHand={opponentHoles !== undefined}
              dealNonce={dealNonce}
              onReveal={reveal}
              cuedSlots={cuedSlots}
            />
          );
        })}
      </div>
    </>
  );
}
