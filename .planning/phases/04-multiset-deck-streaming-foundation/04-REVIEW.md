---
phase: 04-multiset-deck-streaming-foundation
reviewed: 2026-08-24T18:02:27Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/engine/conditioning.ts
  - src/engine/deckParity.golden.test.ts
  - src/engine/equity.ts
  - src/engine/multisetSampling.property.test.ts
  - src/engine/shoe.test.ts
  - src/engine/shoe.ts
  - src/engine/shoePath.guard.test.ts
  - src/state/pickerStore.test.ts
  - src/state/pickerStore.ts
  - src/ui/CardPicker.tsx
  - src/ui/node-builtins.d.ts
  - src/worker/simulationApi.ts
  - src/worker/streamingParity.golden.test.ts
  - src/worker/streamingRunner.test.ts
  - src/worker/streamingRunner.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-24T18:02:27Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the Phase 4 multiset-deck / streaming-runner foundation adversarially: the count-aware
`shoeWithout` subtraction, `ConditionedState.deckCount` optional-with-default-1 semantics, the
generalized worker validation, the extracted generic streaming runner, count-aware picker
blocking, and all five new/golden/guard test files. Full suite passes (281/281).

**Parity verification performed (not found wanting):**
- `shoeWithout(1, x)` walks `buildShoe(1)` (= `FULL_DECK`) in order with a count budget — provably
  order-identical to v1 `deckWithout(x)`, and property-tested against it including duplicate
  excluded values. The one-copy-per-occurrence budget (`shoe.ts:70-82`) is correct, including
  over-exclusion (never negative) and the DECK-01 headline case.
- Line-by-line diff of the extracted `streamingRunner.ts` against the pre-refactor
  `simulationApi.ts` at 91d6504 confirms identical observable semantics for the Hold'em config:
  validate-before-token-assignment (a rejected request never supersedes a healthy in-flight run),
  merge-then-supersession-check ordering, identical emit condition
  (`lastEmitAt === null || done || now - lastEmitAt >= progressIntervalMs`), identical done
  emission and post-done return, identical `setTimeout(0)` yield, identical `cancel()` guard, and
  identical `onProgress`-throw propagation (rejects the run promise, leaves tokens pointing at the
  dead run — same as v1).
- `deckCount` is read in exactly one place (`simulationApi.ts:42`) with `?? 1`; the only producer
  (`deriveConditionedState`) always sets it explicitly (default parameter 1), and both frozen
  hand-built test states (field absent) and derived states (field = 1) validate identically.
  No call site defaults differently in the engine/worker path. The one latent default-mismatch is
  in the picker UI (WR-01).
