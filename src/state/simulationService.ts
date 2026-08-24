import * as Comlink from 'comlink';
import type { ConditionedState } from '../engine/equity';
import type { ProgressSnapshot } from '../worker/protocol';
import type { SimulationApi } from '../worker/simulation.worker';
import SimWorker from '../worker/simulation.worker?worker';

// Module scope, not inside a component effect: React 19 StrictMode double-invokes effects
// in development, and instantiating the worker there would leak a second worker thread.
const worker = new SimWorker();
const api = Comlink.wrap<SimulationApi>(worker);

let currentRequestId = 0;
let lastRequestId = 0;
let currentOnProgress: ((snapshot: ProgressSnapshot) => void) | null = null;
let currentOnError: ((message: string) => void) | null = null;

// WR-02 fix (02-REVIEW.md): call rejections were already surfaced via the `catch` block in
// `startSimulation` below, but a HARD worker death (script-load failure, or an
// undeserializable `postMessage` payload) never rejects that in-flight Comlink call at all —
// it fires the Worker's own `error`/`messageerror` event instead, which nothing here
// subscribed to. That used to leave every pending Comlink promise hanging forever with the
// odds panel silently frozen and no banner. These two listeners route a hard crash through
// the exact same `onError` path a call rejection already uses.
const WORKER_CRASH_MESSAGE = 'The simulation worker stopped unexpectedly';
const WORKER_MESSAGE_ERROR = 'The simulation worker sent a message that could not be read';

/**
 * Reports a hard worker failure exactly once: captures the current `onError` callback, then
 * invalidates the module's notion of "current run" (nulling both callbacks and marking
 * `currentRequestId` as no generation) BEFORE invoking the callback. Nulling first is what
 * guarantees exactly-once delivery — a second `error`/`messageerror` event (or a late
 * Comlink rejection for the now-dead generation) finds `currentOnError` already null / the
 * requestId already invalidated, so it cannot double-report or resurrect a dead generation.
 */
function reportWorkerFailure(message: string): void {
  const failedOnError = currentOnError;
  currentOnProgress = null;
  currentOnError = null;
  currentRequestId = -1;
  failedOnError?.(message);
}

worker.addEventListener('error', (event) => {
  // Suppress the browser's default "Uncaught error in worker" console spew — the visible
  // banner (driven by `onError` above) is now the signal, not the console.
  event.preventDefault();
  reportWorkerFailure(event.message ? `${WORKER_CRASH_MESSAGE}: ${event.message}` : WORKER_CRASH_MESSAGE);
});

worker.addEventListener('messageerror', () => reportWorkerFailure(WORKER_MESSAGE_ERROR));

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
// for the whole module's lifetime (mirroring the `api`/`worker` singleton above), so no new
// `MessageChannel`/port is ever created per `startSimulation()` call — the actual leak surface
// (T-02-04, IN-08) this behaviour was meant to close. Routing to the correct caller is done via
// the existing requestId filter, exactly as before.
const progressProxy = Comlink.proxy((snapshot: ProgressSnapshot) => {
  if (snapshot.requestId !== currentRequestId) return;
  currentOnProgress?.(snapshot);
});

/**
 * Main-thread owner of the Comlink-wrapped worker singleton. Cancels the previous generation,
 * allocates a fresh service-owned requestId, starts a fresh streaming run, and filters out any
 * snapshot whose requestId has been superseded before it reaches `onProgress` — defence in
 * depth, since the worker already stops itself on supersession.
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
    await api.runSimulation(conditioned, requestId, progressProxy);
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
  await api.cancel(requestId);
}
