import { PlayingCard, cardAltText } from './PlayingCard';
import { AnimatedCard } from './AnimatedCard';
import { FlipCard } from './FlipCard';
import { dealOriginOffset } from './tableGeometry';
import { useBlackjackStore } from '../state/blackjackStore';
import { handTotal } from '../engine/blackjackHandValue';

// Explicit numeric deal indices, NOT tableGeometry's dealIndex() helper (its seat-rotation
// domain does not describe blackjack). Casino deal order: player-0 = 0, dealer upcard = 1,
// player-1 = 2, dealer hole = 3. Playout draw i uses 5 + i * 2.5: AnimatedCard computes
// `delay = 0.08 * dealIndex`, so 5 is the 400ms hole-flip offset and 2.5 is the 200ms
// inter-draw gap A12 specifies — expressed this way so Hold'em's shared timing constants
// are not touched.
const DEALER_UPCARD_DEAL_INDEX = 1;
const DEALER_HOLE_DEAL_INDEX = 3;
const PLAYOUT_BASE_DEAL_INDEX = 5;
const PLAYOUT_DRAW_STRIDE = 2.5;

/**
 * The dealer's area, top-centre on the blackjack felt (D-13): upcard face-up, the hole
 * inside the `blackjack-hole-reveal` button, playout draws appended face-up left-to-right,
 * and the "Dealer" badge with the A11 total. Card alt-text split (Accessibility Contract):
 * the upcard and playout draws sit in an unlabeled row, so their `PlayingCard`s carry the
 * human-readable alt; the hole FlipCard's faces are `alt=""` because the reveal button
 * carries the authoritative label.
 */
export function BlackjackDealerArea() {
  const round = useBlackjackStore((state) => state.round);
  const dealerPlayoutCards = useBlackjackStore((state) => state.dealerPlayoutCards);
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const revealedHole = useBlackjackStore((state) => state.revealedHole);
  const roundNonce = useBlackjackStore((state) => state.roundNonce);
  const revealHole = useBlackjackStore((state) => state.revealHole);

  // Deck-origin geometry reused, not re-derived: the dealer row sits at the same top-centre
  // anchor as Hold'em's seat-opponent-1, so its deal fly-in origin is that seat's offset.
  const origin = dealOriginOffset('seat-opponent-1');

  const dealerTotal =
    round !== null && revealedHole
      ? handTotal([round.dealerUpcard, round.dealerHole, ...dealerPlayoutCards])
      : null;

  return (
    <div data-testid="blackjack-dealer-area" className="seat bj-dealer-area">
      <div data-testid="blackjack-dealer-cards" className="bj-hand-row">
        {round === null ? (
          // Pre-deal: a plain dashed placeholder span (UI-SPEC A8 pattern) — never wrapped
          // in AnimatedCard, or the gate would arm on page load before any deal has happened.
          <span className="card-slot card-slot--opponent bj-card-placeholder" />
        ) : (
          // Keyed by role + slot + roundNonce (never card identity, 03-RESEARCH
          // Anti-Patterns): a re-deal fully unmounts/remounts this element rather than
          // Motion retargeting an in-flight card into a different card.
          <AnimatedCard
            key={`dealer-up-${roundNonce}`}
            animationKey={`dealer-up-${roundNonce}`}
            origin={origin}
            dealIndex={DEALER_UPCARD_DEAL_INDEX}
            className="card-slot card-slot--opponent"
          >
            <PlayingCard card={round.dealerUpcard} />
          </AnimatedCard>
        )}
        <button
          type="button"
          data-testid="blackjack-hole-reveal"
          // One-way per round (D-14, BJ-06): enabled only mid-player-turn while still
          // hidden; disabled while idle, while resolved, and after a reveal. A new deal()
          // resets it hidden/enabled.
          disabled={roundPhase !== 'player-turn' || revealedHole}
          onClick={revealHole}
          aria-label={
            round !== null && revealedHole
              ? `Dealer's hole card: ${cardAltText(round.dealerHole)}`
              : "Reveal the dealer's hole card"
          }
        >
          {round === null ? (
            <span className="card-slot card-slot--opponent bj-card-placeholder" />
          ) : (
            <AnimatedCard
              key={`dealer-hole-${roundNonce}`}
              animationKey={`dealer-hole-${roundNonce}`}
              origin={origin}
              dealIndex={DEALER_HOLE_DEAL_INDEX}
              className="card-slot card-slot--opponent"
            >
              {/* The hole-card DOM leak guard (T-06-24, D-02's UI face): `card` is
                  `undefined` whenever the hole is hidden — NEVER the real card — which is
                  what keeps the predetermined hole out of the DOM entirely, not merely
                  visually hidden.

                  Natural-resolved deals (D-03a) are DELIBERATE, not an oversight: deal()
                  sets `revealedHole` true in the same tick for a natural, so this FlipCard
                  MOUNTS already face-up and FlipCard's own `mountedFaceUp` capture
                  suppresses the flip entirely — the card arrives face-up in one motion
                  (no land-then-flip two-step) and arms NO flip unit, keeping the gate
                  balanced against deal()'s single unconditional arm. Do not "fix" this
                  into a two-step reveal: that would both double-count the gate and
                  contradict D-03a's instant-resolution reading. */}
              <FlipCard
                flipKey={`dealer-hole-${roundNonce}`}
                faceUp={revealedHole}
                card={revealedHole ? round.dealerHole : undefined}
              />
            </AnimatedCard>
          )}
        </button>
        {round !== null &&
          dealerPlayoutCards.map((card, i) => (
            <AnimatedCard
              key={`dealer-playout-${i}-${roundNonce}`}
              animationKey={`dealer-playout-${i}-${roundNonce}`}
              origin={origin}
              dealIndex={PLAYOUT_BASE_DEAL_INDEX + i * PLAYOUT_DRAW_STRIDE}
              className="card-slot card-slot--opponent"
            >
              <PlayingCard card={card} />
            </AnimatedCard>
          ))}
      </div>
      {/* NOT aria-hidden — a deliberate divergence from Seat.tsx's opponent badge: the
          "Dealer" context and the live A11 total are information not duplicated elsewhere
          (the reveal button's label covers only the hole card). The total is ABSENT while
          the hole is hidden: a partial upcard-only total would misread as the dealer's
          full total (A11). */}
      <span data-testid="blackjack-dealer-label" className="seat-label">
        Dealer
        {dealerTotal !== null && (
          <>
            {' · '}
            <span data-testid="blackjack-dealer-total">
              {dealerTotal.soft ? `Soft ${dealerTotal.total}` : String(dealerTotal.total)}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