- The golden files are NOT tautological: `deckParity.golden.test.ts` pins exact 50/47/41-card
  ordering strings (analytically consistent with v1 `deckWithout`'s filter order) plus exact
  seeded 5000-trial tallies; `streamingParity.golden.test.ts` additionally pins emission SHAPE
  (snapshot count 4, `trialsCompleted` sequence [5000,10000,15000,20000]) and `done`/`requestId`,
  so a chunk-boundary or throttle-gating regression fails loudly, and the guard test pins both
  files against `.skip`/`.todo` neutering and deletion (readFileSync throws on a missing file).
- New frozen-error-string behavior verified: for every case in the frozen `simulationApi.test.ts`,
  the new per-value budget check produces byte-identical error messages (same cards, same order)
  as v1's Set-intersection check at deckCount=1.

Remaining findings are below: one latent UI/store default mismatch explicitly invited by its own
comment, two validation gaps at the worker boundary, one demonstrable bypass of the source-shape
guard, and six smaller robustness/documentation issues.

## Warnings

### WR-01: CardPicker calls `setPick` without `deckCount` — the documented "single line" Phase 8 migration desyncs UI availability from store blocking

**File:** `src/ui/CardPicker.tsx:42` (with `src/ui/CardPicker.tsx:16-22`)
**Issue:** `handlePick` calls `setPick(openSlot, card)` with no third argument, so the store falls
back to its own `deckCount = 1` default, while `isUsed` (line 53) reads the module-level
`deckCount` const. The comment at lines 16-21 explicitly claims `const deckCount: DeckCount = 1`
is "the single line Phase 8's cross-game deck-count toggle will replace." That claim is false: if
Phase 8 changes only that line to 2 (exactly as instructed), `isUsed` renders a second copy of an
already-picked card as available, the user clicks it, `setPick` silently no-ops at its default of
1 (`heldByOtherSlots >= 1`), and the dialog closes having recorded nothing — a silent lost pick.
This is precisely the class of one-call-site-defaults-differently bug this phase's design warns
about; the code plants it behind a comment that asserts the opposite. Behavior today is correct
only because both values happen to be 1.
**Fix:**
```tsx
function handlePick(card: Card) {
  if (openSlot === null) return;
  setPick(openSlot, card, deckCount);
  dialogRef.current?.close();
}
```
(and the "single line" comment then becomes true).

### WR-02: `validateConditionedState` never validates `deckCount` itself

**File:** `src/worker/simulationApi.ts:42`
**Issue:** Every other field of the wire-crossing `ConditionedState` gets a shape check
(`heroHole.length`, `knownBoard.length` against `VALID_BOARD_LENGTHS`, `knownOpponentHoles.length`),
but the one field this phase ADDED to the wire contract is read with `?? 1` and trusted. The
`DeckCount = 1 | 2` union is erased at the Comlink/structured-clone boundary, so a malformed or
stale caller can deliver `deckCount: 0` (expected length goes to `-13`, producing the nonsense
error "remainingDeck must have exactly -13 cards"), `deckCount: 3+` (a garbage state validates
"successfully" and proceeds to sample), or a non-integer. `knownBoard.length ∈ {0,3,4,5}` is
exactly the same kind of literal-union constraint and IS validated — `deckCount ∈ {1,2}` should be
too, given this function's stated defence-in-depth purpose ("malformed internal calls... fail
loudly").
**Fix:**
```ts
const deckCount = conditioned.deckCount ?? 1;
if (deckCount !== 1 && deckCount !== 2) {
  throw new Error(`runSimulation: deckCount must be 1 or 2, got ${String(conditioned.deckCount)}`);
}
```

### WR-03: A `deckCount: 2` request passes validation but crashes nondeterministically mid-stream in the evaluator

**File:** `src/worker/simulationApi.ts:39-49` (crash site `src/engine/equity.ts:79-80`)
**Issue:** The generalized validation deliberately accepts 2-deck states (comment, lines 39-41),
but the downstream trial engine cannot run them this phase: `runTrials` → `evaluateHand` throws
`TypeError: C is not iterable` whenever a drawn sample puts a duplicate rank+suit into one
player's 7 cards — empirically confirmed by this phase's own test comment
(`multisetSampling.property.test.ts:91-98`; duplicate-aware evaluation is Phase 7 scope). Because
the collision is per-trial probabilistic, a 2-deck `runSimulation` call can emit several
valid-looking progress snapshots and THEN reject mid-run with a cryptic evaluator TypeError — the
exact opposite of the entry-point fail-loudly design, and an error path no golden can see. Nothing
prevents an internal caller from wiring `deriveConditionedState(..., 2)` into the worker today.
**Fix:** In the Hold'em-specific `validateConditionedState` (keeping the generic runner
deck-agnostic), reject 2-deck runs with a clear message until Phase 7 lands, e.g.:
```ts
if (deckCount === 2) {
  throw new Error(
    'runSimulation: deckCount=2 trial evaluation is not yet supported (duplicate-aware evaluation is Phase 7)',
  );
}
```
If acceptance is intentionally kept as foundation posture, at minimum document the
nondeterministic mid-run TypeError on `createSimulationApi` so the Phase 5/7 integrator is not
ambushed.

### WR-04: The shoe-path source guard is bypassable by the most likely regression shape, and the picker's 2-deck path has no behavioral backstop

