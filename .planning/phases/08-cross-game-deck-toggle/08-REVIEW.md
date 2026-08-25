---
phase: 08-cross-game-deck-toggle
reviewed: 2026-08-25T04:51:26Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/ui/DeckCountToggle.tsx
  - src/ui/BlackjackControls.tsx
  - src/ui/HoldemGame.tsx
  - src/ui/DeckCountToggle.test.tsx
  - src/App.deckToggleDom.golden.test.tsx
  - src/App.deckToggleConsolidation.test.tsx
  - src/App.modeShell.guard.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: fixes_applied
fixes_applied_at: 2026-08-25
fixes_applied:
  resolved: 7
  deferred: 0
  suite_after: "65 files / 924 tests (baseline 919, +5 additive guard pins)"
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-25T04:51:26Z
**Depth:** standard (weighted, per the review brief, toward correctness-of-preservation: both rewired call sites diffed against `git show b44f6c6:` originals, the reachable DOM-state space enumerated against the nine-state golden, and every new guard amendment probed for falsifiability)
**Files Reviewed:** 7 (`git diff --name-only b44f6c6..HEAD -- src/`; unchanged dependencies `gameStore.ts`, `blackjackStore.ts`, `pickerStore.ts`, `App.tsx`, `GameModeSwitcher.tsx`, `shoePath.guard.test.ts`, `src/test/setup.ts`, `vite.config.ts` cross-read for call-chain and guard verification)
**Status:** fixes_applied (no Critical — 4 Warning, 3 Info; **all 7 resolved**, see Fix Status below)

## Fix Status (applied 2026-08-25)

All seven findings resolved, one atomic commit each, guard suites green at every commit.

| ID | Status | Commit | Resolution |
|----|--------|--------|------------|
| WR-01 | RESOLVED | `c4e68a4` | Active-segment `disabled`/`title` gated on the segment being inactive (both segments); doc comment restated as an enforced guarantee; "binding rule 6" test extended with the `deckCount={1}` + `oneDeckDisabled` case, asserting operability via a real click, plus the symmetric `twoDecksTitle`-while-active case. Zero rendered bytes change in any reachable state — the nine-state golden stayed green byte-unmodified. |
| WR-02 | RESOLVED | `2ba6442` | Added a path-level pin (`not.toContain('../state/')`) and a case-insensitive `blackjack`/`holdem` name pin (which is also the previously-missing "no game-specific logic" pin). All seven original token assertions kept as additive defence, message de-overclaimed. |
| WR-03 | RESOLVED | `3100979` | Sweep now walks all of `src/` with `{ recursive: true }` + separator normalization (the `shoePath.guard.test.ts` precedent), matching the bare `Deck count` literal — quoting-agnostic and catches the hoisted-constant evasion. Added a falsifiability control (the walk must see `App.tsx`) and a canonical-form pin. Both call-site absence pins made quoting-agnostic. `.test.` exclusion kept and still load-bearing. |
| WR-04 | RESOLVED | `1187299` | Provenance corrected to the procedure actually executed (authored from the serialization rules, then proven by the nine `toBe` assertions passing at `4d85066`), with an independently runnable re-verification recipe and a real regeneration procedure. |
| IN-01 | RESOLVED | `a940b64` | `HoldemGame.tsx` call-site comment trimmed to call-site concerns, matching `BlackjackControls`; the markup/aria/no-op prose now has one home. |
| IN-02 | RESOLVED | `0d14f50` | Both tautological `not.toHaveAttribute(name, value)` pairs collapsed into single exact-value assertions. |
| IN-03 | RESOLVED | `661423e` | `testidPrefix` typed as `DeckTogglePrefix` (hard two-value union, not a widened one — the typo now fails type-check with TS2820). Union lives in `src/ui/deckTogglePrefix.ts` so the component keeps naming neither game and WR-02's pin stays enforceable. |

**Gates after all fixes:** `npx vitest run` 65 files / **924 tests** passing (baseline 919 + 5 additive guard pins: WR-02 +3, IN-03 +2); `tsc -b` clean; `eslint .` clean; `npm run build` clean (pre-existing chunk-size warning only).

**Notes raised while fixing:**

