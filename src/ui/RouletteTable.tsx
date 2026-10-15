import type { ReactNode } from 'react';
import { RouletteWheel } from './RouletteWheel';
import { RouletteLayout } from './RouletteLayout';
import { useRouletteStore } from '../state/rouletteStore';
import { houseEdge, pocketCount } from '../engine/roulette';

/**
 * The roulette felt (quick task 261015-ch8): the wheel at the left, the betting layout to its
 * right, the printed house-edge line along the top, and the on-felt chrome slot for Spin /
 * Reset — a pure layout shell over the store, like the other two tables. Unlike them it
 * releases no animation gate, because nothing on it is a card.
 *
 * A roulette table is a long rectangle, so this felt is one (`.felt--roulette` rounds the
 * oval's corners back to a radius) — the Blackjack half-moon precedent: the shape carries which
 * game you are at before you read a single control.
 *
 * The printed line is the one place the wheel's defining number is stated as a consequence:
 * every bet on a single-zero wheel gives the house 1/37, every bet on a double-zero wheel 2/38,
 * and roulette.property.test.ts proves that equality for every target.
 */
export function RouletteTable({ children }: { children?: ReactNode }) {
  const wheel = useRouletteStore((state) => state.wheel);
  const spins = useRouletteStore((state) => state.spins);
  const revealed = useRouletteStore((state) => state.revealed);

  // The ball sits on the most recently REVEALED spin, not the most recent spun one — while a
  // batch is landing the wheel shows the spin the display has just counted.
  const lastPocket = revealed > 0 ? spins[revealed - 1] : null;
  const edgePct = (houseEdge(wheel) * 100).toFixed(2);

  return (
    <div data-testid="roulette-scene" className="felt felt--roulette">
      <p className="roulette-rules" data-testid="roulette-house-edge">
        {wheel === 'american' ? 'DOUBLE ZERO' : 'SINGLE ZERO'} · {pocketCount(wheel)} POCKETS · HOUSE EDGE{' '}
        {edgePct}%
      </p>
      <RouletteWheel wheel={wheel} lastPocket={lastPocket} />
      <RouletteLayout />
      {children}
    </div>
  );
}
