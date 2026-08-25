---
phase: 07-2-deck-holdem-evaluation
reviewed: 2026-08-25T03:09:18Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/App.css
  - src/App.holdemDeckToggle.test.tsx
  - src/App.modeShell.guard.test.ts
  - src/engine/equity.ts
  - src/engine/equityTwoDeck.test.ts
  - src/engine/evaluatorTwoDeck.property.test.ts
  - src/engine/evaluatorTwoDeck.test.ts
  - src/engine/evaluatorTwoDeck.ts
  - src/engine/fiveOfAKindFrequency.test.ts
  - src/engine/shoePath.guard.test.ts
  - src/engine/twoDeckOracle.ts
  - src/state/gameStore.test.ts
  - src/state/gameStore.ts
  - src/state/oddsStore.ts
  - src/state/oddsStoreTwoDeck.test.ts
  - src/state/pickerStore.test.ts
  - src/state/pickerStore.ts
  - src/test/holdemTestids.ts
  - src/ui/BoardDisplay.tsx
  - src/ui/CardPicker.test.tsx
  - src/ui/CardPicker.tsx
  - src/ui/FlipCard.tsx
  - src/ui/HandDisplay.tsx
  - src/ui/HoldemGame.tsx
  - src/ui/OddsTable.tsx
  - src/ui/OddsTableTwoDeck.test.tsx
  - src/ui/PlayingCard.tsx
  - src/ui/Seat.tsx
  - src/ui/categoryLabels.ts
  - src/ui/copyCue.test.ts
  - src/ui/copyCue.ts
  - src/ui/copyCueRender.test.tsx
  - src/ui/lockedCategory.ts
  - src/ui/lockedCategoryTwoDeck.test.ts
  - src/ui/node-builtins.d.ts
  - src/worker/deckCountValidation.test.ts
  - src/worker/protocol.ts
  - src/worker/simulationApi.ts
  - src/engine/evaluator.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-25T03:09:18Z
**Depth:** standard (deep cross-file attention on the duplicate-aware evaluator, hot-path integration, toggle lifecycle, picker wire, copy-cue derivation, and lockedInCategory routing seams named by the review brief)
**Files Reviewed:** 39 (phase diff `343018a..HEAD`, source only; unchanged dependencies `evaluator.ts`, `conditioning.ts`, `streamingRunner.ts` cross-read for call-chain verification)
**Status:** issues_found (info-only — no Critical, no Warning)

## Summary

Reviewed the full Phase 7 2-deck Hold'em evaluation slice against the 07-RESEARCH algorithm spec and the locked D-01..D-16 decisions: the duplicate gate / Five-of-a-Kind branch / suit-remap proxy / flush-zone scorer / extended comparator, the hoisted trial-loop integration and grow-on-merge snapshot spine, the D-02 toggle lifecycle with the A4 refusal, the CardPicker deckCount wire (WR-01 closure), the canonical-scan copy cue across all three felt paths, and the lockedInCategory routing. Sanctioned SUMMARY-recorded deviations, the jsdom reduced-motion coverage limit, and the stale HMR console artifact were not re-flagged.

**Verified clean (adversarial probes that came back sound):**

