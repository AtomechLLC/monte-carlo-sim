import type { ReactNode } from 'react';
import { BET_LABELS, type CrapsBet } from '../engine/craps';
import { useCrapsStore } from '../state/crapsStore';

/** The six place numbers across the top of a craps layout, in table order. */
const PLACE_NUMBERS = [4, 5, 6, 8, 9, 10] as const;
/** The two the simulator lets you bet; the other four are the layout's art. */
const PLACE_BETS: Partial<Record<number, CrapsBet>> = { 6: 'place6', 8: 'place8' };

/**
 * The bet layout (quick task 261015-d7o): the classic craps felt read top to bottom in three
 * rows — the place boxes; the FIELD band beside the two proposition boxes; DON'T PASS beside
 * PASS LINE. Every bet is a real button carrying `aria-pressed`, toggled like the roulette
 * pockets; exactly one is pressed at a time because the store holds one bet. The four place
 * numbers the simulator does not score are drawn as inert boxes so the row still reads as the
 * row every craps player knows.
 *
 * Three rows rather than the five a literal reading of the table would give: the felt the
 * layout sits on is only ~380px tall at a 1280px viewport, and five stacked 44px-floor bars ran
 * into the Roll / Reset plate. The grid geometry lives in App.css (`.craps-layout`).
 *
 * Reads and writes only `useCrapsStore`.
 */
export function CrapsLayout() {
  const bet = useCrapsStore((state) => state.bet);
  const selectBet = useCrapsStore((state) => state.selectBet);

  const betButton = (kind: CrapsBet, className: string, children: ReactNode, label?: string) => (
    <button
      type="button"
      data-testid={`craps-bet-${kind}`}
      className={`craps-bet ${className}`}
      aria-pressed={bet === kind}
      aria-label={label}
      onClick={() => selectBet(kind)}
    >
      {children}
    </button>
  );

  return (
    <div className="craps-layout" data-testid="craps-layout" role="group" aria-label="Bets">
      <div className="craps-place-row">
        {PLACE_NUMBERS.map((number) => {
          const kind = PLACE_BETS[number];
          return kind === undefined ? (
            // Layout art, not a control: present so the row is the row, inert so it promises
            // nothing it cannot score.
            <div key={number} className="craps-place-box craps-place-box--inert" aria-hidden="true">
              {number}
            </div>
          ) : (
            <span key={number} className="craps-place-slot">
              {betButton(
                kind,
                'craps-bet--place',
                <>
                  {number}
                  <span className="craps-bet__sub">place</span>
                </>,
                BET_LABELS[kind],
              )}
            </span>
          );
        })}
      </div>
      {betButton(
        'field',
        'craps-bet--field',
        <>
          {BET_LABELS.field}
          <span className="craps-bet__sub">2 · 3 · 4 · 9 · 10 · 11 · 12</span>
        </>,
      )}
      {betButton(
        'anySeven',
        'craps-bet--any-seven',
        <>
          {BET_LABELS.anySeven}
          <span className="craps-bet__sub">4 to 1</span>
        </>,
      )}
      {betButton(
        'anyCraps',
        'craps-bet--any-craps',
        <>
          {BET_LABELS.anyCraps}
          <span className="craps-bet__sub">7 to 1</span>
        </>,
      )}
      {betButton(
        'dontPass',
        'craps-bet--dont-pass',
        <>
          {BET_LABELS.dontPass}
          <span className="craps-bet__sub">bar 12</span>
        </>,
      )}
      {betButton('pass', 'craps-bet--pass', BET_LABELS.pass)}
    </div>
  );
}
