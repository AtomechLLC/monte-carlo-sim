import * as Comlink from 'comlink';
import { createSimulationApi } from './simulationApi';

Comlink.expose(createSimulationApi());

/** Type-only export for `Comlink.wrap<SimulationApi>` typing on the main thread. */
export type { SimulationApi } from './protocol';
