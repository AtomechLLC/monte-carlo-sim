// Type-only imports: blackjackEquity.ts imports the runtime values BUCKET_INDEX and
// DEALER_BUCKET_COUNT from this module, so a value-level import back into the engine
// would create a runtime cycle (the same cycle-avoidance discipline as ./protocol).
import type { DealerBucket } from '../engine/blackjackHandValue';
import type { BlackjackConditionedState, BlackjackOutcomeCounts } from '../engine/blackjackEquity';

/**
 * The FIXED display/tally order of the dealer's 7 outcome buckets (BJ-03, D-06). Every
 * `dealerOutcomeCounts` array in the blackjack path is indexed by this order — the UI's
 * bucket labels, the trial loop's tallies and the snapshot wire format all share it, so
 * it must never be reordered.
 *
 * `DEFAULT_BATCH_SIZE`/`DEFAULT_PROGRESS_INTERVAL_MS`/`DEFAULT_MAX_TRIALS` and
 * `SimulationOptions` deliberately stay in `./protocol` and get imported from there —
 * relocating them would churn the byte-frozen golden gate for no benefit
 * (`streamingRunner.ts` lines 58-62).
 */
export const DEALER_BUCKET_ORDER = ['17', '18', '19', '20', '21', 'natural', 'bust'] as const satisfies readonly DealerBucket[];

/** Length of `DEALER_BUCKET_ORDER` (7) — the size of every `dealerOutcomeCounts` array. */
export const DEALER_BUCKET_COUNT = DEALER_BUCKET_ORDER.length;

/**
 * Bucket-to-index lookup derived from `DEALER_BUCKET_ORDER` (never a second hand-written
 * list, so the two can never drift). The cast is safe: the tuple `satisfies` check above
 * proves its entries are exactly the `DealerBucket` union.
 */
export const BUCKET_INDEX = Object.fromEntries(
  DEALER_BUCKET_ORDER.map((bucket, index) => [bucket, index]),
) as Record<DealerBucket, number>;

/** A partial-result snapshot streamed from the worker to the main thread (blackjack path). */
export interface BlackjackProgressSnapshot {
  /** The generation this snapshot belongs to — must match the caller's in-flight requestId. */
  requestId: number;
  /** Length `DEALER_BUCKET_COUNT`, indexed by `DEALER_BUCKET_ORDER`. */
  dealerOutcomeCounts: number[];
  /** Trials whose hypothetical hit card busted the player — its OWN tally, never derived. */
  bustIfHitCount: number;
  standOutcomes: BlackjackOutcomeCounts;
  hitOutcomes: BlackjackOutcomeCounts;
  trialsCompleted: number;
  done: boolean;
}

/** The Comlink-exposed (or directly callable, in tests) blackjack simulation contract. */
export interface BlackjackSimulationApi {
  /** Cancels the run identified by `requestId`, if it is the currently in-flight run. */
  cancel(requestId: number): void;
  /** Runs a streaming Monte Carlo simulation, invoking `onProgress` with throttled snapshots. */
  runSimulation(
    conditioned: BlackjackConditionedState,
    requestId: number,
    onProgress: (snapshot: BlackjackProgressSnapshot) => void | Promise<void>,
  ): Promise<void>;
}
