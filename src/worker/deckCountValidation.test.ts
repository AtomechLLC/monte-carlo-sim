// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createSimulationApi } from './simulationApi';
import { createBlackjackSimulationApi } from './blackjackSimulationApi';
import { FULL_DECK, deckWithout } from '../engine/cards';
import { shoeWithout, type DeckCount } from '../engine/shoe';
import type { ConditionedState } from '../engine/equity';
import type { BlackjackConditionedState } from '../engine/blackjackEquity';
import type { ProgressSnapshot } from './protocol';
import type { BlackjackProgressSnapshot } from './blackjackProtocol';

// WR-02 / D-09: deckCount SHAPE validation at the worker boundary, for BOTH game APIs.
// `DeckCount = 1 | 2` is a compile-time union and provides no protection at a Comlink
// boundary — payloads arrive as deserialized runtime data, so the check must be VALUE-based,
// not type-based. This file is a new sibling of `simulationApi.test.ts` (a frozen contract
// that must not be edited); both game APIs' deckCount rejections are pinned here in one
// place. The absent-means-1 acceptance below is what keeps the byte-frozen golden fixtures
// (which omit `deckCount`) valid.
//
// AMENDED 2026-08-24 (Phase 7 plan 07-03, D-12): the WR-03 validation-boundary proxy test
// ("accepts an explicit deckCount of 2 at the validation boundary") was RETARGETED to a
// real end-to-end 2-deck run. The duplicate-aware evaluator (plan 07-01) plus runTrials'
// hoisted evaluator selection and the worker's grow-on-merge histogram (plan 07-03) made
// `deckCount: 2` legal all the way through the trial path, retiring WR-03. Retargeted per
// the standing same-commit amendment rule, never deleted — and the frozen
// `102 cards, got 101` rejection string the proxy used to ride keeps its own plainly-titled
// test directly below the retargeted one.

const heroHole: [(typeof FULL_DECK)[number], (typeof FULL_DECK)[number]] = [
  FULL_DECK[0],
  FULL_DECK[1],
];

/** A valid poker conditioned state; `deckCount` injected by callers (possibly invalid). */
function pokerState(deckCount?: unknown): ConditionedState {
  const state: ConditionedState = {
    heroHole,
    knownBoard: [],
    knownOpponentHoles: [null, null, null],
    remainingDeck: deckWithout(heroHole),
  };
  if (deckCount !== undefined) {
    state.deckCount = deckCount as DeckCount;
  }
  return state;
}

function waitUntil(predicate: () => boolean, timeoutMs = 2000, intervalMs = 5): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('waitUntil: timed out waiting for predicate'));
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

