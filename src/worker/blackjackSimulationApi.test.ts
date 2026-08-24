// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Card } from '@poker-apprentice/types';
import { createBlackjackSimulationApi } from './blackjackSimulationApi';
import { FULL_DECK } from '../engine/cards';
import { shoeWithout, type DeckCount } from '../engine/shoe';
import { BLACKJACK_TRIAL_CARD_BUDGET, type BlackjackConditionedState } from '../engine/blackjackEquity';
import { DEALER_BUCKET_COUNT } from './blackjackProtocol';
import type { BlackjackProgressSnapshot } from './blackjackProtocol';

// Mirrors `simulationApi.test.ts`'s structure (that file is a frozen contract — this is its
// blackjack sibling). Fixed FULL_DECK-sliced fixtures; a small maxTrials (8000) and an
// explicit seed (20260824) keep the streaming tests fast and deterministic.

const SEED = 20260824;
const MAX_TRIALS = 8000;

const playerHand: Card[] = [FULL_DECK[0], FULL_DECK[1]];
const dealerUpcard: Card = FULL_DECK[2];
const knownCards: Card[] = [...playerHand, dealerUpcard];

function makeState(deckCount: DeckCount): BlackjackConditionedState {
  return {
    playerHand: [...playerHand],
    dealerUpcard,
    remainingDeck: shoeWithout(deckCount, knownCards),
    deckCount,
  };
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

function outcomeSum(outcomes: { win: number; push: number; lose: number }): number {
  return outcomes.win + outcomes.push + outcomes.lose;
}

describe('createBlackjackSimulationApi — a config on the shared runner, not a fork', () => {
  it('shoeWithout produces a 49-card remaining deck for the 3 known cards at 1 deck (fixture sanity)', () => {
    expect(makeState(1).remainingDeck).toHaveLength(49);
  });

  it('streams at least 2 snapshots with non-decreasing trialsCompleted, ending done at maxTrials', async () => {
    const api = createBlackjackSimulationApi({
      maxTrials: MAX_TRIALS,
      batchSize: 2000,
      progressIntervalMs: 0,
      seed: SEED,
    });
    const snapshots: BlackjackProgressSnapshot[] = [];

    await api.runSimulation(makeState(1), 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].trialsCompleted).toBeGreaterThanOrEqual(snapshots[i - 1].trialsCompleted);
    }
    const last = snapshots[snapshots.length - 1];
    expect(last.done).toBe(true);
    expect(last.trialsCompleted).toBe(MAX_TRIALS);
  });

  it('every snapshot reconciles: dealerOutcomeCounts (length 7) and both outcome objects sum to trialsCompleted', async () => {
    const api = createBlackjackSimulationApi({
      maxTrials: MAX_TRIALS,
      batchSize: 2000,
      progressIntervalMs: 0,
      seed: SEED,
    });
    const snapshots: BlackjackProgressSnapshot[] = [];

    await api.runSimulation(makeState(1), 1, (s) => {
      snapshots.push(s);
    });

    expect(snapshots.length).toBeGreaterThan(0);
    for (const s of snapshots) {
      expect(s.dealerOutcomeCounts).toHaveLength(DEALER_BUCKET_COUNT);
      const bucketSum = s.dealerOutcomeCounts.reduce((a, b) => a + b, 0);
      expect(bucketSum).toBe(s.trialsCompleted);
      expect(outcomeSum(s.standOutcomes)).toBe(s.trialsCompleted);
      expect(outcomeSum(s.hitOutcomes)).toBe(s.trialsCompleted);
      expect(s.bustIfHitCount).toBeLessThanOrEqual(s.trialsCompleted);
    }
  });

  it('hands back defensive copies: mutating a received snapshot does not corrupt later snapshots', async () => {
    // streamingRunner's toSnapshot contract: MUST return defensive copies of any mutable
    // field. If toSnapshot handed back the running accumulator, the +1000 mutations below
    // would corrupt every later snapshot's tallies — caught by the sum reconciliation.
    const api = createBlackjackSimulationApi({
      maxTrials: MAX_TRIALS,
      batchSize: 2000,
      progressIntervalMs: 0,
      seed: SEED,
    });
    const snapshots: BlackjackProgressSnapshot[] = [];

    await api.runSimulation(makeState(1), 1, (s) => {
      snapshots.push(s);
      // Sabotage every received snapshot the moment it arrives.
      s.dealerOutcomeCounts[0] += 1000;
      s.standOutcomes.win += 1000;
      s.hitOutcomes.lose += 1000;
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    // Fresh copies per emission — never the same mutable object twice.
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].dealerOutcomeCounts).not.toBe(snapshots[i - 1].dealerOutcomeCounts);
      expect(snapshots[i].standOutcomes).not.toBe(snapshots[i - 1].standOutcomes);
      expect(snapshots[i].hitOutcomes).not.toBe(snapshots[i - 1].hitOutcomes);
    }
    // The final snapshot's tallies reconcile exactly, minus this test's own local mutation.
    const last = snapshots[snapshots.length - 1];
    const bucketSum = last.dealerOutcomeCounts.reduce((a, b) => a + b, 0) - 1000;
    expect(bucketSum).toBe(MAX_TRIALS);
    expect(outcomeSum(last.standOutcomes) - 1000).toBe(MAX_TRIALS);
    expect(outcomeSum(last.hitOutcomes) - 1000).toBe(MAX_TRIALS);
  });

  it('two runs with the same seed produce identical tallies (seeded determinism through the shared runner)', async () => {
    const finals: BlackjackProgressSnapshot[] = [];
    for (let run = 0; run < 2; run++) {
      const api = createBlackjackSimulationApi({
        maxTrials: MAX_TRIALS,
        batchSize: 2000,
        progressIntervalMs: 0,
        seed: SEED,
      });
      let last: BlackjackProgressSnapshot | null = null;
      await api.runSimulation(makeState(1), 1, (s) => {
        last = s;
      });
      expect(last).not.toBeNull();
      finals.push(last as unknown as BlackjackProgressSnapshot);
    }
    expect(finals[0].dealerOutcomeCounts).toEqual(finals[1].dealerOutcomeCounts);
    expect(finals[0].bustIfHitCount).toBe(finals[1].bustIfHitCount);
    expect(finals[0].standOutcomes).toEqual(finals[1].standOutcomes);
    expect(finals[0].hitOutcomes).toEqual(finals[1].hitOutcomes);
  });

  it('stops emitting snapshots after cancel() and settles the runSimulation promise', async () => {
    const api = createBlackjackSimulationApi({
      maxTrials: 50_000_000,
      batchSize: 2000,
      progressIntervalMs: 0,
    });
    const snapshots: BlackjackProgressSnapshot[] = [];
    const requestId = 1;

    const runPromise = api.runSimulation(makeState(1), requestId, (s) => {
      snapshots.push(s);
    });

    await waitUntil(() => snapshots.length > 0);
    api.cancel(requestId);

    await runPromise;
    const countAtCancel = snapshots.length;

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots.length).toBe(countAtCancel);
  });

  it('stops run 1 from emitting once run 2 supersedes it with the SAME requestId (WR-01 object-identity supersession, inherited from the shared runner)', async () => {
    const api = createBlackjackSimulationApi({
      maxTrials: 50_000_000,
      batchSize: 2000,
      progressIntervalMs: 0,
    });
    const snapshots1: BlackjackProgressSnapshot[] = [];
    const snapshots2: BlackjackProgressSnapshot[] = [];
    const requestId = 7;

    const run1 = api.runSimulation(makeState(1), requestId, (s) => {
      snapshots1.push(s);
    });

    await waitUntil(() => snapshots1.length > 0);

    // Re-entry with the SAME requestId — supersession must be decided by run-token identity,
    // not requestId equality. Asserted here (not assumed) because D-08 mandates the config
    // precisely so blackjack inherits this fix rather than re-implementing it.
    const run2 = api.runSimulation(makeState(1), requestId, (s) => {
      snapshots2.push(s);
    });

    await run1;
    await waitUntil(() => snapshots2.length > 0);

    const countAtSupersede = snapshots1.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(snapshots1.length).toBe(countAtSupersede);

    api.cancel(requestId);
    await run2;
  });

  describe('entry-point validation (validateBlackjackConditionedState)', () => {
    it('rejects a player hand shorter than 2 cards', async () => {
      const api = createBlackjackSimulationApi();
      const badState: BlackjackConditionedState = {
        ...makeState(1),
        playerHand: [FULL_DECK[0]],
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        'runSimulation: playerHand must have at least 2 cards, got 1',
      );
    });

    it('rejects a missing dealerUpcard', async () => {
      const api = createBlackjackSimulationApi();
      const badState: BlackjackConditionedState = {
        ...makeState(1),
        dealerUpcard: undefined as unknown as Card,
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        'runSimulation: dealerUpcard must be present, got undefined',
      );
    });

    it('rejects a remainingDeck shorter than the 12-card trial budget (06-RESEARCH Pitfall D)', async () => {
      const api = createBlackjackSimulationApi();
      const badState: BlackjackConditionedState = {
        ...makeState(1),
        remainingDeck: shoeWithout(1, knownCards).slice(0, BLACKJACK_TRIAL_CARD_BUDGET - 1),
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck must have at least ${BLACKJACK_TRIAL_CARD_BUDGET} cards, got ${BLACKJACK_TRIAL_CARD_BUDGET - 1}`,
      );
    });

    it('rejects a remainingDeck holding more copies of a value than the shoe has left (deckCount=1), naming the card', async () => {
      const api = createBlackjackSimulationApi();
      const base = makeState(1);
      const badState: BlackjackConditionedState = {
        ...base,
        remainingDeck: [...base.remainingDeck.slice(1), playerHand[0]],
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck overlaps known cards: ${playerHand[0]}`,
      );
    });

    it('accepts the legitimate sibling copy at deckCount=2 (budget check, not zero-overlap)', async () => {
      // At 2 decks a value the player holds once still has its sibling physical copy in the
      // shoe — shoeWithout(2, known) leaves exactly one copy of each known card in the pool.
      const api = createBlackjackSimulationApi({
        maxTrials: 1000,
        batchSize: 500,
        progressIntervalMs: 0,
        seed: SEED,
      });
      const state = makeState(2);
      expect(state.remainingDeck.filter((c) => c === playerHand[0])).toHaveLength(1);

      const snapshots: BlackjackProgressSnapshot[] = [];
      await api.runSimulation(state, 1, (s) => {
        snapshots.push(s);
      });
      expect(snapshots[snapshots.length - 1].done).toBe(true);
    });

    it('counts a present knownDealerHole against the remainingDeck copy budget, naming the card (06-REVIEW CR-01)', async () => {
      // A revealed hole is a KNOWN card: a pool that still holds its copy (at deckCount=1)
      // is exactly the overlap corruption the budget check exists to reject.
      const api = createBlackjackSimulationApi();
      const hole = FULL_DECK[3];
      const badState: BlackjackConditionedState = {
        ...makeState(1),
        knownDealerHole: hole,
        // Deliberately built WITHOUT excluding the hole — its copy is over budget.
        remainingDeck: shoeWithout(1, knownCards),
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck overlaps known cards: ${hole}`,
      );
    });

    it('accepts a revealed-hole state whose pool correctly excludes the hole, and streams to done (06-REVIEW CR-01)', async () => {
      const api = createBlackjackSimulationApi({
        maxTrials: 1000,
        batchSize: 500,
        progressIntervalMs: 0,
        seed: SEED,
      });
      const hole = FULL_DECK[3];
      const state: BlackjackConditionedState = {
        ...makeState(1),
        knownDealerHole: hole,
        remainingDeck: shoeWithout(1, [...knownCards, hole]),
      };
      const snapshots: BlackjackProgressSnapshot[] = [];
      await api.runSimulation(state, 1, (s) => {
        snapshots.push(s);
      });
      expect(snapshots[snapshots.length - 1].done).toBe(true);
    });

    it('rejects a THIRD copy of a known value at deckCount=2 (budget exceeded)', async () => {
      const api = createBlackjackSimulationApi();
      const base = makeState(2);
      const badState: BlackjackConditionedState = {
        ...base,
        remainingDeck: [...base.remainingDeck, playerHand[0]],
      };
      await expect(api.runSimulation(badState, 1, () => {})).rejects.toThrow(
        `runSimulation: remainingDeck overlaps known cards: ${playerHand[0]}`,
      );
    });
  });
});
