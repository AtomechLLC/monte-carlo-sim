import { pocketColor, wheelPockets, type Pocket, type WheelKind } from '../engine/roulette';

// Wheel geometry in viewBox units. The SVG scales to its CSS width; nothing here is a pixel.
const SIZE = 320;
const CENTRE = SIZE / 2;
const RIM_RADIUS = 158;
const POCKET_OUTER = 152;
const POCKET_INNER = 112;
const LABEL_RADIUS = 132;
const TRACK_RADIUS = 104;
const BALL_RADIUS = 90;
const HUB_RADIUS = 60;

interface RouletteWheelProps {
  wheel: WheelKind;
  /** The pocket the ball is resting in, or null before the first revealed spin. */
  lastPocket: Pocket | null;
}

function polar(radius: number, angle: number): [number, number] {
  return [CENTRE + radius * Math.cos(angle), CENTRE + radius * Math.sin(angle)];
}

/** An annular sector from `start` to `end` (radians) between the two pocket radii. */
function wedgePath(start: number, end: number): string {
  const [ox1, oy1] = polar(POCKET_OUTER, start);
  const [ox2, oy2] = polar(POCKET_OUTER, end);
  const [ix1, iy1] = polar(POCKET_INNER, end);
  const [ix2, iy2] = polar(POCKET_INNER, start);
  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${POCKET_OUTER} ${POCKET_OUTER} 0 0 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${POCKET_INNER} ${POCKET_INNER} 0 0 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * The wheel as an SVG illustration (quick task 261015-ch8): every pocket drawn in its colour in
 * the wheel's real clockwise order, the zero at twelve o'clock, numbers printed radially the way
 * a casino wheel prints them. The ball sits in the last revealed pocket and the hub prints that
 * pocket's label large, so the latest result reads from across the room.
 *
 * Purely presentational and store-free: `RouletteTable` passes in the wheel and the last pocket.
 * The pocket buttons on the layout are the controls; this wheel is the picture of where the
 * ball went, and is labelled as one image for assistive tech.
 */
export function RouletteWheel({ wheel, lastPocket }: RouletteWheelProps) {
  const pockets = wheelPockets(wheel);
  const step = (2 * Math.PI) / pockets.length;
  const lastIndex = lastPocket === null ? -1 : pockets.indexOf(lastPocket);
  const description =
    `${pockets.length}-pocket roulette wheel` + (lastPocket === null ? '' : `, ball on ${lastPocket}`);

  return (
    <svg
      className="roulette-wheel"
      data-testid="roulette-wheel"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={description}
    >
      <circle className="roulette-wheel__rim" cx={CENTRE} cy={CENTRE} r={RIM_RADIUS} />
      {pockets.map((pocket, index) => {
        // Pocket `index` is centred at `index * step` clockwise from twelve o'clock.
        const middle = -Math.PI / 2 + index * step;
        const color = pocketColor(pocket);
        const hit = index === lastIndex;
        return (
          <path
            key={pocket}
            className={`roulette-wheel__pocket roulette-wheel__pocket--${color}${hit ? ' roulette-wheel__pocket--hit' : ''}`}
            data-testid={`roulette-wheel-pocket-${pocket}`}
            d={wedgePath(middle - step / 2, middle + step / 2)}
          />
        );
      })}
      {pockets.map((pocket, index) => {
        const middle = -Math.PI / 2 + index * step;
        const [x, y] = polar(LABEL_RADIUS, middle);
        // Rotated so each label reads outward along its own radius, as printed on a real wheel.
        const degrees = (middle * 180) / Math.PI + 90;
        return (
          <text
            key={pocket}
            className="roulette-wheel__label"
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${degrees.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`}
          >
            {pocket}
          </text>
        );
      })}
      <circle className="roulette-wheel__track" cx={CENTRE} cy={CENTRE} r={TRACK_RADIUS} />
      <circle className="roulette-wheel__hub" cx={CENTRE} cy={CENTRE} r={HUB_RADIUS} />
      {lastIndex >= 0 && (
        <circle
          className="roulette-wheel__ball"
          data-testid="roulette-wheel-ball"
          cx={polar(BALL_RADIUS, -Math.PI / 2 + lastIndex * step)[0].toFixed(2)}
          cy={polar(BALL_RADIUS, -Math.PI / 2 + lastIndex * step)[1].toFixed(2)}
          r={7}
        />
      )}
      <text
        className="roulette-wheel__result"
        data-testid="roulette-last-spin"
        x={CENTRE}
        y={CENTRE}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {lastPocket ?? ''}
      </text>
    </svg>
  );
}
