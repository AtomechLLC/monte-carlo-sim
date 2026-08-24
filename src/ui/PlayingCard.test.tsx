import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { FULL_DECK } from '../engine/cards';
import { PlayingCard, cardAssetPath, cardAltText } from './PlayingCard';
import { CardBack } from './CardBack';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_CARDS_DIR = join(__dirname, '..', '..', 'public', 'cards');

describe('cardAssetPath', () => {
  it('maps explicit examples per the Card -> vendored-deck naming convention', () => {
    expect(cardAssetPath('As')).toBe('/cards/S-A.svg');
    expect(cardAssetPath('Td')).toBe('/cards/D-10.svg');
    expect(cardAssetPath('2c')).toBe('/cards/C-2.svg');
  });

  it('produces a valid, distinct path for all 52 cards in FULL_DECK', () => {
    const paths = FULL_DECK.map((card) => cardAssetPath(card));
    for (const path of paths) {
      expect(path).toMatch(/^\/cards\/[CDHS]-(10|[2-9JQKA])\.svg$/);
    }
    expect(new Set(paths).size).toBe(52);
  });

  it('resolves to a file that actually exists on disk in public/cards/ for all 52 cards', () => {
    for (const card of FULL_DECK) {
      const path = cardAssetPath(card);
      const basename = path.replace('/cards/', '');
      const onDisk = join(PUBLIC_CARDS_DIR, basename);
      expect(existsSync(onDisk)).toBe(true);
    }
  });
});

describe('cardAltText', () => {
  it('maps explicit examples to human-readable "{Rank} of {Suit}" text', () => {
    expect(cardAltText('As')).toBe('Ace of Spades');
    expect(cardAltText('Td')).toBe('Ten of Diamonds');
    expect(cardAltText('2c')).toBe('Two of Clubs');
  });
});

describe('PlayingCard', () => {
  it('renders an img with the correct src and full alt text by default', () => {
    render(<PlayingCard card="As" />);
    const img = screen.getByRole('img', { name: 'Ace of Spades' });
    expect(img).toHaveAttribute('src', '/cards/S-A.svg');
    expect(img).toHaveAttribute('alt', 'Ace of Spades');
  });

  it('renders alt="" when decorative is true, keeping the same src', () => {
    const { container } = render(<PlayingCard card="As" decorative />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/cards/S-A.svg');
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders the card back (never the face asset path) when faceUp is false', () => {
    const { container } = render(<PlayingCard card="As" faceUp={false} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/cards/back.svg');
    expect(img).toHaveAttribute('alt', '');
    expect(container.innerHTML).not.toContain('/cards/S-A.svg');
  });

  it('every rendered card image carries the shared "playing-card" class', () => {
    const { container: faceContainer } = render(<PlayingCard card="As" />);
    expect(faceContainer.querySelector('img')).toHaveClass('playing-card');

    const { container: backContainer } = render(<PlayingCard card="As" faceUp={false} />);
    expect(backContainer.querySelector('img')).toHaveClass('playing-card');
  });
});

describe('CardBack', () => {
  it('renders an img with src="/cards/back.svg" and alt=""', () => {
    const { container } = render(<CardBack />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/cards/back.svg');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveClass('playing-card');
  });
});
