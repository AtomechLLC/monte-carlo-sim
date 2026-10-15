import { useMemo } from 'react';
import {
  countHits,
  houseEdge,
  payoutFor,
  pocketColor,
  pocketCount,
  pocketsCovered,
  targetLabel,
  trueProbability,
  type Pocket,
  type PocketColor,
  type PredictionTarget,
  type WheelKind,
} from '../engine/roulette';
import { formatSignedUnits, scorePrediction } from '../engine/predictionScore';
import { useRouletteStore } from '../state/rouletteStore';
import { PredictionGauge } from './PredictionGauge';
import { categoryShares, shareWidth } from './categoryShares';
import { formatPct } from './formatPct';

const SPINS_LABEL = 'Spins';
const EDGE_LABEL = 'House edge';
const NO_PREDICTION_COPY = 'Pick a color or a number on the layout to score it here.';
const LANDED_CAPTION = 'Where the ball landed';
const LANDED_SUBTITLE = 'Every spin so far, by color';
const HISTORY_LABEL = 'Spin history, newest first';
/** The history strip shows at most this many chips — the latest ones. */
const HISTORY_LIMIT = 100;

const COLORS: readonly PocketColor[] = ['red', 'black', 'green'];
const COLOR_LABELS: Record<PocketColor, string> = { red: 'Red', black: 'Black', green: 'Green' };

interface ScoreCardProps {
  testidPrefix: string;
  target: PredictionTarget;
  wheel: WheelKind;
  spins: readonly Pocket[];
}

/**
 * One prediction's readout: the hit rate as the hero figure, the true odds beside it, then the
 * raw hits, what the maths expected, and the net at one unit a spin — followed by the gauge
 * that puts the first two on one line. Before the first spin every observed figure is the
 * em dash the other panels use, but the true odds already show: picking a pocket and reading
 * "2.7%" is useful before a single spin.
 */
function ScoreCard({ testidPrefix, target, wheel, spins }: ScoreCardProps) {
  const probability = trueProbability(wheel, target);
  const payout = payoutFor(wheel, target);
  const score = scorePrediction(countHits(spins, target), spins.length, probability, payout);
  const empty = score.trials === 0;
  const covered = pocketsCovered(wheel, target);
  const subtitle = `${covered} of ${pocketCount(wheel)} pockets · pays ${payout} to 1`;

  return (
    <section className="prediction-score" data-testid={`${testidPrefix}-score`}>
      <p className="prediction-score__caption">
        {targetLabel(target)}
        <span className="prediction-score__subtitle">{subtitle}</span>
      </p>
      <dl className="odds-stats">
        <div className="odds-stat odds-stat--hero">
          <dt className="odds-stat__label">Hit rate</dt>
          <dd className="odds-stat__value" data-testid={`${testidPrefix}-observed`}>
            {formatPct(score.hits, score.trials, false)}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">True odds</dt>
          <dd className="odds-stat__value" data-testid={`${testidPrefix}-true`}>
            {`${(probability * 100).toFixed(1)}%`}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">Hits</dt>
          <dd className="odds-stat__value" data-testid={`${testidPrefix}-hits`}>
            {`${score.hits} of ${score.trials}`}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">Expected</dt>
          <dd className="odds-stat__value" data-testid={`${testidPrefix}-expected`}>
            {empty ? '—' : score.expectedHits.toFixed(1)}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">Net, 1 unit a spin</dt>
          <dd className="odds-stat__value" data-testid={`${testidPrefix}-net`}>
            {empty ? '—' : `${formatSignedUnits(score.netUnits)} units`}
          </dd>
        </div>
      </dl>
      <PredictionGauge
        testidPrefix={testidPrefix}
        observed={score.observed}
        probability={probability}
        empty={empty}
      />
    </section>
  );
}

/**
 * The roulette odds cluster (quick task 261015-ch8), docked outside the felt like the other
 * two panels. Everything here is derived from the REVEALED prefix of the history: while a batch
 * is landing the spin counter climbs, the hit rate wobbles and the gauge fill chases the mark,
 * which is the convergence display for this game. Reads only `useRouletteStore`.
 */
