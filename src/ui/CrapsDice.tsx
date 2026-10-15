import { useMemo } from 'react';
import type { Die } from '../engine/craps';
import { useCrapsStore } from '../state/crapsStore';
import { describeTrial } from './crapsTrialText';

// Pip geometry in a 64-unit viewBox: the three columns and three rows a die face uses.
const PIP: Record<'TL' | 'TR' | 'ML' | 'MR' | 'BL' | 'BR' | 'C', readonly [number, number]> = {
  TL: [18, 18],
  TR: [46, 18],
  ML: [18, 32],
  MR: [46, 32],
  BL: [18, 46],
  BR: [46, 46],
  C: [32, 32],
};

const FACES: Record<Die, ReadonlyArray<keyof typeof PIP>> = {
  1: ['C'],
  2: ['TL', 'BR'],
  3: ['TL', 'C', 'BR'],
  4: ['TL', 'TR', 'BL', 'BR'],
  5: ['TL', 'TR', 'C', 'BL', 'BR'],
  6: ['TL', 'ML', 'BL', 'TR', 'MR', 'BR'],
};

/** One die face as an SVG: ivory stock, ink pips, the way the card art is drawn. */
export function DieFace({ value, index }: { value: Die; index: number }) {
  return (
    <svg
      className="craps-die"
      data-testid={`craps-die-${index}`}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Die showing ${value}`}
    >
      <rect className="craps-die__stock" x="2" y="2" width="60" height="60" rx="10" />
      {FACES[value].map((pip) => (
        <circle key={pip} className="craps-die__pip" cx={PIP[pip][0]} cy={PIP[pip][1]} r="5.5" />
      ))}
    </svg>
  );
}

/**
 * The dice (quick task 261015-d7o): the last roll of the last REVEALED decision as two die
 * faces, and that decision spelled out beneath them. Before the first decision the two faces
 * are dashed placeholders, the way an undealt card slot is.
 */
export function CrapsDice() {
  const bet = useCrapsStore((state) => state.bet);
  const trials = useCrapsStore((state) => state.trials);
  const revealed = useCrapsStore((state) => state.revealed);

  const lastTrial = revealed > 0 ? trials[revealed - 1] : null;
  const lastRoll = lastTrial === null ? null : lastTrial.rolls[lastTrial.rolls.length - 1];
  const description = useMemo(
    () => (lastTrial === null || bet === null ? null : describeTrial(lastTrial, bet)),
    [lastTrial, bet],
  );

  return (
    <div className="craps-dice" data-testid="craps-dice">
      <div className="craps-dice__pair">
        {lastRoll === null ? (
          <>
            <span className="craps-die-placeholder" data-testid="craps-dice-placeholder" />
            <span className="craps-die-placeholder" />
          </>
        ) : (
          <>
            <DieFace value={lastRoll[0]} index={0} />
            <DieFace value={lastRoll[1]} index={1} />
          </>
        )}
      </div>
      {description !== null && (
        <p className="craps-dice__sequence" data-testid="craps-last-trial">
          {description}
        </p>
      )}
    </div>
  );
}