- **Two of WR-04's supporting claims did not survive verification, in both directions.** The executor's stated cause ("the repo's vitest config suppresses console output in run mode") is wrong — the config suppresses nothing. But the reviewer's counter-claim (that a maintainer following the stated procedure "will get output") is also wrong. Verified empirically with a throwaway probe suite at HEAD: **vitest's default reporter surfaces console output only from FAILING tests in run mode**, so the original capture attempt from passing tests genuinely produced nothing. The golden's regeneration procedure and the SUMMARY's retraction both record this verified behaviour rather than either original claim, and the procedure routes through the assertion diff (verified untruncated at these string lengths).
- **`npx tsc --noEmit` is a vacuous gate in this repo.** Root `tsconfig.json` is solution-style (`files: []` + `references`), so it type-checks nothing. The effective type gate is `tsc -b` (what `npm run build` runs). Both were run; only the latter is meaningful. Worth correcting wherever the gate list is carried forward.
- **WR-02 and IN-03 conflict as literally written** — the reviewer's IN-03 snippet exports the prefix union from `DeckCountToggle.tsx`, which would put both game names in the file WR-02's new pin forbids. Resolved by giving the union its own module; both rules now hold. IN-03 also uses a hard union rather than the suggested `DeckTogglePrefix | (string & {})`, which would not have caught the typo at all (and would trip `@typescript-eslint/no-empty-object-type`).

