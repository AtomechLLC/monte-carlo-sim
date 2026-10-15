import type { ReactNode } from 'react';
import { CrapsLayout } from './CrapsLayout';
import { CrapsDice } from './CrapsDice';
import { useCrapsStore } from '../state/crapsStore';
import { BET_LABELS, houseEdge } from '../engine/craps';

/**
 * The craps felt (quick task 261015-d7o): the bet layout at the left, the dice and the last
 * decision's roll sequence at the right, the printed line along the top, and the on-felt chrome
 * slot for Roll / Reset. A pure layout shell over the store, like every other table; a rounded
 * rectangle, like roulette's.
 *
 * The printed line states the selected bet's house edge — the one number every closed form in
 * the engine reduces to — or, before a bet is picked, what the layout offers.
 */
export function CrapsTable({ children }: { children?: ReactNode }) {
  const bet = useCrapsStore((state) => state.bet);
  const fieldRule = useCrapsStore((state) => state.fieldRule);

  const rules =
    bet === null
      ? 'SEVEN BETS · PICK ONE'
      : `${BET_LABELS[bet].toUpperCase()} · HOUSE EDGE ${(houseEdge(bet, fieldRule) * 100).toFixed(2)}%`;

  return (
    <div data-testid="craps-scene" className="felt felt--craps">
      <p className="roulette-rules craps-rules" data-testid="craps-house-edge">
        {rules}
      </p>
      <CrapsLayout />
      <CrapsDice />
      {children}
    </div>
  );
}