**File:** `src/engine/shoePath.guard.test.ts:28-59`
**Issue:** The guard bans only the strings `Set<Card>` and `new Set(`. The historically-real
value-collapse shape this module exists to prevent — membership-scan dedup such as
`pool.filter((c) => !excluded.includes(c))` or `indexOf`-based checks (explicitly called out as
the bug class in `shoe.ts:60-63`) — contains neither string and sails through the guard. For
`shoe.ts`/`conditioning.ts` the multiset-closure property tests would still catch such a rewrite
behaviorally, but for `ui/CardPicker.tsx` there is NO behavioral 2-deck coverage at all
(`deckCount` is pinned to 1, and no component test exercises count-aware disabled-state
rendering), so an `.includes`-based `isUsed` rewrite would pass the guard AND every existing test
while silently reintroducing value-collapse into the picker. The guard is the phase's stated
enforcement mechanism (T-04-22), so its bypassability is a real reliability gap.
**Fix:** Extend the guard for the picker path (e.g. assert `CardPicker.tsx`/`pickerStore.ts` do
not contain `.includes(` / `.indexOf(` over card collections, or assert they DO contain the
`remainingCopies(` call), and/or add a `CardPicker` component test that mounts with `deckCount=2`
(once WR-01's plumbing exists) asserting a once-picked card stays enabled.

## Info

### IN-01: `remainingCopies` docstring claims to be the single source for `setPick`'s block threshold — `setPick` doesn't use it

**File:** `src/state/pickerStore.ts:54-64` vs `src/state/pickerStore.ts:80-85`
**Issue:** The docstring says remainingCopies is "The single shared source of 'how many more times
can this card be picked' for both `setPick`'s block threshold and the picker UI's disabled-state
rendering — never duplicate this counting elsewhere." But `setPick` hand-rolls its own count
(`heldByOtherSlots` filter, with different exclude-self semantics). The two are currently
consistent, but the false claim invites exactly the drift it warns against — a future fix applied
to one counting path and not the other.
**Fix:** Either reword the docstring to name only the UI rendering path, or refactor both onto a
shared exclude-self helper (e.g. `remainingCopiesExcludingSlot(picks, card, slot, deckCount)`).

### IN-02: The runner double-tracks `trialsCompleted` and the `runBatch` exact-count contract is implicit

**File:** `src/worker/streamingRunner.ts:108-115` (and `src/worker/simulationApi.ts:97`)
**Issue:** The runner counts `trialsCompleted += trialsThisBatch` (requested) while `mergeBatch`
separately folds `batch.trialsCompleted` (reported) into `totals.trialsCompleted`; `toSnapshot`
uses the runner's counter and ignores the totals field. Identical for Hold'em (`runTrials` always
completes exactly `trialCount`), but the generic contract silently assumes every future game's
`runBatch` completes exactly the requested count — a batch that under-delivers would inflate
`trialsCompleted`, reach `done` early, and emit snapshots whose two counters disagree, with
nothing enforcing or documenting the assumption.
**Fix:** Document on `StreamingRunnerConfig.runBatch` that it MUST execute exactly `trialCount`
trials, or derive the runner's counter from the batch result instead of the request.

### IN-03: The generalized overlap check is strictly STRICTER than v1 at deckCount=1; the "collapses to the original rule" comment is inaccurate

**File:** `src/worker/simulationApi.ts:51-78`
**Issue:** v1's Set-intersection check only flagged remainingDeck entries that appeared among
known cards. The new per-value budget additionally rejects a remainingDeck containing two copies
of an UNKNOWN card at deckCount=1 (0 known + 2 seen > 1) — an input v1 silently accepted (when
paired with a compensating missing card, the length check also passed) and then sampled
incorrectly. This is an improvement, but it is a behavior change on an error path the goldens
cannot see, and the comment's claim that "At deckCount=1 this collapses to the original rule"
undersells it. (Verified separately: for all known-card overlaps the error message is
byte-identical to v1 — same cards, same order — so the frozen tests hold.)
**Fix:** Amend the comment: at deckCount=1 the check is a strict superset of the original rule —
it also catches internal remainingDeck duplicates of unknown values.

### IN-04: No guard against degenerate `SimulationOptions` in the now-generic runner (`batchSize: 0` spins forever)

**File:** `src/worker/streamingRunner.ts:67-69, 111-112`
**Issue:** `batchSize: 0` (or negative) makes `trialsThisBatch` 0 forever: `done` never becomes
true and the loop spins emitting zero-progress snapshots indefinitely (yielding each pass).
Faithfully inherited from v1 — correct under the parity mandate — but this code is now shared
infrastructure that Phase 6's Blackjack config will parameterize, so the footgun's blast radius
grew.
**Fix:** Clamp or assert once at creation: `if (batchSize <= 0) throw new Error(...)` (or
`Math.max(1, batchSize)`), plus the same for `maxTrials`.

### IN-05: No test proves a validation-rejected request leaves an in-flight run undisturbed

**File:** `src/worker/streamingRunner.ts:91-94` / `src/worker/streamingRunner.test.ts:233-253`
**Issue:** The comment at lines 91-93 makes a specific behavioral promise — "a rejected request
never supersedes a healthy in-flight run" — that depends on `validate` being called before the
token assignment. The runner test suite covers validate-throws-with-no-snapshots, but no test
starts run A, fires a validation-failing run B, and asserts run A keeps emitting to completion.
Reordering those four lines would break the promise while every current test stays green.
**Fix:** Add a runner test: start a long run, invoke `runSimulation` with a throwing `validate`,
assert the rejection AND that the first run still reaches `done: true`.

### IN-06: Hard-coded cross-file line-number citations will rot silently

**File:** `src/engine/shoe.test.ts:123-127`, `src/engine/multisetSampling.property.test.ts:30, 59`
**Issue:** Comments cite "conditioning.test.ts line 111" and "line 132" (and the guard-test
comments repeat the pattern). Both are accurate today (verified), but the guard test pins those
sibling properties by STRING, not position, so any future edit to `conditioning.test.ts` shifts
the lines and the citations decay into misdirection with nothing to catch it.
**Fix:** Cite by property title (which IS guard-pinned) instead of line number.

---

_Reviewed: 2026-08-24T18:02:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