describe('poker API — deckCount shape validation (WR-02, D-09)', () => {
  // Asserting on the EXACT deckCount message also pins placement: if the check ran after
  // `shoeSize(deckCount)` consumed the value, these states would instead trip the
  // remainingDeck-length error (e.g. shoeSize(0) - 2 = -2 !== 50) with a different message.
  it.each([[0], [3], [1.5]])(
    'rejects present-but-invalid deckCount %s with a clear boundary error',
    async (bad) => {
      const api = createSimulationApi();
      await expect(api.runSimulation(pokerState(bad), 1, () => {})).rejects.toThrow(
        `runSimulation: deckCount must be 1 or 2, got ${String(bad)}`,
      );
    },
  );

  it("rejects the string '2' — the shape a Comlink-deserialized payload can carry", async () => {
    const api = createSimulationApi();
    await expect(api.runSimulation(pokerState('2'), 1, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got 2',
    );
  });

  it('an ABSENT deckCount still means 1 deck and does not throw (golden-fixture compatibility)', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(pokerState(), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('accepts an explicit deckCount of 1', async () => {
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(pokerState(1), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('accepts deckCount 2 END-TO-END: a real 2-deck run completes with an 11-length reconciling categoryCounts (D-12, WR-03 retired)', async () => {
    // RETARGETED 2026-08-24 (Phase 7 plan 07-03, D-12): WR-03 (STATE.md Blockers) held the
    // 2-deck TRIAL path closed until Phase 7's duplicate-aware evaluator existed, so this
    // test used to prove deckCount=2 survived validation by riding the NEXT check's
    // rejection (a deliberately short 101-card remainingDeck). That evaluator now ships
    // (evaluatorTwoDeck.ts, plan 07-01) and runTrials hoists it in at deckCount=2 (plan
    // 07-03), so the acceptance is asserted by RUNNING trials to completion — the final
    // snapshot must be done, carry the extended 11-length histogram (index 10 = Five of a
    // Kind, D-05) and reconcile its category sum against trialsCompleted. The rejection
    // string the old proxy rode keeps its own coverage in the next test.
    const api = createSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const twoDeckState: ConditionedState = {
      ...pokerState(2),
      remainingDeck: shoeWithout(2, heroHole),
    };
    expect(twoDeckState.remainingDeck).toHaveLength(102);

    const snapshots: ProgressSnapshot[] = [];
    await api.runSimulation(twoDeckState, 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.categoryCounts).toHaveLength(11);
    expect(last.categoryCounts.reduce((a, b) => a + b, 0)).toBe(last.trialsCompleted);
  });

  it('still rejects a malformed 2-deck remainingDeck length with the exact frozen boundary message', async () => {
    // Preserved from the retired WR-03 proxy test (D-12: retarget, never delete): the
    // malformed-length rejection is a real boundary contract in its own right, and the
    // exact `102 cards, got 101` string must keep its coverage now that the acceptance
    // test above no longer rides it.
    const api = createSimulationApi();
    const shortState: ConditionedState = {
      ...pokerState(2),
      remainingDeck: shoeWithout(2, heroHole).slice(1),
    };
    expect(shortState.remainingDeck).toHaveLength(101);
    await expect(api.runSimulation(shortState, 1, () => {})).rejects.toThrow(
      'runSimulation: remainingDeck must have exactly 102 cards, got 101',
    );
  });

  it('a rejected invalid request never supersedes a healthy in-flight run', async () => {
    // Pins `createStreamingRunner`'s validate-before-assign ordering: `validate` throws
    // BEFORE currentRequestId/currentRunToken are assigned, so a rejected request is
    // harmless — the healthy in-flight run must keep emitting all the way to done.
    const api = createSimulationApi({ maxTrials: 40000, batchSize: 2000, progressIntervalMs: 0 });
    const snapshots: ProgressSnapshot[] = [];
    const run = api.runSimulation(pokerState(), 1, (s) => {
      snapshots.push(s);
    });

    await waitUntil(() => snapshots.length > 0);

    await expect(api.runSimulation(pokerState(0), 2, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got 0',
    );

    await run;
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.trialsCompleted).toBe(40000);
  });
});

describe('blackjack API — deckCount shape validation (WR-02, D-09)', () => {
  const playerHand = [FULL_DECK[0], FULL_DECK[1]];
  const dealerUpcard = FULL_DECK[2];
  const knownCards = [...playerHand, dealerUpcard];

  /**
   * A valid blackjack conditioned state; `deckCount` injected by callers (possibly invalid
   * or, unlike poker, ABSENT — blackjack's field is REQUIRED, so absent must be rejected).
   * The remaining deck is sized for a real shoe so only the deckCount check can trip.
   */
  function blackjackState(deckCount?: unknown): BlackjackConditionedState {
    return {
      playerHand: [...playerHand],
      dealerUpcard,
      remainingDeck: shoeWithout(deckCount === 2 ? 2 : 1, knownCards),
      deckCount: deckCount as DeckCount,
    };
  }

  it.each([[0], [3], [1.5]])(
    'rejects present-but-invalid deckCount %s with a clear boundary error',
    async (bad) => {
      const api = createBlackjackSimulationApi();
      await expect(api.runSimulation(blackjackState(bad), 1, () => {})).rejects.toThrow(
        `runSimulation: deckCount must be 1 or 2, got ${String(bad)}`,
      );
    },
  );

  it("rejects the string '2' — the shape a Comlink-deserialized payload can carry", async () => {
    const api = createBlackjackSimulationApi();
    await expect(api.runSimulation(blackjackState('2'), 1, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got 2',
    );
  });

  it('rejects an ABSENT deckCount — the field is REQUIRED on the blackjack API, unlike poker', async () => {
    const api = createBlackjackSimulationApi();
    await expect(api.runSimulation(blackjackState(), 1, () => {})).rejects.toThrow(
      'runSimulation: deckCount must be 1 or 2, got undefined',
    );
  });

  it('accepts deckCount 1', async () => {
    const api = createBlackjackSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: BlackjackProgressSnapshot[] = [];
    await api.runSimulation(blackjackState(1), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });

  it('accepts deckCount 2', async () => {
    const api = createBlackjackSimulationApi({ maxTrials: 1000, batchSize: 500, progressIntervalMs: 0 });
    const snapshots: BlackjackProgressSnapshot[] = [];
    await api.runSimulation(blackjackState(2), 1, (s) => {
      snapshots.push(s);
    });
    expect(snapshots[snapshots.length - 1].done).toBe(true);
  });
});
