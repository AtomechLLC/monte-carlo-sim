// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSimulationApi } from './simulationApi';
import { FULL_DECK, deckWithout } from '../engine/cards';
import type { ProgressSnapshot } from './protocol';
import type { ConditionedState } from '../engine/equity';
import { deriveConditionedState } from '../engine/conditioning';
import type { PredeterminedRunout } from '../engine/conditioning';

/**
 * GOLDEN (D-08 / D-07): these are literal values transcribed from a real run of the
 * pre-extraction, currently-shipped `createSimulationApi` streaming pipeline. The
 * streamingRunner extraction (plan 04-05) must reproduce these exact numbers at
 * `deckCount=1` — chunking, throttled emission, and done semantics included, not just the
 * final tallies.
 *
 * A failure here means the extraction changed observable behaviour. The correct response is
 * to fix the extraction so it reproduces these numbers again, NEVER to re-record the expected
 * literals — that would silently erase the only proof that D-07's "unchanged at deckCount=1"
 * gate holds.
 */

// Same construction as simulationApi.test.ts (not imported — that file is a frozen contract
// under D-07 and must stay byte-unchanged for the rest of the phase).
const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [FULL_DECK[0], FULL_DECK[1]];
const remainingDeck = deckWithout(heroHole);

const preflopState: ConditionedState = {
  heroHole,
  knownBoard: [],
  knownOpponentHoles: [null, null, null],
  remainingDeck,
};

// Fixed fixture for the flop-conditioned case — 13 disjoint slices of FULL_DECK, mirroring
// simulationApi.test.ts's `runout` fixture.
const runout: PredeterminedRunout = {
  heroHole: [FULL_DECK[0], FULL_DECK[1]],
  board: [FULL_DECK[2], FULL_DECK[3], FULL_DECK[4], FULL_DECK[5], FULL_DECK[6]],
  opponentHoles: [
    [FULL_DECK[7], FULL_DECK[8]],
    [FULL_DECK[9], FULL_DECK[10]],
    [FULL_DECK[11], FULL_DECK[12]],
  ],
};

describe('D-08/D-07 golden parity — worker layer (createSimulationApi streaming pipeline)', () => {
  it('GOLDEN: preflop final-snapshot tallies match the pre-extraction literals', async () => {
    const api = createSimulationApi({
      seed: 20260824,
      maxTrials: 20000,
      batchSize: 5000,
      progressIntervalMs: 0,
    });
    const snapshots: ProgressSnapshot[] = [];

    await api.runSimulation(preflopState, 1, (s) => {
      snapshots.push(s);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.categoryCounts).toEqual([0, 7230, 7949, 2252, 247, 383, 1775, 162, 2, 0]);
    expect(last.outcomes).toEqual({ win: 4369, tie: 170, lose: 15461 });
    expect(last.trialsCompleted).toBe(20000);
    expect(last.done).toBe(true);
    expect(last.requestId).toBe(1);
  });

  it('GOLDEN: preflop emission-shape (snapshot count + trialsCompleted sequence) matches the pre-extraction literals', async () => {
    const api = createSimulationApi({
      seed: 20260824,
      maxTrials: 20000,
      batchSize: 5000,
      progressIntervalMs: 0,
    });
    const snapshots: ProgressSnapshot[] = [];

    await api.runSimulation(preflopState, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBe(4);
    expect(snapshots.map((s) => s.trialsCompleted)).toEqual([5000, 10000, 15000, 20000]);
  });

  it('GOLDEN: flop final-snapshot tallies match the pre-extraction literals', async () => {
    const api = createSimulationApi({
      seed: 20260824,
      maxTrials: 20000,
      batchSize: 5000,
      progressIntervalMs: 0,
    });
    const flopState = deriveConditionedState(runout, 'flop', 0);
    const snapshots: ProgressSnapshot[] = [];

    await api.runSimulation(flopState, 1, (s) => {
      snapshots.push(s);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.categoryCounts).toEqual([0, 0, 0, 0, 0, 0, 0, 20000, 0, 0]);
    expect(last.outcomes).toEqual({ win: 19983, tie: 0, lose: 17 });
    expect(last.trialsCompleted).toBe(20000);
    expect(last.done).toBe(true);
  });
});
