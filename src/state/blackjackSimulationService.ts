import * as Comlink from 'comlink';
import type { BlackjackConditionedState } from '../engine/blackjackEquity';
import type { BlackjackProgressSnapshot } from '../worker/blackjackProtocol';
import { getApi, onWorkerFailure } from './workerClient';

// The blackjack mirror of ./simulationService, over the SAME lazily-constructed worker
// singleton (D-08) but with its OWN generation counters, its OWN module-lifetime progress
// proxy and its OWN crash registration — separate counters make a cross-game snapshot
// misroute structurally impossible (T-06-15), not merely unlikely.

let currentRequestId = 0;
let lastRequestId = 0;
let currentOnProgress: ((snapshot: BlackjackProgressSnapshot) => void) | null = null;
let currentOnError: ((message: string) => void) | null = null;

/**
 * Reports a hard worker failure exactly once for THIS service's generation: captures the
 * current `onError`, then nulls both callbacks and invalidates `currentRequestId` BEFORE
 * invoking it — so a second `error`/`messageerror` event (or a late Comlink rejection for
 * the dead generation) finds nothing to report to. The workerClient registry only fans the
 * crash out to both services; this exactly-once discipline lives here, per service.
 */
function reportWorkerFailure(message: string): void {
  const failedOnError = currentOnError;
  currentOnProgress = null;
  currentOnError = null;
  currentRequestId = -1;
  failedOnError?.(message);
}

onWorkerFailure(reportWorkerFailure);

// ONE module-lifetime Comlink proxy, never a per-call create+release cycle — see the long
// DEVIATION comment in ./simulationService.ts for why: `[releaseProxy]` only exists on
// `wrap()` remotes, never on the local `proxy()`-marked callback, and a per-call proxy would
// leak a `MessageChannel`/port per start call (T-02-04). Routing to the correct caller is
// done via this service's own requestId filter.
const progressProxy = Comlink.proxy((snapshot: BlackjackProgressSnapshot) => {
  if (snapshot.requestId !== currentRequestId) return;
  currentOnProgress?.(snapshot);
});

/**
 * Main-thread owner of the blackjack generation over the shared worker singleton. Cancels
 * the previous generation, allocates a fresh service-owned requestId, starts a fresh
 * streaming run over `api.blackjack.*`, and filters out superseded snapshots before they
 * reach `onProgress` — defence in depth, since the worker already stops itself on
 * supersession.
 */
export async function startBlackjackSimulation(
  conditioned: BlackjackConditionedState,
  onProgress: (snapshot: BlackjackProgressSnapshot) => void,
  onError: (message: string) => void,
): Promise<void> {
  await cancelBlackjackSimulation();

  const requestId = ++lastRequestId;
  currentRequestId = requestId;
  currentOnProgress = onProgress;
  currentOnError = onError;

  try {
    // getApi() is called inside the function body (never cached into a module-scope const at
    // import time) so the Worker is constructed on the first CALL, keeping the transport
    // side-effect-free on import (T-06-49).
    await getApi().blackjack.runSimulation(conditioned, requestId, progressProxy);
  } catch (error) {
    if (requestId === currentRequestId) {
      onError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    // Drop the dispatch targets once this generation is no longer current — prevents a stale
    // `onProgress`/`onError` closure from being retained (and possibly invoked) past its
    // run's lifetime.
    if (currentRequestId === requestId) {
      currentOnProgress = null;
      currentOnError = null;
    }
  }
}

/** Drops the main-thread current request id and cancels the worker's in-flight blackjack run. */
export async function cancelBlackjackSimulation(): Promise<void> {
  const requestId = currentRequestId;
  currentRequestId = -1;
  await getApi().blackjack.cancel(requestId);
}
