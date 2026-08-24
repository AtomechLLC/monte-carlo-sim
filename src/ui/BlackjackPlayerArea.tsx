import { useBlackjackStore } from '../state/blackjackStore';

/**
 * The player's area, bottom-centre on the blackjack felt (D-13): the growing hand row and
 * the "You" badge. Card rendering lands in the next task of plan 06-05 — this shell carries
 * the idle-state placeholders and the badge.
 */
export function BlackjackPlayerArea() {
  const roundPhase = useBlackjackStore((state) => state.roundPhase);

  return (
    <div data-testid="blackjack-player-area" className="seat bj-player-area">
      <div data-testid="blackjack-player-cards" className="bj-hand-row">
        {roundPhase === 'idle' && (
          // Pre-deal: plain dashed placeholder spans (UI-SPEC A8 pattern) — never wrapped in
          // AnimatedCard, or the gate would arm on page load before any deal has happened.
          <>
            <span className="card-slot card-slot--hero bj-card-placeholder" />
            <span className="card-slot card-slot--hero bj-card-placeholder" />
          </>
        )}
      </div>
      <span data-testid="blackjack-player-label" className="seat-label">
        You
      </span>
    </div>
  );
}
