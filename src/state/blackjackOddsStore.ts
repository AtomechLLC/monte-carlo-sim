import { create } from 'zustand';
import { DEALER_BUCKET_COUNT } from '../worker/blackjackProtocol';
import type { BlackjackProgressSnapshot } from '../worker/blackjackProtocol';
import type { DeckCount } from '../engine/shoe';

// This store must not import blackjackStore — the dependency runs one way only
// (blackjackStore.deal()/setDeckCount() call clearCache() here, never the reverse).

/**
 * Blackjack's OWN cache key: `${playerHandLength}|${revealedHole ? 1 : 0}`.
 *
 * Within a round, cards are only ever ADDED to the player's hand and the hole is only
 * ever revealed — both monotonic — so hand length plus reveal state fully determine what
 * is known at a decision point. The key shape is deliberately blackjack-shaped and
 * separate from the poker cache's key: PITFALLS Pitfall 11 forbids widening the poker
 * key with a game discriminant, and D-10 requires no key or field sharing between the
 * two games' stores. `deckCount` is deliberately NOT part of the key — `setDeckCount`
 * clears this whole cache instead, which is what makes every deck toggle a visible
 * re-run rather than an instant cached answer on the way back (D-12, BJ-07, UI-SPEC A3).
 */
export function blackjackKnowledgeKey(playerHandLength: number, revealedHole: boolean): string {
  return `${playerHandLength}|${revealedHole ? 1 : 0}`;
}

interface BlackjackOddsState {
  /** Live streamed histogram — length `DEALER_BUCKET_COUNT`, indexed by `DEALER_BUCKET_ORDER`. */
  dealerOutcomeCounts: number[];
  /** Trials whose hypothetical hit card busted the player — its OWN tally, never derived. */
  bustIfHitCount: number;
  standOutcomes: { win: number; push: number; lose: number };
  hitOutcomes: { win: number; push: number; lose: number };
  trialsCompleted: number;
  done: boolean;
  /**
   * Settled (done: true) snapshots keyed by `blackjackKnowledgeKey(playerHandLength,
   * revealedHole)`. Both key dimensions are monotonic within a round, so a hit or a
   * reveal changes the key and every future lookup misses until recomputed.
   */
  settledCache: Map<string, BlackjackProgressSnapshot>;
  /** Restores initial (all-zero) LIVE DISPLAY fields — call before starting a fresh
   * simulation run. Deliberately does NOT touch settledCache: reset() runs before every
   * fresh run and must not throw away previously settled decision points. */
  reset: () => void;
  /** Writes a streamed snapshot's tally fields into the live state. */
  applySnapshot: (snapshot: BlackjackProgressSnapshot) => void;
  /** Returns the cached settled snapshot for (playerHandLength, revealedHole), or undefined. */
  getCached: (playerHandLength: number, revealedHole: boolean) => BlackjackProgressSnapshot | undefined;
  /** Stores `snapshot` under (playerHandLength, revealedHole) ONLY when `snapshot.done`
   * is true — a silent no-op write-gate for unsettled (still-converging) snapshots. */
  cacheIfSettled: (
    playerHandLength: number,
    revealedHole: boolean,
    snapshot: BlackjackProgressSnapshot,
  ) => void;
  /** Empties settledCache — called by blackjackStore.deal() (a new round never serves the
   * previous round's settled numbers) and by setDeckCount() (every deck toggle must
   * visibly re-run under the new shoe, D-12/BJ-07). Leaves the live display fields
   * untouched. */
  clearCache: () => void;
  /**
   * The shoe the DISPLAYED run was computed under (UI-SPEC A3 snapshot rule, checker
   * FLAG 1). Read by the dealer-table subtitle in plan 06-06 — NEVER the pending
   * selection: while a round is resolved or idle no run restarts on a deck toggle, so
   * the retained numbers must keep naming the shoe they were computed under. Moved only
   * by `setDisplayedDeckCount`; untouched by reset(), clearCache() and applySnapshot().
   */
  displayedDeckCount: DeckCount;
  setDisplayedDeckCount: (deckCount: DeckCount) => void;
}

function initialLiveFields(): Pick<
  BlackjackOddsState,
  'dealerOutcomeCounts' | 'bustIfHitCount' | 'standOutcomes' | 'hitOutcomes' | 'trialsCompleted' | 'done'
