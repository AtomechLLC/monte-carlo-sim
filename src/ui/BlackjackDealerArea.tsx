import { useBlackjackStore } from '../state/blackjackStore';

/**
 * The dealer's area, top-centre on the blackjack felt (D-13): upcard, hole (inside the
 * reveal button), playout draws, and the "Dealer" badge. Card rendering lands in the next
 * task of plan 06-05 — this shell carries the idle-state placeholders and the badge.
 */
export function BlackjackDealerArea() {
  const roundPhase = useBlackjackStore((state) => state.roundPhase);

  return (
    <div data-testid="blackjack-dealer-area" className="seat bj-dealer-area">
      <div data-testid="blackjack-dealer-cards" className="bj-hand-row">
        {roundPhase === 'idle' && (
          // Pre-deal: plain dashed placeholder spans (UI-SPEC A8 pattern) — never wrapped in
          // AnimatedCard, or the gate would arm on page load before any deal has happened.
          <>
            <span className="card-slot card-slot--opponent bj-card-placeholder" />
            <span className="card-slot card-slot--opponent bj-card-placeholder" />
          </>
        )}
      </div>
      <span data-testid="blackjack-dealer-label" className="seat-label">
        Dealer
      </span>
    </div>
  );
}
