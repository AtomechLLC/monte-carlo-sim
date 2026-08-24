import type { DEALER_BUCKET_ORDER } from '../worker/blackjackProtocol';

/**
 * Compile-time length lock: both parallel arrays below must be exactly as long as
 * `DEALER_BUCKET_ORDER` (i.e. `DEALER_BUCKET_COUNT`, 7) — adding or dropping an entry
 * fails to typecheck. A test-time assertion against `DEALER_BUCKET_COUNT` backs this up
 * in `BlackjackOddsPanel.test.tsx`.
 */
type DealerBucketParallelArray = readonly string[] & {
  readonly length: (typeof DEALER_BUCKET_ORDER)['length'];
};

/**
 * Display labels for the dealer final-outcome table's seven rows. Parallel to
 * `DEALER_BUCKET_ORDER` in `src/worker/blackjackProtocol.ts` — index N here labels the
 * tally at `dealerOutcomeCounts[N]`. The order is FIXED by 06-RESEARCH's bucket index
 * (17, 18, 19, 20, 21, natural, bust): a reorder here silently mislabels every row while
 * every sum-based check stays green.
 */
export const DEALER_BUCKET_LABELS: DealerBucketParallelArray = [
  '17',
  '18',
  '19',
  '20',
  '21',
  'Natural',
  'Bust',
] as const;

/**
 * Testid suffixes for the same rows (`blackjack-dealer-pct-{suffix}`), locked by
 * 06-UI-SPEC — lowercase, name-suffixed (never index-suffixed, so a future row reorder
 * cannot silently rename cells). Parallel to `DEALER_BUCKET_ORDER`, same fixed order as
 * `DEALER_BUCKET_LABELS` above.
 */
export const DEALER_BUCKET_TESTIDS: DealerBucketParallelArray = [
  '17',
  '18',
  '19',
  '20',
  '21',
  'natural',
  'bust',
] as const;
