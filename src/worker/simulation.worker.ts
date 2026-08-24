import * as Comlink from 'comlink';
import { createSimulationApi } from './simulationApi';
import { createBlackjackSimulationApi } from './blackjackSimulationApi';
import type { SimulationApi } from './protocol';
import type { BlackjackSimulationApi } from './blackjackProtocol';

// Namespaced surface (D-08, 06-RESEARCH Pattern 4): Comlink's proxy `get` trap accumulates a
// path array and resolves it on invoke, so nested namespaces need zero special-casing —
// verified directly against the installed package source (comlink.mjs `createProxy`).
Comlink.expose({ poker: createSimulationApi(), blackjack: createBlackjackSimulationApi() });

/**
 * Type-only export for `Comlink.wrap<WorkerApi>` typing on the main thread.
 *
 * The `& Comlink.ProxyMarked` intersections are TYPE-LEVEL only (no runtime marker exists
 * on the exposed object, and none is needed — path accumulation handles traversal, Pattern
 * 4 above). They tell Comlink's `Remote<T>` mapping that these namespaces are traversed via
 * the proxy path rather than structured-cloned as data: without them,
 * `Remote<WorkerApi>['poker']` degrades to `Promise<SimulationApi>` and the nested
 * `api.poker.runSimulation(...)` call sites fail to type-check (TS2339) even though they
 * work at runtime.
 */
export interface WorkerApi {
  poker: SimulationApi & Comlink.ProxyMarked;
  blackjack: BlackjackSimulationApi & Comlink.ProxyMarked;
}
