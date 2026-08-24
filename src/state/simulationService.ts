import * as Comlink from 'comlink';
import type { Card } from '@poker-apprentice/types';
import type { ProgressSnapshot } from '../worker/protocol';
import type { SimulationApi } from '../worker/simulation.worker';
import SimWorker from '../worker/simulation.worker?worker';

// Module scope, not inside a component effect: React 19 StrictMode double-invokes effects
// in development, and instantiating the worker there would leak a second worker thread.
const worker = new SimWorker();
const api = Comlink.wrap<SimulationApi>(worker);

let currentRequestId = 0;

/**
 * Main-thread owner of the Comlink-wrapped worker singleton. Cancels the previous generation,
 * starts a fresh streaming run, and filters out any snapshot whose requestId has been
 * superseded before it reaches `onProgress` — defence in depth, since the worker already
 * stops itself on supersession.
 */
export async function startSimulation(
  heroHole: [Card, Card],
  remainingDeck: Card[],
  requestId: number,
  onProgress: (snapshot: ProgressSnapshot) => void,
): Promise<void> {
  currentRequestId = requestId;

  await api.cancel(requestId - 1);
  await api.runSimulation(
    heroHole,
    remainingDeck,
    requestId,
    Comlink.proxy((snapshot: ProgressSnapshot) => {
      if (snapshot.requestId !== currentRequestId) return;
      onProgress(snapshot);
    }),
  );
}