export function RouletteOddsPanel() {
  const wheel = useRouletteStore((state) => state.wheel);
  const color = useRouletteStore((state) => state.color);
  const number = useRouletteStore((state) => state.number);
  const spins = useRouletteStore((state) => state.spins);
  const revealed = useRouletteStore((state) => state.revealed);

  const revealedSpins = useMemo(() => spins.slice(0, revealed), [spins, revealed]);
  const trials = revealedSpins.length;

  const colorTarget: PredictionTarget | null = color === null ? null : { kind: 'color', color };
  const numberTarget: PredictionTarget | null = number === null ? null : { kind: 'number', pocket: number };

  const landed = useMemo(
    () => COLORS.map((shade) => countHits(revealedSpins, { kind: 'color', color: shade })),
    [revealedSpins],
  );
  const shares = categoryShares(landed, COLORS.length, trials, false);
  const history = useMemo(() => revealedSpins.slice(-HISTORY_LIMIT).reverse(), [revealedSpins]);

  return (
    <div data-testid="roulette-odds-panel" className="roulette-odds-panel">
      <dl className="odds-stats">
        <div className="odds-stat">
          <dt className="odds-stat__label">{SPINS_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="roulette-spin-counter">
            {trials.toLocaleString()}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">{EDGE_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="roulette-edge-pct">
            {`${(houseEdge(wheel) * 100).toFixed(2)}%`}
          </dd>
        </div>
      </dl>
      {colorTarget === null && numberTarget === null && (
        <p className="roulette-prompt" data-testid="roulette-no-prediction">
          {NO_PREDICTION_COPY}
        </p>
      )}
      {colorTarget !== null && (
        <ScoreCard testidPrefix="roulette-color" target={colorTarget} wheel={wheel} spins={revealedSpins} />
      )}
      {numberTarget !== null && (
        <ScoreCard testidPrefix="roulette-number" target={numberTarget} wheel={wheel} spins={revealedSpins} />
      )}
      <table data-testid="roulette-landed-table">
        <caption className="category-table__caption">
          {LANDED_CAPTION}
          <span className="category-table__subtitle">{LANDED_SUBTITLE}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Color</th>
            <th scope="col">Share</th>
            <th scope="col">Landed</th>
            <th scope="col">Observed</th>
            <th scope="col">True odds</th>
          </tr>
        </thead>
        <tbody>
          {COLORS.map((shade, index) => (
            <tr key={shade}>
              <th scope="row">{COLOR_LABELS[shade]}</th>
              {/* The same decorative share bar as the Hold'em category table, relative to the
                  largest colour — see categoryShares.ts for why relative-to-max. */}
              <td className="category-table__share">
                <div className="category-bar" aria-hidden="true">
                  <div
                    className={
                      shares[index]?.leading ? 'category-bar__fill category-bar__fill--leading' : 'category-bar__fill'
                    }
                    data-testid={`roulette-landed-bar-${shade}`}
                    style={{ width: shareWidth(shares[index]?.share ?? 0) }}
                  />
                </div>
              </td>
              <td data-testid={`roulette-landed-count-${shade}`}>{landed[index]}</td>
              <td data-testid={`roulette-landed-pct-${shade}`}>{formatPct(landed[index], trials, false)}</td>
              <td data-testid={`roulette-landed-true-${shade}`}>
                {`${(trueProbability(wheel, { kind: 'color', color: shade }) * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="roulette-history" data-testid="roulette-history" aria-label={HISTORY_LABEL}>
        {history.map((pocket, index) => (
          <li
            // Keyed by position from the newest end: a new spin shifts every chip one place,
            // which is exactly the visual a marquee board gives.
            key={`${trials - index}`}
            className={`roulette-chip roulette-chip--${pocketColor(pocket)}${index === 0 ? ' roulette-chip--latest' : ''}`}
            title={pocket}
          >
            <span className="visually-hidden">{pocket}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
