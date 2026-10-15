import type { CSSProperties } from 'react';
import { LAYOUT_NUMBERS, greenPockets, pocketColor, type Pocket, type PocketColor } from '../engine/roulette';
import { useRouletteStore } from '../state/rouletteStore';

const COLORS: readonly PocketColor[] = ['red', 'black', 'green'];
const COLOR_LABELS: Record<PocketColor, string> = { red: 'Red', black: 'Black', green: 'Green' };

/**
 * Where a number sits on the classic layout: twelve columns of three, 1-2-3 running UP each
 * column, the zeros in their own column at the left. The grid is six rows tall so the American
 * wheel's two zeros can each take half of it; a number spans two rows.
 */
function numberPlacement(pocket: Pocket): CSSProperties {
  const n = Number(pocket);
  const column = Math.ceil(n / 3) + 1; // column 1 is the zeros
  const row = n % 3 === 0 ? 1 : n % 3 === 2 ? 3 : 5; // 3 on top, 1 at the bottom
  return { gridColumn: column, gridRow: `${row} / span 2` };
}

function zeroPlacement(index: number, count: number): CSSProperties {
  return count === 1
    ? { gridColumn: 1, gridRow: '1 / span 6' }
    : { gridColumn: 1, gridRow: `${1 + index * 3} / span 3` };
}

/**
 * The betting layout (quick task 261015-ch8): the number grid for a straight-up pick and the
 * three colour bets beneath it. Every cell is a real button carrying `aria-pressed`, so a
 * prediction is a toggle the way the switcher is — pressing the selected cell clears it. A
 * pocket's colour is part of its accessible name (visually it IS the button's fill), so a
 * screen-reader user hears "17, black" rather than just "17".
 *
 * Reads and writes only `useRouletteStore`. The zero column follows the wheel: one tall 0 on
 * single zero, a 0 over a 00 on double zero.
 */
export function RouletteLayout() {
  const wheel = useRouletteStore((state) => state.wheel);
  const color = useRouletteStore((state) => state.color);
  const number = useRouletteStore((state) => state.number);
  const selectColor = useRouletteStore((state) => state.selectColor);
  const selectNumber = useRouletteStore((state) => state.selectNumber);

  const zeros = greenPockets(wheel);

  const pocketButton = (pocket: Pocket, style: CSSProperties) => {
    const pocketShade = pocketColor(pocket);
    return (
      <button
        key={pocket}
        type="button"
        data-testid={`roulette-pocket-${pocket}`}
        className={`roulette-pocket roulette-pocket--${pocketShade}`}
        aria-pressed={number === pocket}
        onClick={() => selectNumber(pocket)}
        style={style}
      >
        {pocket}
        <span className="visually-hidden">, {pocketShade}</span>
      </button>
    );
  };

  return (
    <div className="roulette-layout" data-testid="roulette-layout">
      <div className="roulette-grid" role="group" aria-label="Straight-up numbers">
        {zeros.map((pocket, index) => pocketButton(pocket, zeroPlacement(index, zeros.length)))}
        {LAYOUT_NUMBERS.map((pocket) => pocketButton(pocket, numberPlacement(pocket)))}
      </div>
      <div className="roulette-colors" role="group" aria-label="Colors">
        {COLORS.map((shade) => (
          <button
            key={shade}
            type="button"
            data-testid={`roulette-color-${shade}`}
            className={`roulette-color roulette-color--${shade}`}
            aria-pressed={color === shade}
            onClick={() => selectColor(shade)}
          >
            {COLOR_LABELS[shade]}
            {shade === 'green' && <span className="roulette-color__sub"> {zeros.join(' · ')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
