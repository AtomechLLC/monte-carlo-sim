---
phase: 06-blackjack-core-odds-loop
reviewed: 2026-08-24T23:39:42Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/engine/blackjackHandValue.ts
  - src/engine/blackjackConditioning.ts
  - src/engine/blackjackEquity.ts
  - src/worker/blackjackProtocol.ts
  - src/worker/blackjackSimulationApi.ts
  - src/worker/simulationApi.ts
  - src/worker/simulation.worker.ts
  - src/state/workerClient.ts
  - src/state/simulationService.ts
  - src/state/blackjackSimulationService.ts
  - src/state/blackjackStore.ts
  - src/state/blackjackOddsStore.ts
  - src/state/gameModeStore.ts
  - src/ui/BlackjackGame.tsx
  - src/ui/BlackjackTable.tsx
  - src/ui/BlackjackControls.tsx
  - src/ui/BlackjackDealerArea.tsx
  - src/ui/BlackjackPlayerArea.tsx
  - src/ui/BlackjackOutcomeBanner.tsx
  - src/ui/BlackjackOddsPanel.tsx
  - src/ui/BustEvDisplay.tsx
  - src/ui/DealerDistributionDisplay.tsx
  - src/ui/formatEv.ts
  - src/ui/dealerBucketLabels.ts
  - src/ui/AnimatedCard.tsx
  - src/ui/HoldemGame.tsx
  - src/App.tsx
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-24T23:39:42Z
**Depth:** standard (deep cross-file attention on the gate-accounting, dual-exclusion-set, odds-effect, worker-transport, trial-loop and UI seams named by the review brief)
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the full Phase 6 blackjack vertical slice against `7b9ca13..HEAD`: rules engine + trial loop, dual-exclusion-set conditioning, worker transport (lazy namespaced client, WR-02 validation), both blackjack stores, the felt composition/controls/odds cluster, and the extracted `HoldemGame`/slimmed `App` shell. Cross-referenced against the unchanged modules the new code depends on (`shoe.ts`, `streamingRunner.ts`, `oddsStore.ts`, `gameStore.ts`, `uiStore.ts`, `useAnimationGate`, `FlipCard`). Sanctioned SUMMARY-recorded deviations, the jsdom reduced-motion coverage limit, and the HMR console artifact were not re-flagged.

**Verified clean (adversarial probes that came back sound):**

- **Gate accounting end-to-end (priority 1).** Every `beginAnimation()` call site in `blackjackStore` changes at least one member of `BlackjackTable`'s release tuple `{roundNonce, playerHandLength, roundPhase, revealedHole}` in the same `set()` commit, and no other writer mutates any tracked field without arming: deal (nonce, unconditional — including natural resolutions), hit non-bust (length), hit-into-bust (length+phase+hole in ONE commit → one release), stand (phase+hole, correct even after an early reveal because phase still changes), revealHole (hole, guarded one-way), setDeckCount (no arm, no tracked change). Mount/StrictMode/switch-back release zero via the prevRef early return (05-REVIEW CR-02 fix correctly transplanted); user actions arrive one-per-commit (React does not batch across discrete events), so arms = releases in every sequence probed: deal→hit→bust, stand→attempted-reveal-during-playout, natural deal, rapid re-deal mid-animation, mode switch mid-deal, StrictMode double-invoke.
- **Trial-loop cursor arithmetic (priority 5).** Worst-case exhaustive analysis of the 12-card budget: the longest legal dealer hand is 11 cards (2-deck shoe; the soft-total gap at hard sums 7–11 with an ace present caps any longer chain), so maximum per-trial consumption is 1 hypothetical hole + 9 dealer hits + 1 hit card = 11 ≤ 12 — `drawn[cursor]` can never read past the drawn prefix. Dealer playout is delegated to the single `playDealerHand` implementation via a shared-cursor closure; EV trial outcomes are provably confined to {−1, 0, +1} (naturals resolve at deal; `isNatural`'s 2-card guard blocks hit-into-21 pricing); `bustIfHitCount` is its own tally.
- **Dual-exclusion-set pre-reveal half (priority 2).** Pre-reveal, the hole card stays in the odds pool (`deriveBlackjackConditionedState` omits it from `knownCards`) and is always spent in `liveShoeLedger` (no `revealedHole` parameter exists, structurally preventing conditional exclusion); `hit()`/`stand()` draw only from the ledger, so no live draw can collide with the predetermined hole. No DOM leak: `FlipCard` receives `card={undefined}` while hidden; the banner and dealer-total badge read the hole only in states where every resolution path has already set `revealedHole`.
- **WR-02 validation (priority 4).** Both `validateConditionedState` and `validateBlackjackConditionedState` reject 0 / >2 / non-integer / non-numeric `deckCount` before any arithmetic consumes it; blackjack additionally requires the field. `deckCount !== 1 && deckCount !== 2` is total over NaN/strings/undefined. The under-sized-pool check (`remainingDeck.length >= 12`) landed at the validate hook as the T-06-06 transfer specified. Poker's exported surface and golden gates are unchanged (D-08).
- **Lazy worker singleton.** `ensureWorker()`'s check-and-assign is fully synchronous (StrictMode two-concurrent-first-calls safe); the only `new SimWorker()`/`Comlink.wrap()` in src/ live inside it; crash listeners attach exactly once at first construction; each service's `reportWorkerFailure` nulls callbacks and invalidates its generation before invoking the captured `onError` (exactly-once).
- **Outcome banner vs. comparison result (priority 6).** All eight copy paths were traced against the store's resolution paths — the bust checks correctly precede the outcome-based rows, `playerNaturalWin` correctly excludes the double-natural push, and no reachable state maps to a mismatched heading.

**However**, two Critical defects survive: the post-reveal odds pipeline never conditions on the revealed hole card's identity (it resamples a hypothetical hole from a pool that excludes the real one — BJ-06's reconditioning is structurally absent), and the settled-odds cache can be poisoned across round/deck generations through the window between a store action's synchronous `clearCache()` and the React passive-effect cleanup that sets the `ignore` flag.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Post-reveal odds ignore the revealed hole card's identity — trials resample a hypothetical hole from a pool that excludes the real one

