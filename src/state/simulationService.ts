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

  try {
    await api.runSimulation(conditioned, requestId, progressProxy);
  } catch (error) {
    if (requestId === currentRequestId) {
      onError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    // Drop the dispatch target once this generation is no longer current — prevents a stale
    // `onProgress` closure from being retained (and possibly invoked) past its run's lifetime.
    if (currentRequestId === requestId) {
      currentOnProgress = null;
    }
  }
}

/** Drops the main-thread current request id and cancels the worker's in-flight run. */
export async function cancelSimulation(): Promise<void> {
  const requestId = currentRequestId;
  currentRequestId = -1;
  await api.cancel(requestId);
}
