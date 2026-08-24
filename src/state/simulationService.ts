import * as Comlink from 'comlink';
import type { ConditionedState } from '../engine/equity';
import type { ProgressSnapshot } from '../worker/protocol';
import { getApi, onWorkerFailure } from './workerClient';

// The Worker/Comlink singleton lives in ./workerClient (lazily constructed on first use,
// shared with blackjackSimulationService — D-08). This module owns ONLY the poker
// generation state and its start/cancel pair; its exported surface is deliberately
// unchanged (exactly these two functions) because seven test files mock this module with
// a two-export factory.

let currentRequestId = 0;
let lastRequestId = 0;
let currentOnProgress: ((snapshot: ProgressSnapshot) => void) | null = null;
let currentOnError: ((message: string) => void) | null = null;

/**
 * Reports a hard worker failure exactly once: captures the current `onError` callback, then
 * invalidates the module's notion of "current run" (nulling both callbacks and marking
 * `currentRequestId` as no generation) BEFORE invoking the callback. Nulling first is what
 * guarantees exactly-once delivery — a second `error`/`messageerror` event (or a late
 * Comlink rejection for the now-dead generation) finds `currentOnError` already null / the
 * requestId already invalidated, so it cannot double-report or resurrect a dead generation.
 * The workerClient registry only fans the crash out — this discipline lives here.
 */
function reportWorkerFailure(message: string): void {
  const failedOnError = currentOnError;
  currentOnProgress = null;
  currentOnError = null;
  currentRequestId = -1;
  failedOnError?.(message);
}

onWorkerFailure(reportWorkerFailure);

// DEVIATION from the plan's documented "per-call `Comlink.proxy()` + `finally { proxy
// [Comlink.releaseProxy]() }`" guidance (Rule 1 — the documented call does not exist on the
// object it names). `Comlink.proxy(callback)` marks `callback` for cross-boundary use and
// returns the SAME local callback (`T & ProxyMarked`) — verified directly against comlink's
// shipped source (`dist/esm/comlink.mjs`: `function proxy(obj) { return Object.assign(obj,
// { [proxyMarker]: true }); }`) and its README ("Every proxy created by Comlink [via `wrap()`]
// has the `[releaseProxy]()` method"). `[releaseProxy]` only exists on a `Remote<T>` obtained
// from `Comlink.wrap()` — never on the local, `proxy()`-marked object the CALLER holds. Calling
// it on the caller's own reference does not type-check (confirmed via `tsc`, TS2554/TS7053) and
// would throw at runtime if forced through a cast.
//
// Root-cause fix instead of a per-call create+release cycle: create exactly ONE Comlink proxy
// for the whole module's lifetime (mirroring the worker/api singleton in ./workerClient), so no
// new `MessageChannel`/port is ever created per `startSimulation()` call — the actual leak
// surface (T-02-04, IN-08) this behaviour was meant to close. Routing to the correct caller is
// done via the existing requestId filter, exactly as before.
const progressProxy = Comlink.proxy((snapshot: ProgressSnapshot) => {
  if (snapshot.requestId !== currentRequestId) return;
  currentOnProgress?.(snapshot);
});

/**
 * Main-thread owner of the poker generation over the shared worker singleton. Cancels the
 * previous generation, allocates a fresh service-owned requestId, starts a fresh streaming
 * run, and filters out any snapshot whose requestId has been superseded before it reaches
 * `onProgress` — defence in depth, since the worker already stops itself on supersession.
 *
 * `requestId` is deliberately allocated here (not passed in) so that every street/reveal/deal
 * trigger (D-13) gets a distinct generation, while `gameStore.dealNonce` stays the single
 * hand-identity counter — no second counter is added to any store.
 */
export async function startSimulation(
  conditioned: ConditionedState,
  onProgress: (snapshot: ProgressSnapshot) => void,
  onError: (message: string) => void,
): Promise<void> {
  await cancelSimulation();

  const requestId = ++lastRequestId;
  currentRequestId = requestId;
  currentOnProgress = onProgress;
  currentOnError = onError;

  try {
    // getApi() is called inside the function body (never cached into a module-scope const at
    // import time) so the Worker is constructed on the first CALL, keeping the transport
    // side-effect-free on import (T-06-49).
    await getApi().poker.runSimulation(conditioned, requestId, progressProxy);
  } catch (error) {
    if (requestId === currentRequestId) {
      onError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    // Drop the dispatch targets once this generation is no longer current — prevents a stale
    // `onProgress`/`onError` closure from being retained (and possibly invoked) past its run's
    // lifetime.
    if (currentRequestId === requestId) {
      currentOnProgress = null;
      currentOnError = null;
    }
  }
}

/** Drops the main-thread current request id and cancels the worker's in-flight run. */
export async function cancelSimulation(): Promise<void> {
  const requestId = currentRequestId;
  currentRequestId = -1;
  await getApi().poker.cancel(requestId);
}
