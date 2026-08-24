import type { Card } from '@poker-apprentice/types';
import { PlayingCard } from './PlayingCard';
import { CardBack } from './CardBack';

const HERO_HOLE_SLOTS = [0, 1] as const;

interface HeroSeatProps {
  variant: 'hero';
  heroHole: readonly [Card, Card] | undefined;
}

interface OpponentSeatProps {
  variant: 'opponent';
  index: number;
  hole: readonly [Card, Card] | undefined;
  revealed: boolean;
  hasHand: boolean;
  onReveal: (index: number) => void;
}

type SeatProps = HeroSeatProps | OpponentSeatProps;

/**
 * One seat on the felt: hero (bottom-centre, always face-up once dealt) or opponent (arced
 * across the top, face-down until revealed). The opponent branch's `data-testid`, `disabled`,
 * `onClick`, `aria-label` and `title` values are a byte-identical Phase 1-2 contract (03-PATTERNS
 * "src/ui/Seat.tsx", T-03-05) — only the card art payload inside the button changed from raw
 * text to `PlayingCard`/`CardBack`.
 */
export function Seat(props: SeatProps) {
  if (props.variant === 'hero') {
    return <HeroSeat heroHole={props.heroHole} />;
  }
  return (
    <OpponentSeat
      index={props.index}
      hole={props.hole}
      revealed={props.revealed}
      hasHand={props.hasHand}
      onReveal={props.onReveal}
    />
  );
}

function HeroSeat({ heroHole }: { heroHole: readonly [Card, Card] | undefined }) {
  return (
    <div className="seat seat-hero">
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
  onReveal,
}: {
  index: number;
  hole: readonly [Card, Card] | undefined;
  revealed: boolean;
  hasHand: boolean;
  onReveal: (index: number) => void;
}) {
  const label = `Opponent ${index + 1}`;

  return (
    <div className={`seat seat-opponent-${index}`}>
      {revealed && hole ? (
        <button
          type="button"
          data-testid={`opponent-seat-${index}`}
          disabled
          aria-label={`${label} hole cards: ${hole[0]} ${hole[1]} (revealed)`}
        >
          <span className="card-slot card-slot--opponent">
            <PlayingCard card={hole[0]} decorative />
          </span>
          <span className="card-slot card-slot--opponent">
            <PlayingCard card={hole[1]} decorative />
          </span>
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
          <span className="card-slot card-slot--opponent">
            <CardBack />
          </span>
          <span className="card-slot card-slot--opponent">
            <CardBack />
          </span>
        </button>
      )}
      <span data-testid={`seat-label-opponent-${index}`} className="seat-label" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