**Status:** FIXED — commit `4c16c78` (2026-08-24). `BlackjackConditionedState.knownDealerHole` threaded from the sole reader through the trial loop (`state.knownDealerHole ?? drawn[cursor++]`); validation budgets the known hole; guard docs strengthened in-place. RED tests: known-hole script, Natural-bucket-exactly-0, seeded pre/post-reveal bust% direction, derive/validate/loop-suite pins.

**File:** `src/engine/blackjackEquity.ts:123` (hypothetical hole draw), `src/engine/blackjackEquity.ts:18-35` (`BlackjackConditionedState` has no dealer-hole field), `src/engine/blackjackConditioning.ts:72-89` (reveal only moves the hole into the exclusion set), `src/ui/BlackjackGame.tsx:117` (call site)

**Issue:** After `revealHole()`, `deriveBlackjackConditionedState` removes the hole from `remainingDeck` (pool 49 → 48) — but the trial loop still executes `const dealerHole = drawn[cursor++]` for every trial, sampling a *hypothetical* hole from the 48-card pool. The revealed hole's *value* never reaches the worker: `BlackjackConditionedState` carries no field for it. So post-reveal, every displayed statistic is conditioned on "the dealer's hole is some card *other than* the one face-up on the table":

- **Visible absurdity:** upcard A♠, revealed hole 5♦ (dealer showing soft 16, both cards face-up) — the "Natural" bucket displays ≈ P(hypothetical hole is ten-value) ≈ 30%+, while the user can *see* the dealer does not have a natural. Any A/T upcard reproduces this.
- **Wrong decision support:** upcard 6, revealed hole T (dealer pinned at hard 16, ~61% bust on the true conditional) — the dealer table keeps showing the ~42% upcard-6 marginal, and both EV tiles and the Stand win/push/lose group are computed against the same wrong mixture. The numbers "land fresh" (new run, 48-card pool) but barely move — removing one card from a 49-card pool shifts each bucket by well under 1pp.

This defeats the phase's own locked intent: SC4 / BJ-06 ("early hole reveal **reconditions all odds**"), D-02 ("odds condition ONLY on visible/known cards (… + any revealed hole …)"), and 06-CONTEXT's centerpiece language ("7 labeled buckets that **visibly reshape** when … the hole is revealed"). Conditioning on a revealed card means the dealer's hand IS (upcard, hole) in every trial — pool exclusion alone conditions on the *contradiction* of what was revealed. Note this is not a recorded deviation: 06-RESEARCH's Option A/B fork addresses only the weaker pre-reveal "no dealer natural at decision point" fact; the research sketch, plan, and loop test all carried the pool-only treatment forward without ever examining the post-reveal conditional, and the 06-08 audit equated SC4 with the 49→48 pool assertion.

