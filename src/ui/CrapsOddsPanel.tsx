import { useMemo } from 'react';
import {
  BET_LABELS,
  DICE_TOTALS,
  betPayout,
  betPayoutText,
  countTotals,
  houseEdge,
  pushProbability,
  tallyTrials,
  totalProbability,
  winProbability,
} from '../engine/craps';
import { formatSignedUnits, scoreTallied } from '../engine/predictionScore';
import { useCrapsStore } from '../state/crapsStore';
import { PredictionGauge } from './PredictionGauge';
import { categoryShares, shareWidth } from './categoryShares';
import { formatPct } from './formatPct';

const DECISIONS_LABEL = 'Decisions';
const ROLLS_LABEL = 'Rolls';
const EDGE_LABEL = 'House edge';
const NO_BET_COPY = 'Pick a bet on the layout to score it here.';
const TOTALS_CAPTION = 'Dice totals';
const TOTALS_SUBTITLE = 'Every roll so far — six ways to make a 7, one way to make a 2';
const HISTORY_LABEL = 'Decision history, newest first';
const HISTORY_LIMIT = 100;

/**
 * The craps odds cluster (quick task 261015-d7o), docked beside the felt. Everything is derived
 * from the REVEALED prefix of the history: the decision counter climbs, the win rate wobbles, the
 * gauge chases the mark — and underneath, the dice-total table fills in the triangle one roll at
 * a time. Reads only `useCrapsStore`.
 */
export function CrapsOddsPanel() {
  const bet = useCrapsStore((state) => state.bet);
  const fieldRule = useCrapsStore((state) => state.fieldRule);
  const trials = useCrapsStore((state) => state.trials);
  const revealed = useCrapsStore((state) => state.revealed);

  const revealedTrials = useMemo(() => trials.slice(0, revealed), [trials, revealed]);
  const tally = useMemo(() => tallyTrials(revealedTrials), [revealedTrials]);
  const totals = useMemo(() => countTotals(revealedTrials), [revealedTrials]);
  const rollCount = useMemo(() => [...totals.values()].reduce((a, b) => a + b, 0), [totals]);
  const totalCounts = DICE_TOTALS.map((total) => totals.get(total) ?? 0);
  const shares = categoryShares(totalCounts, DICE_TOTALS.length, rollCount, false);
  const history = useMemo(() => revealedTrials.slice(-HISTORY_LIMIT).reverse(), [revealedTrials]);

  const score = bet === null ? null : scoreTallied(tally, winProbability(bet), betPayout(bet));
  const empty = tally.trials === 0;

  return (
    <div data-testid="craps-odds-panel" className="craps-odds-panel">
      <dl className="odds-stats">
        <div className="odds-stat">
          <dt className="odds-stat__label">{DECISIONS_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="craps-trial-counter">
            {tally.trials.toLocaleString()}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">{ROLLS_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="craps-roll-counter">
            {rollCount.toLocaleString()}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">{EDGE_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="craps-edge-pct">
            {bet === null ? '—' : `${(houseEdge(bet, fieldRule) * 100).toFixed(2)}%`}
          </dd>
        </div>
      </dl>
      {bet === null && (
        <p className="roulette-prompt" data-testid="craps-no-bet">
          {NO_BET_COPY}
        </p>
      )}
      {bet !== null && score !== null && (
        <section className="prediction-score" data-testid="craps-bet-score">
          <p className="prediction-score__caption">
            {BET_LABELS[bet]}
            <span className="prediction-score__subtitle">{betPayoutText(bet, fieldRule)}</span>
          </p>
          <dl className="odds-stats">
            <div className="odds-stat odds-stat--hero">
              <dt className="odds-stat__label">Win rate</dt>
              <dd className="odds-stat__value" data-testid="craps-bet-observed">
                {formatPct(score.hits, score.trials, false)}
              </dd>
            </div>
            <div className="odds-stat">
              <dt className="odds-stat__label">True odds</dt>
              <dd className="odds-stat__value" data-testid="craps-bet-true">
                {`${(score.probability * 100).toFixed(1)}%`}
              </dd>
            </div>
            <div className="odds-stat">
              <dt className="odds-stat__label">Wins</dt>
              <dd className="odds-stat__value" data-testid="craps-bet-hits">
                {`${score.hits} of ${score.trials}`}
              </dd>
            </div>
            <div className="odds-stat">
              <dt className="odds-stat__label">Expected</dt>
              <dd className="odds-stat__value" data-testid="craps-bet-expected">
                {empty ? '—' : score.expectedHits.toFixed(1)}
              </dd>
            </div>
            {pushProbability(bet) > 0 && (
              <div className="odds-stat">
                <dt className="odds-stat__label">Pushes</dt>
                <dd className="odds-stat__value" data-testid="craps-bet-pushes">
                  {empty ? '—' : `${score.pushes} (true ${(pushProbability(bet) * 100).toFixed(1)}%)`}
                </dd>
              </div>
            )}
            <div className="odds-stat">
              <dt className="odds-stat__label">Net, 1 unit a decision</dt>
              <dd className="odds-stat__value" data-testid="craps-bet-net">
                {empty ? '—' : `${formatSignedUnits(score.netUnits)} units`}
              </dd>
            </div>
          </dl>
          <PredictionGauge testidPrefix="craps-bet" observed={score.observed} probability={score.probability} empty={empty} />
        </section>
      )}
      <table data-testid="craps-totals-table">
        <caption className="category-table__caption">
          {TOTALS_CAPTION}
          <span className="category-table__subtitle">{TOTALS_SUBTITLE}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Total</th>
            <th scope="col">Share</th>
            <th scope="col">Rolled</th>
            <th scope="col">Observed</th>
            <th scope="col">True odds</th>
          </tr>
        </thead>
        <tbody>
          {DICE_TOTALS.map((total, index) => (
            <tr key={total}>
              <th scope="row">{total}</th>
              <td className="category-table__share">
                <div className="category-bar" aria-hidden="true">
                  <div
                    className={
                      shares[index]?.leading ? 'category-bar__fill category-bar__fill--leading' : 'category-bar__fill'
                    }
                    data-testid={`craps-total-bar-${total}`}
                    style={{ width: shareWidth(shares[index]?.share ?? 0) }}
                  />
                </div>
              </td>
              <td data-testid={`craps-total-count-${total}`}>{totalCounts[index]}</td>
              <td data-testid={`craps-total-pct-${total}`}>{formatPct(totalCounts[index], rollCount, false)}</td>
              <td data-testid={`craps-total-true-${total}`}>{`${(totalProbability(total) * 100).toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="craps-history" data-testid="craps-history" aria-label={HISTORY_LABEL}>
        {history.map((trial, index) => (
          <li
            key={`${tally.trials - index}`}
            className={`craps-chip craps-chip--${trial.outcome}${index === 0 ? ' craps-chip--latest' : ''}`}
            title={trial.outcome}
          >
            <span className="visually-hidden">{trial.outcome}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
