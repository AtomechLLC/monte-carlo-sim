import { PlayingCard } from './PlayingCard';
import { AnimatedCard } from './AnimatedCard';
import { dealOriginOffset } from './tableGeometry';
import { useBlackjackStore } from '../state/blackjackStore';
import { handTotal } from '../engine/blackjackHandValue';

// Explicit numeric deal indices, NOT tableGeometry's dealIndex() helper (its seat-rotation
// domain does not describe blackjack). Casino deal order: player-0 = 0, dealer upcard = 1,
// player-1 = 2, dealer hole = 3 — so the player's two initial slots take 0 and 2. A hit
// card uses playerHand.length - 1, which at its mount equals its own slot index (slot >= 2
// only ever mounts as the newest card), so slot doubles as the index. AnimatedCard computes
// `delay = 0.08 * dealIndex`; these values keep Hold'em's shared timing constants untouched.
function playerDealIndex(slot: number): number {
  return slot === 0 ? 0 : slot === 1 ? 2 : slot;
}

/**
 * The player's area, bottom-centre on the blackjack felt (D-13): the growing hand row
 * (initial two cards, then each hit appended rightward) and the "You" badge with the A11
 * live total. Player cards sit in an unlabeled row, so each `PlayingCard` carries the
 * human-readable `{Rank} of {Suit}` alt (Accessibility Contract card-alt split).
 */
export function BlackjackPlayerArea() {
  const playerHand = useBlackjackStore((state) => state.playerHand);
  const roundNonce = useBlackjackStore((state) => state.roundNonce);

  // Deck-origin geometry reused, not re-derived: the player row sits at the same
  // bottom-centre anchor as Hold'em's hero seat, so its deal fly-in origin is that offset.
  const origin = dealOriginOffset('seat-hero');

  const total = playerHand.length > 0 ? handTotal(playerHand) : null;

  return (
    <div data-testid="blackjack-player-area" className="seat bj-player-area">
      <div data-testid="blackjack-player-cards" className="bj-hand-row">
        {playerHand.length === 0 ? (
          // Pre-deal: plain dashed placeholder spans (UI-SPEC A8 pattern) — never wrapped in
          // AnimatedCard, or the gate would arm on page load before any deal has happened.
          <>
            <span className="card-slot card-slot--hero bj-card-placeholder" />
            <span className="card-slot card-slot--hero bj-card-placeholder" />
          </>
        ) : (
          playerHand.map((card, slot) => (
            // Keyed by role + slot + roundNonce (never card identity, 03-RESEARCH
            // Anti-Patterns): a re-deal fully unmounts/remounts every card rather than
            // Motion retargeting an in-flight card into a different card.
            <AnimatedCard
              key={`player-${slot}-${roundNonce}`}
              animationKey={`player-${slot}-${roundNonce}`}
              origin={origin}
              dealIndex={playerDealIndex(slot)}
              className="card-slot card-slot--hero"
            >
              <PlayingCard card={card} />
            </AnimatedCard>
          ))
        )}
      </div>
      {/* NOT aria-hidden — a deliberate divergence from Seat.tsx's opponent badge: the
          "You" context and the live A11 total are information not duplicated elsewhere. */}
      <span data-testid="blackjack-player-label" className="seat-label">
        You
        {total !== null && (
          <>
            {' · '}
            <span data-testid="blackjack-player-total">
              {total.soft ? `Soft ${total.total}` : String(total.total)}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