**Fix:** Thread the revealed hole through the conditioned state and use it as the dealer's hole when present:

```ts
// blackjackEquity.ts
export interface BlackjackConditionedState {
  playerHand: Card[];
  dealerUpcard: Card;
  /** Present iff the hole has been revealed — the dealer's actual hole card (D-02). */
  knownDealerHole?: Card;
  remainingDeck: Card[];
  deckCount: DeckCount;
}

// in the trial loop:
const dealerHole = state.knownDealerHole ?? drawn[cursor++];
```

`deriveBlackjackConditionedState` sets `knownDealerHole: revealedHole ? round.dealerHole : undefined` (it is already the sole reader). Budget arithmetic is unaffected (the known-hole path consumes one *fewer* drawn card). Add `knownDealerHole` presence/shape to `validateBlackjackConditionedState` (must be absent from `remainingDeck`'s copy budget when present), and extend the loop suite's BJ-06 case to assert the Natural bucket is exactly 0 and the dealer distribution collapses toward the known-hole conditional after a reveal.

### CR-02: Settled-cache poisoning race — a late snapshot landing between a store action's `clearCache()` and the effect cleanup files stale odds under a fresh generation's key, which then cache-hits and suppresses the re-run

**Status:** FIXED — commit `09563b8` (2026-08-24). Generation guard in both game roots' `onProgress` before `applySnapshot` AND `cacheIfSettled`: blackjack checks live `roundNonce` + `deckCount` against the effect closure; Hold'em checks `dealNonce` (already in the closure — no store change needed). Goldens and the five frozen v1 suites byte-untouched and green (D-08). RED tests: scripted late-snapshot delivery inside the pre-cleanup window per game, plus the BJ-07 mid-turn deck-toggle variant.

**File:** `src/ui/BlackjackGame.tsx:120-133` (onProgress live until cleanup), `src/state/blackjackOddsStore.ts:21-23` (key has no round/deck dimension), `src/state/blackjackStore.ts:107-118` (deal's clearCache/reset), `src/state/blackjackStore.ts:188-201` (setDeckCount's clearCache/reset); same mechanism carried in `src/ui/HoldemGame.tsx:104-124` with `src/state/oddsStore.ts:10-12`

**Issue:** `blackjackKnowledgeKey` is `${playerHandLength}|${revealedHole}` — deliberately no `roundNonce` and no `deckCount`, with cross-round/cross-deck safety delegated entirely to `deal()`/`setDeckCount()` calling `clearCache()`. But the running effect's `onProgress` stays fully live (its `ignore` flag is still false and the service's `currentRequestId` still matches — no cancel has happened) from the store action's synchronous writes until React's *passive-effect flush* runs the cleanup. Worker `message` events are macrotasks that can be delivered inside that gap (the worker posts every ~50-100ms; a snapshot enqueued during the click task's execution, before React posts its scheduler task, is dispatched first). Concrete failure sequences:

1. **Re-deal near run completion:** round 1 (hand length 2, unrevealed) run is finishing. User clicks Deal. `deal()` synchronously clears the cache and zeroes the display; before the effect cleanup runs, run 1's final `done: true` snapshot arrives → `ignore === false`, requestId current → `cacheIfSettled(2, false, …)` writes round 1's settled odds at key `"2|0"` — *after* the clear. When the deal animation drains, the new effect's Gate 4 looks up `"2|0"`, **hits**, applies round 1's converged odds to round 2's completely different hand, and starts **no run**. Sticky until the next key change.
2. **Mid-turn deck toggle near run completion (the BJ-07 headline interaction):** `setDeckCount(2)` clears cache + resets + retitles to "2-deck shoe"; the old 1-deck run's late `done` snapshot re-caches under the unchanged key; the re-triggered effect cache-hits → 1-deck numbers displayed under the 2-deck subtitle, and the visible re-run D-12 promises never happens.
3. **Natural re-deal (A16 variant, needs only a non-done snapshot):** deal resolves on a natural; `deal()`'s unconditional `reset()` zeroes the display; a late in-flight snapshot then `applySnapshot`s the *previous* round's tallies over the zeros. The new effect permanently returns at Gate 3 (resolved), so nothing ever re-resets — the natural's outcome banner sits beside the previous round's converged percentages, violating A16/D-03a's zero-trials state.

The closure-captured key dimensions (the comment at lines 127-131) defend against the *wrong-key* hazard but not this *same-key, wrong-generation* hazard. `HoldemGame` has the identical window (key `street|revealedMask`, `gameStore.deal()` → `clearCache()`; a re-deal from the same street/mask can serve the previous hand's cached odds and start no run) — behavior predates this phase and was extracted verbatim, but the file is in this phase's diff and the fix should land in both roots.

**Fix:** Make `onProgress` verify the generation before touching the store — `roundNonce` and `deckCount` are already in the effect closure:

```tsx
(snapshot) => {
  if (ignore) return;
  const bj = useBlackjackStore.getState();
  // Same-key/wrong-generation guard: a late snapshot from a run whose round or shoe has
  // been superseded must neither display nor cache (deal()/setDeckCount() clearCache()
  // cannot cover the pre-cleanup delivery window).
  if (bj.roundNonce !== roundNonce || bj.deckCount !== deckCount) return;
  setErrorMessage(null);
  useBlackjackOddsStore.getState().applySnapshot(snapshot);
  useBlackjackOddsStore.getState().cacheIfSettled(playerHandLength, revealedHole, snapshot);
},
```

(Equivalently: fold `roundNonce` and `deckCount` into `blackjackKnowledgeKey` — the clearCache-on-toggle findability mechanism is unaffected since the key change alone forces the miss.) Mirror the guard in `HoldemGame` with `dealNonce`.

## Warnings

### WR-01: Deck-toggle duplicate guard ignores the hidden hole card — a 2→1 toggle can silently create an impossible one-deck table and corrupt the shoe ledger

**Status:** FIXED — commit `07d4624` (2026-08-24). New count-only sole reader `hasPhysicalDuplicate(round, hand, playout)` in `blackjackConditioning.ts`; `setDeckCount` refuses the impossible 2→1 switch at the store boundary (complete no-op, the correctness backstop) and `BlackjackControls` disables "1 deck" via the same reader with the locked A3 title. The ~one-bit D-02 leak is accepted and DOCUMENTED at both surfaces (comment citing this finding); 06-UI-SPEC A3 wording amended from "visible cards" to the physical set. Both directions tested (hidden-duplicate refusal, revealed-duplicate refusal, clean 2→1 allowed).

**File:** `src/ui/BlackjackControls.tsx:41-56` (guard over visible cards only), enabled by `src/engine/shoe.ts:70-82` (`shoeWithout` silently ignores excess exclusion budget)

**Issue:** The A3 guard disables the "1 deck" segment only when the *visible* cards contain a duplicate. The predetermined hole is a real physical card too, and while hidden it is excluded from `visibleCards`. Concrete scenario: 2-deck round deals player 5♣ 8♦, upcard 9♠, hole 5♣ (hidden) — hole duplicating a visible card happens in roughly 3% of 2-deck rounds. Visible cards have no duplicate, so "1 deck" stays enabled; the user toggles mid-turn (the exact interaction A3 sanctions). Now `deckCount === 1` with two physical 5♣ on the table. Every subsequent shoe read is silently wrong: `liveShoeLedger` asks `shoeWithout(1, [5c, 8d, 9s, 5c])` to remove two 5♣ from a one-copy shoe — `shoeWithout` drops the one copy and *silently ignores* the second, yielding a 49-card ledger (table + ledger = 53 cards ≠ 52). Hits/stand playout draw from that over-full pool; post-reveal, `deriveBlackjackConditionedState` under-excludes the same way, and the worker's overlap validation cannot catch it (the hole isn't in its `knownCards`, and the pool holds zero copies of the over-spent value — no budget violation fires). No crash, no error — just an impossible physical state and quietly skewed odds, the exact silent-wrongness class the dual-exclusion-set module header warns about.

**Fix:** Count the hole in the guard whenever a round exists — it is a physical card regardless of visibility, and using it for a count-only boolean leaks nothing to the DOM (though to respect the D-02 sole-reader discipline, prefer deriving the boolean next to the sole readers):

```tsx
const physicalCards =
  round === null
    ? []
    : [...playerHand, round.dealerUpcard, round.dealerHole, ...dealerPlayoutCards];
```

(If touching `round.dealerHole` outside the engine is unacceptable, export a third narrow reader from `blackjackConditioning.ts` — e.g. `hasPhysicalDuplicate(round, playerHand, playout): boolean` — and pin it as a sole reader.) Update the guard test with the hidden-hole-duplicate fixture. Note the 06-UI-SPEC A3 row says "visible cards", so amend the spec wording in the same change — the spec's own purpose (impossible-under-one-deck states) requires the physical set.

### WR-02: A hard worker crash leaves `getApi()` returning a dead proxy forever — the error banner's "Deal a new round to try again" recovery is unfulfillable

**Status:** FIXED — commit `d6c2b72` (2026-08-24). `onHardFailure` wired through both listeners: nulls the cached handle (next `start*` call constructs a fresh worker, listeners re-attach in `ensureWorker`), terminates the dead thread, then fans the failure out as before. Identity-guarded so a zombie event from an already-replaced worker never tears down its replacement. Lazy-singleton pins (zero-on-import, one-on-first-call) untouched and green, extended with crash-then-restart streaming and the stale-event case.

**File:** `src/state/workerClient.ts:49-77` (`handle` never invalidated on `error`/`messageerror`), `src/ui/BlackjackGame.tsx:17-18` and `src/ui/HoldemGame.tsx:15-16` (recovery copy)

**Issue:** `ensureWorker()` caches `{ worker, api }` in module scope and nothing ever clears it. When the worker dies hard (script-load failure, wedged event loop — the exact paths the `error`/`messageerror` listeners exist for), `reportWorkerFailure` correctly surfaces the banner once, but every subsequent `start*Simulation` call still routes through the same dead proxy: `runSimulation` posts into a void and its promise never settles — no rejection (so no second banner), no snapshots (so the panel sits at the reset zero-state indefinitely), and the `finally` cleanup of that call never runs. Both games' banners instruct the user to re-deal ("Deal a new round to try again." / "Re-deal, or navigate to another street, to try again.") — a recovery path that cannot work; only a full page reload does. The non-restarting singleton shape predates this phase, but `workerClient.ts` is new Phase 6 code that now owns this contract for both games, and the review brief's crash-path question ("does a crashed worker leave getApi returning a dead proxy forever?") is answered yes.

**Fix:** Invalidate the cache on hard failure so the next `start*`/`cancel*` call constructs a fresh worker (listeners re-attach inside `ensureWorker` automatically):

```ts
function onHardFailure(message: string): void {
  const dead = handle;
  handle = null;            // next getApi() builds a fresh worker
  dead?.worker.terminate(); // release the dead thread; safe if already dead
  reportWorkerFailure(message);
}
```

Wire both listeners through `onHardFailure`. Each service's generation invalidation already prevents stale-callback resurrection across the restart. Add a test: crash → banner → `startBlackjackSimulation` constructs a second worker and streams.

## Info

### IN-01: Selector-less whole-store subscriptions in the odds-cluster components

**Status:** FIXED — commit `efb9699` (2026-08-24). Per-field selectors: four in `BustEvDisplay`, three in `DealerDistributionDisplay`; behavior unchanged.

**File:** `src/ui/BustEvDisplay.tsx:37`, `src/ui/DealerDistributionDisplay.tsx:13`

**Issue:** Both components call `useBlackjackOddsStore()` with no selector, subscribing to the entire store. Every store write re-renders them — including `settledCache` copy-on-write Map replacements and `clearCache()` calls that change nothing they display. Harmless at this scale, but it diverges from the per-field selector discipline every other store consumer in the codebase follows (`BlackjackGame`, `BlackjackTable`, `BlackjackControls`, all Hold'em components), which makes these two the odd files out for future readers and forfeits Zustand's equality bail-outs.

**Fix:** Subscribe per field, e.g. `const trialsCompleted = useBlackjackOddsStore((s) => s.trialsCompleted);` (four selectors in `BustEvDisplay`, three in `DealerDistributionDisplay`).

---

_Reviewed: 2026-08-24T23:39:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Fix Record (2026-08-24)

All 5 findings FIXED — one atomic commit per finding, RED test first: CR-01 `4c16c78`, CR-02 `09563b8`, WR-01 `07d4624`, WR-02 `d6c2b72`, IN-01 `efb9699`. Suite grew 679 → 697 tests (51 → 52 files; new sibling `App.holdemCachePoison.test.tsx` — the five frozen v1 suites and both golden gates byte-untouched). Final gate green at every commit and at HEAD: `vitest run`, `tsc --noEmit`, `eslint .`, `npm run build`.

_Fixed: 2026-08-24_
_Fixer: Claude (gsd-code-fixer)_
