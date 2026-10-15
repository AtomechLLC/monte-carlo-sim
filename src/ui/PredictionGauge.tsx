import { shareWidth } from './categoryShares';

interface PredictionGaugeProps {
  /** Prefix for the two testids: `${prefix}-gauge-fill` and `${prefix}-gauge-mark`. */
  testidPrefix: string;
  /** The observed hit rate, 0..1. */
  observed: number;
  /** The closed-form probability, 0..1 — where the mark sits. */
  probability: number;
  /** True before the first trial: the fill is empty, the mark still shows the true odds. */
  empty: boolean;
}

/**
 * The observed-versus-true gauge (quick task 261015-ch8): a track scaled 0–100%, a fill at
 * the observed rate and a thin mark at the true probability. Watching the fill settle onto
 * the mark as trials accumulate is the whole lesson, which is why it exists beside the digits.
 *
 * Decorative, like the Share column's bars: `aria-hidden` on the track, because the two
 * percentages beside it already say everything the gauge shows. Widths are inline styles
 * because they are data, not theme; the transition that makes the fill glide lives in
 * App.css. Shared between the batch games — nothing here is roulette-specific.
 */
export function PredictionGauge({ testidPrefix, observed, probability, empty }: PredictionGaugeProps) {
  return (
    <div className="prediction-gauge" aria-hidden="true">
      <div
        className="prediction-gauge__fill"
        data-testid={`${testidPrefix}-gauge-fill`}
        style={{ width: shareWidth(empty ? 0 : observed) }}
      />
      <div
        className="prediction-gauge__mark"
        data-testid={`${testidPrefix}-gauge-mark`}
        style={{ left: shareWidth(probability) }}
      />
    </div>
  );
}