- **Suit-remap proxy vs the research correctness conditions (priority 1).** Hand-traced every duplicate shape class against the pigeonhole proofs: (i) in the step-5 branch a substitution can never land in a ≥5-physical suit — with the flush suit at ≥5 and the dup pair elsewhere, the window arithmetic forces the flush suit to exactly 5 and leaves two empty suits whose proxy count (0) always beats the flush suit's (5) in the lowest-count choice, and the committed defense assertion (`evaluatorTwoDeck.ts:405-411`) re-checks it; (ii) in the flush zone (dup inside the ≥5 suit) no other suit can reach 5 in the proxy (≥5 in the flush suit leaves ≤2 cards + ≤3 spread substitutions elsewhere); (iii) rank multiplicities are preserved exactly, so proxy rank-category results and kickers — including duplicated-rank kickers — are the true multiset results; (iv) the full-window-counts-before-choosing implementation detail (07-01 SUMMARY key decision) correctly closes the prefix-count phantom-flush hole the research pseudocode left open. Constructed adversarial shapes (dup-in-flush-suit + second dup pair whose substitution builds a real full house; rank-count-4 dup + 5-card flush suit resolving to quads over flush; dup-adjacent straight windows where the proxy's rank-path straight loses to the custom multiset flush) all resolve to the oracle-correct answer through the `max(custom, proxy)` step.
- **Flush-zone trigger boundaries (priority 1).** Exactly-5-physical with dup (custom provides the flush the proxy destroys: `Ah Ah 2h 3h 4h` → Flush `[12,12,2,1,0]`, pinned by vector (o)), 6-physical (proxy retains a real distinct flush, dominated pointwise by the custom multiset tiebreak), and 7-physical multi-dup all route correctly; the trigger's `dupSuitMask` is well-defined because a duplicated value always shares its twin's suit, and two ≥5 suits are impossible in a 7-card window. Five-of-a-Kind detection is unique per window (5+5 > 7), rank-only tiebreak with equal ranks tying at exactly `0`.
- **Extended comparator totality/antisymmetry (priority 1).** Cross-branch comparisons are consistent: custom flushes carry 5-entry tiebreak vectors and stock flushes derive the identical 5-rank-descending vector (`fillFlushVector`'s insertion sort writes all five positions; stock flush hands are always 5 distinct-rank cards), so vector order coincides with the library's flush-kicker order; SF highs are defensively recomputed wheel-aware for stock-shaped hands; RF-vs-RF ties; a strength-10 hand without a tiebreak throws before it can reach the library comparator; all returns are literal `1`/`-1`/`0` — never `-0`. Both stock-shaped sides delegate to `compareHands`, keeping proxy-vs-proxy byte-consistent with v1. The property suite's antisymmetry/transitivity sweep plus directional vectors (h/i/q) pin this.
- **Generation-wrap arithmetic (priority 1).** Each duplicate evaluation consumes two generations (outer scan + `buildProxy`'s classify pass); a wrap can therefore fire mid-evaluation — verified safe because every cross-generation read (`origSuitCounts`, `flushSuit`, `dupInFlushSuit`, `scanFoundDuplicate`) is snapshotted into plain variables before the second `beginScan`, and the wrap path zeroes all three stamp buffers before restarting at generation 1. The committed wrap regression test (c) covers stale-stamp phantom duplicates on both sides of the boundary.
- **Hot-path integration (priority 2).** `evalFn`/`cmpFn` selection is re-derived on every `runBatch` invocation from the runner's per-run `conditioned` object — no module-level caching, so consecutive runs alternating deck counts cannot cross-contaminate. At `deckCount === 2` the histogram is allocated length 11 from the same `deckCount` value that selects the wrapper, so an index-10 tally is always in-bounds; at 1 deck the wrapper is unreachable (strength ≤ 9, length 10, pinned by the "no index above 9 extends the array" test). `mergeBatch` extends totals with zeros to the batch's length BEFORE folding and iterates by batch length, so a Five-of-a-Kind tally can neither land out of bounds nor be dropped; at 1 deck growth is a no-op and `makeEmptyTotals` stays `CATEGORY_COUNT` (goldens byte-untouched and green). First emission happens after the first merge, so no 10-length snapshot can precede growth in a 2-deck run.
- **Toggle lifecycle (priority 3).** `setDeckCount`'s branch order (same-value early return → A4 refusal → `set` + conditional `deal()`) leaves no inconsistent state: the refusal is a complete no-op before any write, and it only guards the 2→1 direction where duplicated picks are the sole impossibility source. No path bypasses `deal()`'s cache clear: the idle-set path is only reachable with `runout === null`, which only holds before the first-ever deal (nothing ever nulls `runout` back), so the cache is provably empty there; every mid-hand change routes through `deal()` (negative control run in 07-05 turned exactly the four toggle-through-deal tests red). The CR-02 `dealNonce`-only guard in `HoldemGame.tsx:133` is sufficient without a `deckCount` check: a run can only be in flight with `runout !== null`, and every deckCount change in that state bumps `dealNonce` in the same synchronous action, so a stale-deck snapshot always carries a stale nonce. Zustand's two `set` calls inside the click handler batch into one render (React 18 automatic batching), so no intermediate render sees new-deckCount/old-runout.
- **CardPicker wire (priority 4).** `remainingCopies` + own-slot add-back and `setPick`'s `heldByOtherSlots >= deckCount` block are arithmetically consistent (second copy pickable at 2 decks, third blocked, re-pick of the open slot's own card never blocked, A9 titles derived from the same counting source). Pick retention across toggles holds: picks are never cleared by `setDeckCount`, the 2→1 refusal is duplicate-guarded at both the store boundary and the disabled segment, and a 1-deck duplicate-pick state is structurally unreachable. Dealt-hand cards intentionally don't consume picker copies (picks constrain the next deal, which rebuilds from `shoeWithout(deckCount, picked)` — count-aware for double-picked values).
- **Copy-cue derivation (priority 5).** `copyCuedSlots` is a pure function of `(runout, street, revealedMask, deckCount)` over a fixed hero → board-in-street-order → revealed-opponents-by-seat scan; the badge cannot migrate between two simultaneously visible copies (later-in-scan always wears it), reveal chronology cannot influence placement (seat-index tiebreak pinned under both mask construction orders), rewind/advance recompute deterministically in both directions, hidden opponents are never scanned (leak-proof), and the 1-deck path is a structural early return. The documented consequence that a badge can appear on an already-settled earlier-revealed card when a later street/reveal surfaces its twin is a sanctioned UI-SPEC behavior, not flicker. Felt keys stay positional (expression-set proof in 07-04 SUMMARY verified against the shipped `Seat.tsx`/`BoardDisplay.tsx`).
- **lockedInCategory routing (priority 6).** `OddsTable.tsx:32` is the single production caller and passes the live `deckCount` (memo deps include it); the `deckCount = 1` default protects every frozen 1-deck caller; and the `shoePath.guard.test.ts` `evaluateHand(` call-site allowlist (four files, comment-stripped, with demonstrated negative controls) structurally prevents a future unrouted main-thread call site. The `evaluateHandTwoDeck(` token cannot false-negative the sweep (`evaluateHand(` requires the open paren).
- **Standard sweep (priority 7).** No `as any`, no `@ts-ignore`/`@ts-expect-error`, no new `eslint-disable`, no `console.log`/`debugger`/TODO/FIXME anywhere in the phase diff. The two intentional casts (`compareHands as CmpFn` in `equity.ts:88`, `a as Hand` in `compareHandsTwoDeck`) are both guarded by invariants that make them sound (1-deck values can't carry strength 10 or a tiebreak; the stock-stock branch throws on tiebreak-less strength 10). No `.only`/`.skip`/`.todo` in any test file. A11y additions (role=group toggle, aria-pressed, aria-hidden ×2 glyph + visually-hidden sentence, revealed-seat aria-label suffix) are well-formed and DOM-absent at 1 deck. The test-only oracle imports nothing from either production evaluator and is guard-pinned out of the production import graph.
- **06-REVIEW defect-class recurrence check.** CR-01 class (conditioning ignores revealed information): not present — `deriveConditionedState` threads the revealed holes and deckCount end-to-end. CR-02 class (same-key/wrong-generation cache poisoning): the dealNonce guard is intact at `HoldemGame.tsx:133` and covers the new toggle path (analysis above). WR-01 class (hidden-state guard gap): Hold'em's A4 guard reads only user-authored picks — no hidden input exists, correctly distinguished in 07-07's ledger. WR-02 class (dead worker proxy): `workerClient.ts` untouched this phase, fix intact. IN-01 class (selector-less store subscription): one pre-existing instance survives in a phase-modified file — flagged below.

No Critical or Warning defects were found. Two Info items follow.

## Narrative Findings (AI reviewer)

## Info

### IN-01: `OddsTable` still subscribes to the whole odds store — the 06-REVIEW IN-01 class survives in a Phase 7-modified file

**File:** `src/ui/OddsTable.tsx:12`
**Issue:** `const { categoryCounts, trialsCompleted } = useOddsStore();` subscribes with no selector, so every odds-store write re-renders the table — including `settledCache` copy-on-write Map replacements and `clearCache()` calls that change nothing it displays. 06-REVIEW IN-01 fixed exactly this pattern in `BustEvDisplay`/`DealerDistributionDisplay` (commit `efb9699`), establishing the per-field-selector discipline every other store consumer follows — including the four `useGameStore` selectors added to this very component this phase. The line predates Phase 7, but the file was substantially edited here (deckCount subscription, label-source selection, row testid) without bringing it in line, so the fixed defect class now has exactly one surviving instance in the codebase. Harmless at this scale (a few extra renders per user action), but it forfeits Zustand's equality bail-outs and makes this the odd file out for future readers.
**Fix:**
```tsx
const categoryCounts = useOddsStore((s) => s.categoryCounts);
const trialsCompleted = useOddsStore((s) => s.trialsCompleted);
```

### IN-02: `ProgressSnapshot.categoryCounts` doc comment still pins "Length CATEGORY_COUNT" — now wrong for the 2-deck snapshots this phase makes flow through that exact interface

**File:** `src/worker/protocol.ts:48-49`
**Issue:** The `ProgressSnapshot` interface documents `categoryCounts` as `/** Length CATEGORY_COUNT, indexed by HandStrength enum value. */`. After this phase, 2-deck snapshots carry length `CATEGORY_COUNT + 1` with index 10 outside the `HandStrength` enum — the same file's new `categoryCountFor` doc says so, and `TrialBatchResult`'s doc in `equity.ts:38-41` was correctly updated to the "10 or 11" form, making this the one stale spot on the changed interface chain. Concrete trap: a future consumer trusting the comment and iterating `for (let i = 0; i < CATEGORY_COUNT; i++)` over a snapshot would silently drop the Five-of-a-Kind tally (its share would vanish from a sum-to-100% surface with no error, since the oddsStore guard only checks whole-array sums).
**Fix:** Mirror the `TrialBatchResult` wording:
```ts
/**
 * Length `categoryCountFor(deckCount)` — 10 at one deck (indexed by `HandStrength`),
 * 11 at two decks, where index 10 tallies Five of a Kind (D-05).
 */
categoryCounts: number[];
```

---

_Reviewed: 2026-08-25T03:09:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
