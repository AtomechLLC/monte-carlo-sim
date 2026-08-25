// Type-only imports: equity.ts imports runtime values (CATEGORY_COUNT, categoryCountFor)
// from this module, so a value-level import back into the engine would create a runtime
// cycle. This module exports runtime values INTO the engine and takes only type-only
// imports back (the same cycle-avoidance discipline as ./blackjackProtocol).
import type { ConditionedState } from '../engine/equity';
import type { DeckCount } from '../engine/shoe';

/**
 * `HandStrength` has TEN values (HighCard=0 .. StraightFlush=8, RoyalFlush=9).
 * Royal Flush is its own enum value, NOT folded into Straight Flush — the odds
 * table must have 10 rows, not 9.
 */
export const CATEGORY_COUNT = 10;

/**
 * The extended index Five of a Kind occupies at deckCount 2 (D-05) — DERIVED from
 * `CATEGORY_COUNT`, never a second hand-written literal, so the two can never drift
 * (the `BUCKET_INDEX` derivation discipline of ./blackjackProtocol). The index-10 row
 * exists ONLY where `deckCount === 2` flows; every 1-deck histogram stays 10 long.
 */
export const FIVE_OF_A_KIND_INDEX = CATEGORY_COUNT;

/**
 * Histogram length for a given shoe: 10 at one deck, 11 at two (the Five of a Kind row).
 *
 * Widening `CATEGORY_COUNT` itself to 11 is explicitly FORBIDDEN (07-RESEARCH
 * Anti-Patterns): it would silently change 1-deck snapshot length and break both parity
 * goldens, the odds-store dev consistency guard, and the `CATEGORY_LABELS` exhaustiveness
 * convention. The extended length exists only through this function, at 2-deck call sites.
 */
export function categoryCountFor(deckCount: DeckCount): number {
  return deckCount === 2 ? CATEGORY_COUNT + 1 : CATEGORY_COUNT;
}

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
  /**
   * Indexed by `HandStrength` enum value, extended by `FIVE_OF_A_KIND_INDEX` (10) at two
   * decks: length `CATEGORY_COUNT` for 1-deck runs, `CATEGORY_COUNT + 1` for 2-deck runs
   * (07-03 grow-on-merge). Consumers must iterate by ARRAY LENGTH, never `0..CATEGORY_COUNT-1`.
   */
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
