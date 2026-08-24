// Type-only import: equity.ts imports the runtime value CATEGORY_COUNT from this module, so a
// value-level import back here would create a runtime cycle.
import type { ConditionedState } from '../engine/equity';

/**
 * `HandStrength` has TEN values (HighCard=0 .. StraightFlush=8, RoyalFlush=9).
 * Royal Flush is its own enum value, NOT folded into Straight Flush — the odds
 * table must have 10 rows, not 9.
 */
export const CATEGORY_COUNT = 10;

/** Trials executed per batch inside the worker before checking for cancellation/emission. */
export const DEFAULT_BATCH_SIZE = 4000;

/** Minimum time between emitted progress snapshots, in milliseconds. */
export const DEFAULT_PROGRESS_INTERVAL_MS = 100;

/** Simulation auto-stops after this many trials. */
export const DEFAULT_MAX_TRIALS = 200000;

/** A partial-result snapshot streamed from the worker to the main thread. */
export interface ProgressSnapshot {
  /** The generation this snapshot belongs to — must match the caller's in-flight requestId. */
  requestId: number;
  /** Length `CATEGORY_COUNT`, indexed by `HandStrength` enum value. */
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
  done: boolean;
}

/** Tuning knobs for a simulation run, all optional with defaults from this module. */
export interface SimulationOptions {
  batchSize?: number;
  progressIntervalMs?: number;
  maxTrials?: number;
  /** Seed for the deterministic RNG; omit for fresh randomness. */
  seed?: number;
}

/** The Comlink-exposed (or directly callable, in tests) simulation contract. */
export interface SimulationApi {
  /** Cancels the run identified by `requestId`, if it is the currently in-flight run. */
  cancel(requestId: number): void;
  /** Runs a streaming Monte Carlo simulation, invoking `onProgress` with throttled snapshots. */
  runSimulation(
    conditioned: ConditionedState,
    requestId: number,
    onProgress: (snapshot: ProgressSnapshot) => void | Promise<void>,
  ): Promise<void>;
}
