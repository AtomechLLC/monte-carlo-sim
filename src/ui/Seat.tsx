import type { ReactNode } from 'react';
import type { Card } from '@poker-apprentice/types';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';
import { AnimatedCard } from './AnimatedCard';
import { dealOriginOffset, dealIndex } from './tableGeometry';

const HERO_HOLE_SLOTS = [0, 1] as const;

interface HeroSeatProps {
  variant: 'hero';
  heroHole: readonly [Card, Card] | undefined;
  dealNonce: number;
}

interface OpponentSeatProps {
  variant: 'opponent';
  index: number;
  hole: readonly [Card, Card] | undefined;
  revealed: boolean;
  hasHand: boolean;
  dealNonce: number;
  onReveal: (index: number) => void;
}

type SeatProps = HeroSeatProps | OpponentSeatProps;

/**
 * One seat on the felt: hero (bottom-centre, always face-up once dealt) or opponent (arced
 * across the top, face-down until revealed). The opponent branch's `data-testid`, `disabled`,
 * `onClick`, `aria-label` and `title` values are a byte-identical Phase 1-2 contract (03-PATTERNS
 * "src/ui/Seat.tsx", T-03-05) — only the card art payload inside the button changed from raw
 * text to `PlayingCard`/`CardBack`, and (03-03) each dealt hole card now flies in from the deck.
 */
export function Seat(props: SeatProps) {
  if (props.variant === 'hero') {
    return <HeroSeat heroHole={props.heroHole} dealNonce={props.dealNonce} />;
  }
  return (
    <OpponentSeat
      index={props.index}
      hole={props.hole}
      revealed={props.revealed}
      hasHand={props.hasHand}
      dealNonce={props.dealNonce}
      onReveal={props.onReveal}
    />
  );
}

const HERO_SEAT_KEY = 'hero';

function HeroSeat({
  heroHole,
  dealNonce,
}: {
  heroHole: readonly [Card, Card] | undefined;
  dealNonce: number;
}) {
  return (
    <div className="seat seat-hero">
      <div data-testid="hero-hole">
        {HERO_HOLE_SLOTS.map((slot) => {
          const card = heroHole?.[slot];
          // Pre-deal: a plain empty span (matches the `.card-slot--hero:empty` dashed-placeholder
          // rule, UI-SPEC A8) — never wrapped in AnimatedCard, or the gate would arm on page load
          // before any deal has happened. Keyed by slot alone; there is nothing to key by
          // dealNonce yet.
          if (!card) {
            return <span key={slot} className="card-slot card-slot--hero" />;
          }
          // Keyed by `${seatKey}-${slotIndex}-${dealNonce}` (never card identity, 03-RESEARCH
          // Anti-Patterns): a re-deal fully unmounts/remounts this element rather than Motion
          // retargeting an in-flight card into a different card.
          return (
            <AnimatedCard
              key={`${HERO_SEAT_KEY}-${slot}-${dealNonce}`}
              animationKey={`${HERO_SEAT_KEY}-${slot}-${dealNonce}`}
              origin={dealOriginOffset('seat-hero')}
              dealIndex={dealIndex('hero', slot)}
              className="card-slot card-slot--hero"
            >
              <PlayingCard card={card} />
            </AnimatedCard>
          );
        })}
      </div>
      <span data-testid="seat-label-hero" className="seat-label">
        You
      </span>
    </div>
  );
}

function OpponentSeat({
  index,
  hole,
  revealed,
  hasHand,
  dealNonce,
  onReveal,
}: {
  index: number;
  hole: readonly [Card, Card] | undefined;
  revealed: boolean;
  hasHand: boolean;
  dealNonce: number;
  onReveal: (index: number) => void;
}) {
  const label = `Opponent ${index + 1}`;
  const seatKey = `opponent-${index}`;
  const seatPositionKey = `seat-opponent-${index}` as const as
    | 'seat-opponent-0'
    | 'seat-opponent-1'
    | 'seat-opponent-2';
  const seatDealIndex = index as 0 | 1 | 2;

  // One hole-card slot, animated once a hand actually exists (`hasHand`). Before the first ever
  // deal there is nothing to fly in from, so a plain (non-animated) slot is rendered instead —
  // otherwise AnimatedCard would arm the gate on initial page load. `hasHand` flips true exactly
  // when `deal()` first runs, so the very first deal animates too, not just re-deals.
  function renderHoleSlot(slotIndex: 0 | 1, content: ReactNode) {
    if (!hasHand) {
      return (
        <span key={slotIndex} className="card-slot card-slot--opponent">
          {content}
        </span>
      );
    }
    // Keyed by `${seatKey}-${slotIndex}-${dealNonce}` (never card identity, 03-RESEARCH
    // Anti-Patterns): a re-deal fully unmounts/remounts this element rather than Motion
    // retargeting an in-flight card into a different card.
    return (
      <AnimatedCard
        key={`${seatKey}-${slotIndex}-${dealNonce}`}
        animationKey={`${seatKey}-${slotIndex}-${dealNonce}`}
        origin={dealOriginOffset(seatPositionKey)}
        dealIndex={dealIndex(seatDealIndex, slotIndex)}
        className="card-slot card-slot--opponent"
      >
        {content}
      </AnimatedCard>
    );
  }

  return (
    <div className={`seat seat-opponent-${index}`}>
      {revealed && hole ? (
        <button
          type="button"
          data-testid={`opponent-seat-${index}`}
          disabled
          aria-label={`${label} hole cards: ${hole[0]} ${hole[1]} (revealed)`}
        >
          {renderHoleSlot(0, <PlayingCard card={hole[0]} decorative />)}
          {renderHoleSlot(1, <PlayingCard card={hole[1]} decorative />)}
        </button>
      ) : (
        <button
          type="button"
          data-testid={`opponent-seat-${index}`}
          disabled={!hasHand}
          onClick={() => onReveal(index)}
          aria-label={`Reveal ${label} hole cards`}
          title="Click to reveal this opponent's hole cards"
        >
          {renderHoleSlot(0, <CardBack />)}
          {renderHoleSlot(1, <CardBack />)}
        </button>
      )}
      <span data-testid={`seat-label-opponent-${index}`} className="seat-label" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
