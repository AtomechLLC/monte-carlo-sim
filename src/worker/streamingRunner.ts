import type { Card } from '@poker-apprentice/types';
import { createRng, createDrawer } from '../engine/rng';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_PROGRESS_INTERVAL_MS,
  DEFAULT_MAX_TRIALS,
  type SimulationOptions,
} from './protocol';

/** The generic streaming Monte Carlo contract, parameterised over one game's payload shapes. */
export interface StreamingApi<TConditioned, TSnapshot> {
  /** Cancels the run identified by `requestId`, if it is the currently in-flight run. */
  cancel(requestId: number): void;
  /** Runs a streaming Monte Carlo simulation, invoking `onProgress` with throttled snapshots. */
  runSimulation(
    conditioned: TConditioned,
    requestId: number,
    onProgress: (snapshot: TSnapshot) => void | Promise<void>,
  ): Promise<void>;
}

/**
 * The game-specific hooks `createStreamingRunner` needs to drive the generic run-token
 * supersession / chunked-batch / throttled-emission loop (D-06). `TConditioned` is a
 * game's per-run known/unknown card partition, `TBatch` is that game's accumulator shape
 * (used both as one batch's result AND as the running totals), and `TSnapshot` is the
 * shape streamed back to the caller.
 */
export interface StreamingRunnerConfig<TConditioned, TBatch, TSnapshot> {
  /** Entry-point validation. Throws to reject the request before any work starts. Optional. */
  validate?: (conditioned: TConditioned) => void;
  /** The finite pool every trial samples from, WITHOUT replacement (DECK-03). */
  getRemainingDeck: (conditioned: TConditioned) => readonly Card[];
  /** How many unknown cards each trial must draw. */
  unknownCardsPerTrial: (conditioned: TConditioned) => number;
  /** Fresh zeroed accumulator for one run. */
  makeEmptyTotals: () => TBatch;
  /** One batch of `trialCount` trials. */
  runBatch: (conditioned: TConditioned, trialCount: number, drawUnknown: () => Card[]) => TBatch;
  /** Folds `batch` into `totals` in place. */
  mergeBatch: (totals: TBatch, batch: TBatch) => void;
  /** Builds the emitted snapshot. MUST return defensive copies of any mutable field. */
  toSnapshot: (
    totals: TBatch,
    meta: { requestId: number; trialsCompleted: number; done: boolean },
  ) => TSnapshot;
  options?: SimulationOptions;
}

/**
 * Generic streaming Monte Carlo runner (D-06), extracted from `simulationApi.ts` so any
 * future game's trial loop (Phase 6's Blackjack and beyond) rides the same proven
 * run-token supersession, chunked batching, throttled emission, cancellation and done
 * semantics — rather than a second, divergent copy. That logic is subtle enough that
 * WR-01 was a real shipped bug (supersession decided by requestId equality instead of
 * object identity), and a copy-paste sibling would not inherit the fix.
 *
 * D-06: `DEFAULT_BATCH_SIZE`/`DEFAULT_PROGRESS_INTERVAL_MS`/`DEFAULT_MAX_TRIALS` and
 * `SimulationOptions` still live in the Hold'em-named `./protocol` module. These knobs
 * are game-neutral, but relocating them this phase would churn the Hold'em config's
 * import surface and put the byte-frozen-test gate at risk for no benefit — Comlink/
 * protocol namespacing into `{ poker, blackjack }` is deferred to Phase 5.
 */
export function createStreamingRunner<TConditioned, TBatch, TSnapshot>(
  config: StreamingRunnerConfig<TConditioned, TBatch, TSnapshot>,
): StreamingApi<TConditioned, TSnapshot> {
  const batchSize = config.options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const progressIntervalMs = config.options?.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS;
  const maxTrials = config.options?.maxTrials ?? DEFAULT_MAX_TRIALS;

  let currentRequestId = -1;
  // Per-invocation identity token. Supersession is decided by OBJECT IDENTITY, not by
  // requestId equality (WR-01) — a caller that re-enters `runSimulation` with the SAME
  // requestId still gets a fresh token here, so the stale loop's `runToken === currentRunToken`
  // check correctly fails and it stops emitting, even though `requestId` didn't change.
  let currentRunToken: object | null = null;

  return {
    cancel(requestId: number): void {
      if (requestId === currentRequestId) {
        currentRequestId = -1;
        currentRunToken = null;
      }
    },

    async runSimulation(
      conditioned: TConditioned,
      requestId: number,
      onProgress: (snapshot: TSnapshot) => void | Promise<void>,
    ): Promise<void> {
      // Entry-point validation, defence in depth. Called BEFORE currentRequestId/
      // currentRunToken are assigned, so a rejected request never supersedes a healthy
      // in-flight run.
      config.validate?.(conditioned);

      currentRequestId = requestId;
      const runToken = {};
      currentRunToken = runToken;

      const rng = createRng(config.options?.seed);
      const drawUnknown = createDrawer(
        rng,
        config.getRemainingDeck(conditioned),
        config.unknownCardsPerTrial(conditioned),
      );

      const totals = config.makeEmptyTotals();
      let trialsCompleted = 0;
      let lastEmitAt: number | null = null;

      while (runToken === currentRunToken) {
        const trialsThisBatch = Math.min(batchSize, maxTrials - trialsCompleted);
        const batch = config.runBatch(conditioned, trialsThisBatch, drawUnknown);

        trialsCompleted += trialsThisBatch;
        config.mergeBatch(totals, batch);

        // Supersession/cancellation check — bail without emitting a stale snapshot.
        if (runToken !== currentRunToken) {
          return;
        }

        const done = trialsCompleted >= maxTrials;
        const now = Date.now();
        const shouldEmit = lastEmitAt === null || done || now - lastEmitAt >= progressIntervalMs;

        if (shouldEmit) {
          lastEmitAt = now;
          await onProgress(config.toSnapshot(totals, { requestId, trialsCompleted, done }));
        }

        if (done) {
          return;
        }

        // Yield so pending cancel()/newer runSimulation() calls can be processed.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  };
}