Every fix carries a negative control where one is meaningful: WR-01 (revert the gate → the extended test goes red), WR-02 (inject `useBlackjackOddsStore` → all seven original tokens stay green, both new pins fire), WR-03 (three separate controls: a second emitter in `App.tsx`, one in a new `src/ui/shared/`, and a single-quoted `role={'group'}` at a call site), IN-03 (typo'd prefix → TS2820). All reverted, all suites re-verified green afterwards.


## Summary

Reviewed the Phase 8 consolidation: the new `DeckCountToggle`, both rewired call sites, the pre-extraction nine-state DOM golden, the component contract suite, the cross-game consolidation suite, and the additive `App.modeShell.guard.test.ts` amendment. Sanctioned SUMMARY deviations, the pre-existing `.counter` dead CSS, the stale HMR console artifact, jsdom limits, and style preferences were not re-flagged.

**The extraction itself is behavior-preserving. I could not construct a reachable state in which the shared component renders or behaves differently from the inline originals.** All four findings that matter are about the *defenses* around it — the shared component's silent permissiveness at the prop boundary, two falsifiability holes in the new SC1/D-01 guard sweeps, and a false provenance claim committed into the golden.

**Verified clean (adversarial probes that came back sound):**

- **Reachable DOM-state space is exhausted by the nine-state golden (priority 1).** I enumerated the full variation space rather than trusting the count. Blackjack's toggle DOM is a function of `(deckCount, duplicateOnTable)` only; `duplicateOnTable` is provably false at `deckCount === 1` (a 1-deck shoe cannot deal a duplicate, and after a legal 2→1 switch every later draw comes from `shoeWithout(1, physical)`), so exactly **3** states are reachable — golden states 1-3. Hold'em's is a function of `(deckCount, runout === null, duplicateInPicks)` with `duplicateInPicks` unreachable at `deckCount === 1` (`setPick`'s `heldByOtherSlots >= deckCount` block plus `gameStore.setDeckCount`'s A4 refusal), so exactly **6** states are reachable — golden states 4-9. The golden is complete over both spaces, not merely broad. State 9's shared constant plus its explicit `not.toContain(FRESH_DEAL_TITLE)` is a real A4-beats-A3 tripwire.
- **Attribute presence/order and omission semantics (priority 1).** JSX prop order in `DeckCountToggle.tsx:36-53` matches both pre-extraction originals exactly (`type, data-testid, aria-pressed, [disabled], [title], onClick`). Blackjack's `-2` segment gains a `title={undefined}` prop it did not have inline — React omits the attribute on mount and removes it on update, so serialization is byte-identical, and the segment still carries **no `disabled` key at all** (omission, not `disabled={false}`). No conditional spreading exists anywhere, so there is no attribute-presence path the golden could miss.
- **Handler identity, event object, keys, focus (priority 1).** `onClick={() => onSelect(n)}` is arity-1 and never touches the event object, exactly as `onClick={() => setDeckCount(n)}` did; `onSelect={setDeckCount}` passes each store's stable action reference. The component is module-scope, hook-free, state-free, and takes no `key`, and it sits at a fixed position in each control bar's child list — so positional reconciliation preserves the `<div>`/`<button>` host identities across Hold'em's toggle-triggered fresh deal. `App.holdemDeckToggle.test.tsx`'s `document.activeElement` retention test passes byte-untouched.
- **Prior-phase regression checks (priority 4).** 06-REVIEW WR-01: `duplicateOnTable` (`BlackjackControls.tsx:48-49`) and its rationale essay are entirely outside the diff, `DUPLICATE_GUARD_TITLE` is verbatim with U+2014, and `blackjackStore.setDeckCount:195-197` still refuses the impossible 2→1 switch as the store-boundary backstop. 06-REVIEW CR-02: `HoldemGame.tsx:134`'s `dealNonce` generation guard is untouched, and `BlackjackGame.tsx` is not in the phase diff at all. 07 A3/A4: both call-site ternaries moved character-for-character, with precedence order preserved (`HoldemGame.tsx:243-250`).
- **Cross-game a11y (priority 5).** `App.tsx:24-25` renders the two games under mutually exclusive `mode ===` guards, so the two instances of `aria-label="Deck count"` can never co-exist; the consolidation suite's contradicting-stores case asserts all three testids of the absent game are `null` in both directions. `GameModeSwitcher` co-exists with the toggle but carries a distinct `aria-label="Game mode"`.
- **Standard sweep (priority 5).** Zero `console.log`/`debugger`/TODO/FIXME/HACK, zero `as any`, zero `@ts-ignore`/`@ts-expect-error`, zero new `eslint-disable`, zero `.only`/`.skip`/`.todo` across all seven files. No unused imports or props at either call site — every one of the six props is consumed. Independently re-ran the gates: `npx vitest run` → **65 files / 916 tests, 0 failures**; `npx tsc --noEmit` clean; `eslint` clean on all changed source.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `DeckCountToggle` honours `oneDeckDisabled` even when segment 1 is the ACTIVE segment — the component advertises an invariant it does not enforce

**Status: RESOLVED** (`c4e68a4`) — gating made structural on both segments; test extended with the `deckCount={1}` + `oneDeckDisabled` case.

**File:** `src/ui/DeckCountToggle.tsx:39-41` (and the doc comment's claim at `:20-22`)

**Issue:** Segment 2 is defended structurally — it has no `disabled` prop at all, so no call site can ever disable it. Segment 1 has no such defense: `disabled={oneDeckDisabled}` is applied unconditionally, with no reference to `deckCount`. A call site that passes `deckCount={1}` together with `oneDeckDisabled` renders a segmented control whose only pressed segment is disabled — an inoperable toggle with no visible way back, and a WCAG operable-toggle violation. The same asymmetry applies to `title={oneDeckTitle}`, which will render a tooltip on the active segment if a call site supplies one (07 A3 says "never on the active segment").

This is not reachable today — I traced both predicates and both are structurally one-directional (see the Verified-clean note above) — but the guarantee lives *entirely* in two call-site expressions, while three artifacts describe it as a property of the component: the doc comment says "The active segment is never disabled" in the same breath as the genuinely-enforced "the second segment carries no disabled path at all"; 08-UI-SPEC binding rule 6 says "the component must not add a disabled path for the active segment"; and `DeckCountToggle.test.tsx:164-196` titles itself "binding rule 6" while only ever rendering `deckCount={2}` with the guard on, so the suite cannot distinguish the enforced case from the unenforced one.

Concrete failure scenario: DECK-02's deferred v2.x work adds a third call site (or widens `DeckCount` past 2, the roadmap's own deferred item). Whoever writes that call site reads the doc comment, believes the component protects the active segment, and derives its guard predicate without a direction check — producing a dead control that ships, because no test and no guard in the repo can see it. The asymmetric defense on segment 2 is precisely the pattern that teaches the reader the component *does* handle this.

**Fix:** Make the invariant structural on both segments. Both expressions are byte-identical to today's output in every reachable state (`oneDeckDisabled`/`oneDeckTitle` are only ever truthy while `deckCount === 2`), so the nine-state golden stays green unchanged:

```tsx
// The guard is one-directional BY CONSTRUCTION, not by call-site discipline: the active
// segment can never be disabled and never carries a title (08-UI-SPEC binding rule 6,
// 07 A3). Byte-identical in every reachable state — both call sites' predicates are
// already false whenever segment 1 is active.
const oneDeckActive = deckCount === 1;
// ...
  disabled={oneDeckActive ? undefined : oneDeckDisabled}
  title={oneDeckActive ? undefined : oneDeckTitle}
// ...and symmetrically on segment 2:
  title={deckCount === 2 ? undefined : twoDecksTitle}
```

Then extend `DeckCountToggle.test.tsx` with the case that is currently missing: `deckCount={1}` + `oneDeckDisabled` renders segment 1 **not** disabled and title-free.

### WR-02: The store-free sweep the phase calls "what makes D-01 enforceable" has a demonstrable hole — `blackjackOddsStore` passes all seven tokens, and "no game-specific logic" is unpinned

**Status: RESOLVED** (`2ba6442`) — path-level `../state/` pin + case-insensitive game-name pin added; the seven tokens kept as additive defence.

**File:** `src/App.modeShell.guard.test.ts:323-337`

**Issue:** The sweep is an enumerated-substring list: `gameStore`, `oddsStore`, `pickerStore`, `uiStore`, `blackjackStore`, `gameModeStore`, `zustand`. Substring matching is case-sensitive, and `blackjackOddsStore` — a real store in this repo (`src/state/blackjackOddsStore.ts`) — contains **none** of them: `'oddsStore'` does not match `OddsStore`, and `'blackjackStore'` is not a substring of `blackjackOddsStore`. Verified mechanically:

```
"import { useBlackjackOddsStore } from '../state/blackjackOddsStore';" -> caught by: []
"import { useOddsStore }          from '../state/oddsStore';"          -> caught by: [ 'oddsStore' ]
"import { useBlackjackStore }     from '../state/blackjackStore';"     -> caught by: [ 'blackjackStore' ]
```

Concrete failure scenario: a future phase wants the shared control to dim itself while a run is in flight and reaches for `useBlackjackOddsStore((s) => s.trialsCompleted)`. That single line makes the component game-aware and store-coupled — the exact D-01 violation this sweep exists to prevent — and it passes all seven assertions, the resetAnimations sweep (which reads the file by exact path for a different token), the SC1 pins, the golden (no DOM change), and `tsc`/`eslint`. The guard's own failure message ("this raw-source sweep… is what makes D-01 enforceable") is therefore an overclaim.

Separately, the second binding constraint from the 08-UI-SPEC Prop Contract — "The component contains no game-specific logic" — has **no** pin at all. A `testidPrefix === 'blackjack-deck-toggle' ? … : …` branch inside the component would violate the spec and trip nothing.

**Fix:** Replace the substring enumeration with a path-level pin that cannot be out-enumerated, and add the missing constraint pin (both pass against the shipped file today — its only import is `'../engine/shoe'` and it names neither game):

```ts
it('imports nothing from src/state — no store can reach the shared control (D-01)', () => {
  expect(toggleSource).not.toContain('../state/');
});

it.each(['blackjack', 'holdem'])(
  'contains no reference to %s — the component holds no game-specific logic (08-UI-SPEC Prop Contract)',
  (game) => {
    expect(toggleSource.toLowerCase()).not.toContain(game);
  },
);
```

Keep the seven token assertions as-is (they are additive and catch aliased re-exports); the point is that they must stop being the *only* line of defense.

### WR-03: The SC1 single-source-of-markup sweep only sees flat, non-test `src/ui/*.tsx` — a second emitter in `src/App.tsx` or any `src/ui` subdirectory passes green

**Status: RESOLVED** (`3100979`) — recursive `src/` walk on the bare `Deck count` literal; call-site absence pins made quoting-agnostic; `.test.` exclusion kept.

**File:** `src/App.modeShell.guard.test.ts:421-441` (the readdir sweep), with `:381-395` (the two call-site absence pins)

**Issue:** SC1's source-level claim is "the deck-count markup lives in exactly ONE component." What is actually pinned is narrower in three ways:

1. **Directory scope.** The sweep enumerates `src/ui` only. `src/App.tsx` is a `.tsx` component *outside* `src/ui`, and the two absence pins name only `ui/BlackjackControls.tsx` and `ui/HoldemGame.tsx`. Adding `<div data-testid="x-deck-toggle" role="group" aria-label="Deck count">…</div>` to `App.tsx` leaves all 11 SC1 assertions green — SC1's single-source claim would be false and nothing would say so.
2. **`{ recursive: false }`.** The source comment records "src/ui has no subdirectories today" as a standing assumption (confirmed — zero subdirectories at HEAD) but nothing pins it. The first `src/ui/blackjack/` or `src/ui/shared/` directory silently removes those files from the sweep's view.
3. **Literal quoting.** All three pins key on double-quoted literals. `role='group'` / `aria-label={'Deck count'}` / a hoisted `const GROUP_LABEL = 'Deck count'` evade every one of them. (Prettier's default `jsxSingleQuote: false` makes this the least likely of the three, but it costs nothing to close.)

This matters more than the usual guard nitpick because the phase's checkpoint record (08-03 §9) explicitly reasons *from* this sweep to the conclusion that the exclusion logic is load-bearing and must never be dropped — the sweep is being treated as the authority on single-source-ness while covering less than it claims.

**Fix:** Reuse the complete, already-proven, in-repo pattern from the sibling guard file `src/engine/shoePath.guard.test.ts:180-189` — `productionSourceFiles()` walks `src/` with `{ recursive: true }`, normalizes Windows separators, and filters `.test.` and `.d.ts`. One change subsumes all three gaps:

```ts
const emitters = readdirSync(SRC_DIR, { recursive: true })
  .map((entry) => String(entry).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('.tsx') && !p.includes('.test.'))
  .filter((p) => /aria-label\s*=\s*[{("']*Deck count/.test(readSource(p)));

expect(
  emitters,
  "SC1: the deck-count group markup must exist in exactly one production source file",
).toEqual(['ui/DeckCountToggle.tsx']);
```

That also makes the two per-call-site absence pins redundant rather than load-bearing — keep them, but they stop being the only thing standing between the repo and a second emitter.

### WR-04: The DOM golden's committed provenance comments assert a capture procedure that, by the executor's own record, was never performed

**Status: RESOLVED** (`1187299`) — provenance rewritten to the authored-then-proven procedure; regeneration recipe added; the vitest-console claim retracted in 08-01-SUMMARY after empirical verification.

**File:** `src/App.deckToggleDom.golden.test.tsx:26-27` and `:131-138`

**Issue:** The golden's authority is entirely provenance-based — the file header says so, and it forbids regeneration on that basis ("Regenerating the constants to make this suite pass is PROHIBITED"). Two comments state how the bytes were obtained:

- `:26-27` — "…a verbatim transcription of `screen.getByTestId('{prefix}').outerHTML` as the SHIPPED INLINE markup serialized it — **captured from a live run, never authored by hand.**"
- `:131-138` — "The nine frozen constants. **CAPTURED, not authored** (see the file header): transcribed verbatim from a `console.log(outerHTML)` run against the inline toggles at commit b44f6c6, **logs then removed.**"

08-01-SUMMARY Deviation #2 records the opposite: the `console.log` capture "could not surface output," and "the constants were **written from the plan's documented serialization rules** and then PROVEN equal to the live capture by the nine full-string `toBe` assertions." The constants were authored by hand and verified by assertion. That is an equally strong proof — the SUMMARY argues it convincingly, and I agree — but it is not the procedure the shipped file describes, and "never authored by hand" is a false statement of fact in the one artifact whose whole value is its history.

Two concrete consequences. First, the recorded justification for the deviation ("the repo's vitest config suppresses console output in run mode") does not hold at HEAD: `vite.config.ts` sets only `environment`/`globals`/`setupFiles`, `src/test/setup.ts` touches no console, and my own full-suite run printed `stderr | …` blocks from other suites — so a maintainer who follows the file's stated procedure after a *sanctioned* future DOM change will get output, will not reconcile it with the SUMMARY, and has no way to tell which record is current. Second, an auditor re-deriving the byte-identity claim from the file's own text will look for a capture step in the commit history that does not exist.

**Fix:** Correct the two comments to the procedure actually executed and keep the proof intact — it is the assertion pass, not the transcription, that carries the weight:

```
// Every frozen constant below is the exact `screen.getByTestId('{prefix}').outerHTML`
// string the SHIPPED INLINE markup serialized at commit b44f6c6. The constants were
// written from the documented serialization rules and then PROVEN byte-equal to the live
// inline render by the nine full-string `toBe` assertions passing at commit 4d85066,
// whose tree still contained both inline toggles (a wrong byte would have failed with the
// actual captured string in the diff). That passing run — not a transcription step — is
// the provenance. Re-verify by checking out 4d85066 and running this file.
```

Also drop or correct the "vitest suppresses console output in run mode" claim wherever it is carried forward, so it does not become a repo folk-fact.

## Info

### IN-01: `HoldemGame`'s JSX comment still owns the extracted component's invariant prose, now duplicated verbatim in `DeckCountToggle`

**Status: RESOLVED** (`a940b64`) — call-site comment trimmed to match `BlackjackControls`.

**File:** `src/ui/HoldemGame.tsx:225-231` vs `src/ui/DeckCountToggle.tsx:19-22`

**Issue:** The call-site comment still opens with "Structural twin of the mode switcher… segment labels never change with state; `aria-pressed` alone carries which count is active. The active segment is never `disabled` — clicking it is a harmless no-op routed through the store's same-value early return." Every one of those sentences now describes `DeckCountToggle`'s internals and appears there almost word-for-word. `BlackjackControls` was correctly trimmed in the same commit to call-site concerns only (guard predicate, precomputed titles, "the second segment never carries a title"), so the two call sites now follow different conventions and the Hold'em copy will drift against the component the moment either changes.

**Fix:** Trim `HoldemGame.tsx:225-231` to the call-site-specific half (the no-confirmation-dialog rationale, "the on-table hand NEVER blocks a switch", and the A4-beats-A3 precedence note at `:235-237`), matching what `BlackjackControls.tsx:68-72` now does. Leave the markup/aria/no-op prose in `DeckCountToggle.tsx` as its single home.

### IN-02: Two tautological `not.toHaveAttribute(name, value)` assertions in the consolidation suite

**Status: RESOLVED** (`0d14f50`) — both pairs collapsed into single exact-value assertions.

**File:** `src/App.deckToggleConsolidation.test.tsx:576` and `:599-602`

**Issue:** `expect(segmentOne).not.toHaveAttribute('title', FRESH_DEAL_TITLE)` at `:576` immediately follows `expect(segmentOne).toHaveAttribute('title', DUPLICATE_PICK_GUARD_TITLE)` at `:575`. The negated two-argument matcher passes whenever the attribute is absent *or* holds any other value — so given the preceding line it can never fail, and it adds no coverage while reading like a second independent precedence check. Same shape at `:599-602`. (The suite is otherwise strong on D-09 value discipline; these are the two exceptions.)

**Fix:** Collapse each pair into one exact-value assertion, which already excludes the other string by construction:

```ts
expect(segmentOne.getAttribute('title')).toBe(DUPLICATE_PICK_GUARD_TITLE);
```

### IN-03: `testidPrefix: string` is unconstrained while D-02 makes exactly two prefixes contractual

**Status: RESOLVED** (`661423e`) — hard two-value union in `src/ui/deckTogglePrefix.ts`; typo now fails `tsc -b` with TS2820.

**File:** `src/ui/DeckCountToggle.tsx:4`

**Issue:** The prop is a bare `string`, so `testidPrefix="blackjck-deck-toggle"` compiles. The failure is caught (the isolation and mode-switch suites query the literal testids), but only as a downstream test failure rather than at the boundary where D-02 is stated. The looseness is deliberate — `DeckCountToggle.test.tsx` uses fabricated prefixes to prove the prefix is genuinely a parameter — so a hard two-value union would break that suite.

**Fix:** If tightening is wanted without losing the fabricated-prefix cases, export the contractual union and widen only at the test boundary:

```ts
export type DeckTogglePrefix = 'blackjack-deck-toggle' | 'holdem-deck-toggle';
// props: testidPrefix: DeckTogglePrefix | (string & {});
```

Otherwise this is fine as shipped — recorded so the trade-off is on the record rather than implicit.

---

_Reviewed: 2026-08-25T04:51:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
