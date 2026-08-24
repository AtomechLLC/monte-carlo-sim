import * as Comlink from 'comlink';
import type { WorkerApi } from '../worker/simulation.worker';
import SimWorker from '../worker/simulation.worker?worker';

// The ONE Worker + Comlink proxy serving both games' namespaced APIs (D-08).
//
// LAZY, cached construction (T-06-49) — the Worker is built on the FIRST getApi()/getWorker()
// call, NEVER at module scope. Importing this module (or either service that re-exports its
// behavior) is side-effect-free. Why that matters: at wave 4,
// App -> BlackjackGame -> blackjackSimulationService -> workerClient becomes a SECOND import
// path into this singleton, and the five frozen v1 jsdom suites (App.test.tsx,
// App.acceptance.test.tsx, App.phase3.acceptance.test.tsx, App.modeErrorBanner.test.tsx,
// App.modeSwitchRace.test.tsx) mock ONLY './state/simulationService' — a module-scope
// `new SimWorker()` here would instantiate a real Worker at import time in jsdom and crash
// all five, suites D-08 forbids editing.
//
// Module-scope CACHE, not construction inside a component effect: React 19 StrictMode
// double-invokes effects in development, and instantiating the worker there would leak a
// second worker thread. The cache slot below is checked and populated SYNCHRONOUSLY (no
// `await` between the check and the assignment), so two first-calls in the same tick —
// StrictMode's double-invocation shape — still construct exactly one Worker.

const WORKER_CRASH_MESSAGE = 'The simulation worker stopped unexpectedly';
const WORKER_MESSAGE_ERROR = 'The simulation worker sent a message that could not be read';

type FailureHandler = (message: string) => void;

// Hard-crash listener registry. Each SERVICE keeps its own exactly-once discipline (null its
// callbacks and invalidate its generation BEFORE invoking the captured onError) — this
// registry only fans a crash out to every registered service, it does not own that guarantee.
const failureHandlers: FailureHandler[] = [];

/** Registers a hard-worker-failure handler. Called once per service at module scope. */
export function onWorkerFailure(handler: FailureHandler): void {
  failureHandlers.push(handler);
}

function reportWorkerFailure(message: string): void {
  for (const handler of failureHandlers) {
    handler(message);
  }
}

interface WorkerHandle {
  worker: Worker;
  api: Comlink.Remote<WorkerApi>;
}

let handle: WorkerHandle | null = null;

/**
 * Hard-failure recovery (06-REVIEW WR-02): a hard worker death (script-load failure,
 * wedged event loop) leaves the cached proxy permanently dead — every later
 * `runSimulation` posts into a void and its promise never settles (no rejection, no
 * snapshots, no `finally`), making the error banners' "deal / re-deal to try again"
 * recovery copy unfulfillable without a full page reload. Invalidating the cache here
 * means the NEXT `getApi()`/`getWorker()` call constructs a FRESH worker (the crash
 * listeners re-attach inside `ensureWorker` automatically); each service's generation
 * invalidation already prevents a stale callback from resurrecting across the restart.
 *
 * Guarded by worker identity: only the CURRENT handle's worker may invalidate the cache
 * — a late zombie event from an already-replaced worker must never tear down its healthy
 * replacement. The failure fan-out stays unconditional either way (exactly-once-per-
 * service is owned by the services themselves, not this registry).
 */
function onHardFailure(worker: Worker, message: string): void {
  if (handle?.worker === worker) {
    handle = null; // next getApi()/getWorker() builds a fresh worker
  }
  worker.terminate(); // release the dead thread; harmless if already dead/terminated
  reportWorkerFailure(message);
}

function ensureWorker(): WorkerHandle {
  if (handle !== null) {
    return handle;
  }

  const worker = new SimWorker();

  // WR-02 fix (02-REVIEW.md), attached at construction: call rejections are surfaced
  // via each service's `catch` block, but a HARD worker death (script-load failure, or an
  // undeserializable `postMessage` payload) never rejects the in-flight Comlink call at all —
  // it fires the Worker's own `error`/`messageerror` event instead. These two listeners route
  // a hard crash through `onHardFailure` above: cache invalidation (06-REVIEW WR-02) plus the
  // same `onError` fan-out path a call rejection already uses. A crash can only be observed
  // after a run has started, which is the only time either service has an `onError` to route
  // it to.
  worker.addEventListener('error', (event) => {
    // Suppress the browser's default "Uncaught error in worker" console spew — the visible
    // banner (driven by each service's `onError`) is the signal, not the console.
    event.preventDefault();
    onHardFailure(
      worker,
      event.message ? `${WORKER_CRASH_MESSAGE}: ${event.message}` : WORKER_CRASH_MESSAGE,
    );
  });
  worker.addEventListener('messageerror', () => onHardFailure(worker, WORKER_MESSAGE_ERROR));

  handle = { worker, api: Comlink.wrap<WorkerApi>(worker) };
  return handle;
}

/**
 * The lazily-constructed, cached Comlink proxy over the namespaced { poker, blackjack }
 * worker surface. Constructs the Worker on the first call; every later call (from either
 * service) returns the same cached proxy.
 */
export function getApi(): Comlink.Remote<WorkerApi> {
  return ensureWorker().api;
}

/** The same cached Worker instance `getApi()` wraps, constructed on first use. */
export function getWorker(): Worker {
  return ensureWorker().worker;
}