> {
  return {
    dealerOutcomeCounts: new Array<number>(DEALER_BUCKET_COUNT).fill(0),
    bustIfHitCount: 0,
    standOutcomes: { win: 0, push: 0, lose: 0 },
    hitOutcomes: { win: 0, push: 0, lose: 0 },
    trialsCompleted: 0,
    done: false,
  };
}

/**
 * Dev-only internal consistency guard: reports — but never throws or alters — any
 * snapshot whose tallies fail to reconcile with `trialsCompleted`, or whose bucket
 * histogram is not `DEALER_BUCKET_COUNT` long. Report-only, so a numeric regression
 * surfaces loudly in development without ever being able to break the live convergence
 * display in production.
 *
 * Deliberately NOT checked: any relation between `bustIfHitCount` and
 * `hitOutcomes.lose`. A hit can lose without busting, so those are two genuinely
 * different tallies with no equality to reconcile — the only hard bound on
 * `bustIfHitCount` is `trialsCompleted` itself.
 */
function checkBlackjackSnapshotConsistency(snapshot: BlackjackProgressSnapshot): void {
  const bucketSum = snapshot.dealerOutcomeCounts.reduce((a, b) => a + b, 0);
  const standSum = snapshot.standOutcomes.win + snapshot.standOutcomes.push + snapshot.standOutcomes.lose;
  const hitSum = snapshot.hitOutcomes.win + snapshot.hitOutcomes.push + snapshot.hitOutcomes.lose;

  if (snapshot.dealerOutcomeCounts.length !== DEALER_BUCKET_COUNT) {
    console.error(
      `[blackjackOddsStore consistency guard] dealerOutcomeCounts has length ${snapshot.dealerOutcomeCounts.length}, expected ${DEALER_BUCKET_COUNT}`,
    );
  }
  if (bucketSum !== snapshot.trialsCompleted) {
    console.error(
      `[blackjackOddsStore consistency guard] dealerOutcomeCounts sum (${bucketSum}) does not match trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
  if (standSum !== snapshot.trialsCompleted) {
    console.error(
      `[blackjackOddsStore consistency guard] standOutcomes sum (${standSum}) does not match trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
  if (hitSum !== snapshot.trialsCompleted) {
    console.error(
      `[blackjackOddsStore consistency guard] hitOutcomes sum (${hitSum}) does not match trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
  if (snapshot.bustIfHitCount > snapshot.trialsCompleted) {
    console.error(
      `[blackjackOddsStore consistency guard] bustIfHitCount (${snapshot.bustIfHitCount}) exceeds trialsCompleted (${snapshot.trialsCompleted})`,
    );
  }
}

export const useBlackjackOddsStore = create<BlackjackOddsState>()((set, get) => ({
  ...initialLiveFields(),
  settledCache: new Map<string, BlackjackProgressSnapshot>(),
  displayedDeckCount: 1,
  // Partial merge (set() only overwrites the live-display keys returned by
  // initialLiveFields()) — settledCache and displayedDeckCount are untouched, which is
  // load-bearing: a fresh run must not lose previously settled decision points, and the
  // subtitle must keep naming the shoe the displayed numbers came from (A3).
  reset: () => set(initialLiveFields()),
  applySnapshot: (snapshot) => {
    if (import.meta.env.DEV) {
      checkBlackjackSnapshotConsistency(snapshot);
    }
    set({
      dealerOutcomeCounts: snapshot.dealerOutcomeCounts,
      bustIfHitCount: snapshot.bustIfHitCount,
      standOutcomes: snapshot.standOutcomes,
      hitOutcomes: snapshot.hitOutcomes,
      trialsCompleted: snapshot.trialsCompleted,
      done: snapshot.done,
    });
  },
  getCached: (playerHandLength, revealedHole) =>
    get().settledCache.get(blackjackKnowledgeKey(playerHandLength, revealedHole)),
  cacheIfSettled: (playerHandLength, revealedHole, snapshot) => {
    if (!snapshot.done) return;
    // Copy-on-write: never mutate the existing Map in place (Zustand reference-equality
    // rule — subscribers comparing the old/new Map reference would otherwise miss the
    // update).
    set((state) => ({
      settledCache: new Map(state.settledCache).set(
        blackjackKnowledgeKey(playerHandLength, revealedHole),
        snapshot,
      ),
    }));
  },
  clearCache: () => set({ settledCache: new Map<string, BlackjackProgressSnapshot>() }),
  setDisplayedDeckCount: (deckCount) => set({ displayedDeckCount: deckCount }),
}));
