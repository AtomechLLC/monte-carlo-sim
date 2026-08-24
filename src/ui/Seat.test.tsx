import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Seat } from './Seat';

describe('Seat — hero variant', () => {
  it('renders hero-hole with exactly 2 children when no hand is dealt', () => {
    render(<Seat variant="hero" heroHole={undefined} dealNonce={0} />);
    expect(screen.getByTestId('hero-hole').children).toHaveLength(2);
  });

  it('renders hero-hole with exactly 2 children, each a face-up PlayingCard, once dealt', () => {
    render(<Seat variant="hero" heroHole={['As', 'Kd']} dealNonce={1} />);
    const heroHole = screen.getByTestId('hero-hole');
    expect(heroHole.children).toHaveLength(2);
    const images = heroHole.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('alt')).not.toBe('');
  });

  it('seat-label-hero reads "You" and is NOT aria-hidden', () => {
    render(<Seat variant="hero" heroHole={undefined} dealNonce={0} />);
    const label = screen.getByTestId('seat-label-hero');
    expect(label.textContent).toBe('You');
    expect(label).not.toHaveAttribute('aria-hidden');
  });
});

describe('Seat — opponent variant', () => {
  it('is disabled before any hand exists', () => {
    render(
      <Seat variant="opponent" index={0} hole={undefined} revealed={false} hasHand={false} dealNonce={0} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId('opponent-seat-0')).toBeDisabled();
  });

  it('a hidden seat is enabled once a hand exists, shows two card backs, and never leaks the hidden card codes (T-03-06)', () => {
    render(
      <Seat variant="opponent" index={0} hole={['As', 'Kd']} revealed={false} hasHand={true} dealNonce={1} onReveal={vi.fn()} />,
    );
    const seat = screen.getByTestId('opponent-seat-0');
    expect(seat).not.toBeDisabled();
    expect(seat).toHaveAttribute('aria-label', 'Reveal Opponent 1 hole cards');
    expect(seat).toHaveAttribute('title', "Click to reveal this opponent's hole cards");

    const images = seat.querySelectorAll('img');
    expect(images).toHaveLength(2);
    for (const img of Array.from(images)) {
      expect(img.getAttribute('src')).toBe('/cards/back.svg');
    }
    expect(seat.textContent).not.toContain('As');
    expect(seat.textContent).not.toContain('Kd');
  });

  it('clicking a hidden, enabled seat calls onReveal with its index', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <Seat variant="opponent" index={2} hole={['As', 'Kd']} revealed={false} hasHand={true} dealNonce={1} onReveal={onReveal} />,
    );

    await user.click(screen.getByTestId('opponent-seat-2'));

    expect(onReveal).toHaveBeenCalledWith(2);
  });

  it('a revealed seat shows both faces, is disabled, and carries the exact revealed aria-label', () => {
    render(
      <Seat variant="opponent" index={0} hole={['As', 'Kd']} revealed={true} hasHand={true} dealNonce={1} onReveal={vi.fn()} />,
    );
    const seat = screen.getByTestId('opponent-seat-0');
    expect(seat).toBeDisabled();
    expect(seat).toHaveAttribute('aria-label', 'Opponent 1 hole cards: As Kd (revealed)');
  });

  it('card art inside a revealed opponent seat is decorative (alt="") since the button aria-label is authoritative', () => {
    render(
      <Seat variant="opponent" index={0} hole={['As', 'Kd']} revealed={true} hasHand={true} dealNonce={1} onReveal={vi.fn()} />,
    );
    // 03-04: each hole-card slot is now a FlipCard, which keeps BOTH faces (back + front) mounted
    // simultaneously (the 3D rotateY technique never removes the back — it just rotates past it)
    // — so a revealed seat with 2 slots carries exactly 4 images: 2 backs + 2 faces.
    const images = screen.getByTestId('opponent-seat-0').querySelectorAll('img');
    expect(images).toHaveLength(4);
    for (const img of Array.from(images)) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('a revealed seat contains exactly two face images plus their two backs (03-04, FlipCard leak guard)', () => {
    render(
      <Seat variant="opponent" index={0} hole={['As', 'Kd']} revealed={true} hasHand={true} dealNonce={1} onReveal={vi.fn()} />,
    );
    const seat = screen.getByTestId('opponent-seat-0');
    const images = Array.from(seat.querySelectorAll('img'));
    const backs = images.filter((img) => img.getAttribute('src') === '/cards/back.svg');
    const faces = images.filter((img) => img.getAttribute('src') !== '/cards/back.svg');
    expect(backs).toHaveLength(2);
    expect(faces).toHaveLength(2);
  });

  it('a hidden seat never mounts a face-asset img anywhere in its subtree (T-03-12 leak guard)', () => {
    render(
      <Seat variant="opponent" index={0} hole={['As', 'Kd']} revealed={false} hasHand={true} dealNonce={1} onReveal={vi.fn()} />,
    );
    const seat = screen.getByTestId('opponent-seat-0');
    const images = Array.from(seat.querySelectorAll('img'));
    for (const img of images) {
      expect(img.getAttribute('src')).not.toMatch(/\/cards\/[CDHS]-/);
    }
  });

  it('seat-label-opponent-{i} is aria-hidden and reads "Opponent {i+1}"', () => {
    render(
      <Seat variant="opponent" index={1} hole={undefined} revealed={false} hasHand={false} dealNonce={0} onReveal={vi.fn()} />,
    );
    const label = screen.getByTestId('seat-label-opponent-1');
    expect(label.textContent).toBe('Opponent 2');
    expect(label).toHaveAttribute('aria-hidden', 'true');
  });
});
