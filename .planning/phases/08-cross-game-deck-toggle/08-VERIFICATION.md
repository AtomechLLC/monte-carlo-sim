---
phase: 08-cross-game-deck-toggle
verified: 2026-08-25T19:09:05Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification — no prior 08-VERIFICATION.md existed"
warnings:
  - item: "REQUIREMENTS.md traceability not updated for DECK-02"
    severity: warning
    detail: >-
      Phase 8 is marked complete in ROADMAP.md (completed 2026-08-25) and DECK-02 is
      substantively satisfied in code, but REQUIREMENTS.md still carries DECK-02 as
      "[ ]" with Traceability status "Pending". This is bookkeeping only — no code gap.
      Not unique to this phase (Phase 4's DECK-01/03/04 and Phase 5's BJ-01 are also
      still Pending), but Phases 6 and 7 DID update theirs, so the convention exists
      and Phase 8 did not follow it for its own sole requirement.
    fix: "Tick DECK-02 to [x] and set Traceability status to Complete."
known_limitations:
  - item: "Pixel-level visual inspection never performed by a human"
    detail: >-
      Frame-dependent live-browser verification rests on automated evidence plus the
      orchestrator's frame-independent live checks in real Chromium (the browser pane
      suspends rAF while hidden, blocking screenshot compositing). Recorded in
      08-03-SUMMARY's Post-Merge Live-Browser Addendum with an explicit attribution
      caveat. Structurally this phase cannot change pixels — the CSS diff is empty and
      the nine-state DOM golden freezes every rendered byte — but nobody has looked.
      Recorded as a limitation, NOT a failure.
---

# Phase 8: Cross-Game Deck-Count Toggle UI — Verification Report

**Phase Goal:** Users control deck count for either game through one consistent, shared control component that immediately cancels and recomputes odds under the new shoe.
**Verified:** 2026-08-25T19:09:05Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1** — A single shared deck-count control component appears in both Hold'em's and Blackjack's control bar, always reflecting the active game's current deck count | VERIFIED | Three-part argument, all three legs re-proven below |
| 2 | **SC2** — Changing deck count in either game immediately cancels any in-flight simulation and recomputes all odds under the new shoe, with no stale numbers left on screen | VERIFIED | 4 consolidation cases with worker-payload-level assertions; distinct-value fixtures prove freshness; confirmed live in Chromium |
| 3 | **SC3** — The control follows the same "takes effect on next deal" discipline as the card picker — no disruptive mid-hand mutation | VERIFIED (satisfied-by-interpretation, D-05) | Interpretation is carried **visibly** in 4 artifacts, not silently claimed; 2 positive test cases |
| 4 | **DECK-02 clause 1** — User can toggle deck count (1 or 2) **per game** | VERIFIED | Separate stores; contradicting-stores round-trip test with DOM-absence assertions in both directions |
| 5 | **DECK-02 clause 2** — Changing it cancels any in-flight simulation and recomputes all odds under the new shoe | VERIFIED | Same evidence as SC2, at the payload boundary |

**Score:** 5/5 truths verified

---

## SC1 — The Three-Part Argument, Re-Proven

SC1 is not provable by a single artifact. The phase argues it three ways; I confirmed all three independently hold at HEAD.

### Leg 1 — The shared component exists and is the only one

| Check | Evidence |
|-------|----------|
| Component exists, substantive | `src/ui/DeckCountToggle.tsx` — 83 lines, real segmented-control JSX, 6-prop contract |
| Store-free by construction | Imports only `../engine/shoe` (type) and `./deckTogglePrefix` (type). Zero `../state/` |
| Exactly two production importers | `src/ui/BlackjackControls.tsx:3`, `src/ui/HoldemGame.tsx:8` — no others |
| Both actually **mounted** (Level 3 wiring) | `BlackjackGame.tsx:224` renders `<BlackjackSessionControls />` (which returns the toggle); `HoldemGame.tsx:250` renders it in the session bar |
| Per-game prefix contract preserved (D-02) | `testidPrefix="blackjack-deck-toggle"` / `"holdem-deck-toggle"`, typed as a hard union |
| Reflects the **active** game's count | `deckCount={deckCount}` sourced from each game's own store; proven by truth #4 |

### Leg 2 — The nine-state DOM golden (byte-identity across the extraction)

This is the strongest single artifact in the phase, and its force depends entirely on **commit ordering**. I verified the ordering against git rather than trusting the file's own header:

```
git log --oneline -1 4d85066
  -> 4d85066 test(08-01): freeze pre-extraction deck-toggle DOM as a nine-state outerHTML golden
git show 4d85066:src/ui/BlackjackControls.tsx | grep 'role="group"'
  -> 71:  <div data-testid="blackjack-deck-toggle" role="group" aria-label="Deck count">
git show 4d85066:src/ui/HoldemGame.tsx | grep 'role="group"'
  -> 234: <div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count">
git show 4d85066:src/ui/DeckCountToggle.tsx
  -> fatal: path ... exists on disk, but not in '4d85066'
```

The golden was frozen in a tree where **both inline toggles still rendered the markup and the shared component did not yet exist**. And the constants were never regenerated afterwards:

```
git log --oneline -- src/App.deckToggleDom.golden.test.tsx
  -> 1187299 docs(08): WR-04 correct the DOM golden's provenance ...
  -> 4d85066 test(08-01): freeze pre-extraction deck-toggle DOM ...
git diff 4d85066..HEAD -- src/App.deckToggleDom.golden.test.tsx | grep -E "^[-+]const|^[-+]  '<div"
  -> (empty)
```

The only post-freeze commit touched comments (WR-04 provenance). Nine `toBe` full-`outerHTML` assertions pass at HEAD against the **shared** component. Therefore the extraction is byte-preserving — D-06 and 08-UI-SPEC A2 hold as a proof, not a claim.

Spot-check of the frozen bytes also independently corroborates WR-01's "zero rendered bytes changed" claim: `BJ_IDLE_1_DECK` shows segment 1 with `aria-pressed="true"` and **no** `disabled` attribute, while `BJ_GUARD_2_DECKS` shows `disabled=""` only when segment 1 is inactive. Segment 2 carries no `disabled` attribute in any of the nine states.

### Leg 3 — Source-identity guard pins (falsified, not assumed)

I did not accept these pins on inspection. I injected the exact evasions they were written to close and confirmed each fires, then reverted (`git status src/` clean afterwards).

| Probe | Injected | Result |
|-------|----------|--------|
| WR-03 single-source sweep | Second emitter in `src/App.tsx` using **both** documented evasions at once — a hoisted `const GROUP_LABEL = 'Deck count'` and single-quoted `role={'group'}` | **FIRED** — `expected [ 'App.tsx', 'ui/DeckCountToggle.tsx' ] to deeply equal [ 'ui/DeckCountToggle.tsx' ]` |
| WR-02 store-free pin | `import { useBlackjackOddsStore } from '../state/blackjackOddsStore'` — the precise store that slipped past all seven original tokens | **FIRED (both new pins)** — the `../state/` path pin and the case-insensitive `blackjack` name pin |
| WR-01 structural gating | Reverted `disabled`/`title` to the unconditional form | **FIRED** — "binding rule 6" test goes red |

The sweep also carries its own falsifiability control (`productionTsxFiles` must contain `App.tsx`), so a green result is not reachable from an empty or still-`ui`-only listing.

---

## SC2 — Cancel and Recompute

Verified in `src/App.deckToggleConsolidation.test.tsx` describe block 2, one case per game per state. The assertions read the **payload that crossed the worker boundary**, not a store field that might coincidentally agree:

| Case | Cancel evidence | Recompute-under-new-shoe evidence | No-stale evidence |
|------|-----------------|-----------------------------------|-------------------|
| Blackjack mid-round | Restarted run mocked to hang, making the same-frame reset observable | `startBlackjack.mock.calls[1][0].deckCount === 2`; `remainingDeck` length **101** (= 104 − 3 visible) | Counter → `'0'`; all 13 stat cells → em dash; subtitle moves to "2-deck shoe" in the same frame |
| Blackjack resolved | Nothing in flight — correctly sets pending count only | `startBlackjack` still called once (no spurious run) | All 13 retained values byte-identical pre/post (A16 compare-your-EV moment survives) |
| Hold'em mid-hand | `dealNonce` 1→2 (CR-02 generation bump), `settledCache` 3→1 | `startSim.mock.calls[3][0].deckCount === 2`; `categoryCounts` length **11** (Five of a Kind only exists at 2 decks) | Displayed win% goes `52.0%` → `53.0%` with an explicit `not.toBe(winPctBefore)` |
| Hold'em idle | Nothing in flight; `startSim` not called | Selection flips only, `dealNonce` stays 0 | N/A |

The 11-vs-10 histogram length is the independent proof of *which shoe conditioned the run* — it cannot be faked by a store field.

**Live confirmation:** the orchestrator drove real Chromium post-merge and confirmed both cancel/recompute paths frame-independently (08-03-SUMMARY addendum items 3 and 4), including the Hold'em category table going 11 → 10 rows on the reverse switch.

---

## SC3 — Satisfied-by-Interpretation, Carried Honestly

**This was a specific audit target: the interpretation must be visible as an interpretation, never silently passed off as literal compliance.** It is. The D-05 reading is carried in four places, each self-labelling:

| Artifact | How it is carried |
|----------|-------------------|
| `08-CONTEXT.md` D-05 | The originating decision, stating SC3 "is recorded as satisfied-by-interpretation in the phase verification, with this decision as the citation" |
| `08-03-SUMMARY.md:256` | Coverage table row reads **"COVERED — satisfied by interpretation, citing D-05"** — not "COVERED" |
| `08-03-SUMMARY.md:258` | Full four-ground reasoning restated on the record (T-08-20) |
| `App.deckToggleConsolidation.test.tsx:453` | The **describe block name itself**: `'SC3: no disruptive mid-hand mutation — recorded satisfied-by-interpretation (08-CONTEXT D-05)'`, with a block comment forbidding any assertion that would force the literal reading |

Putting the qualifier in the executable test name is the strongest available form — it cannot be lost when the suite is read or summarized.

**The interpretation is also substantively sound**, backed by two positive test cases rather than an absence argument:
- Blackjack re-runs over the **same visible cards**: unchanged `roundNonce`, same `playerHand`, same upcard, `revealedHole` still false, phase still `player-turn`, hole identity still DOM-absent.
- Hold'em **visibly replaces** the hand via the full fresh-deal choreography, and **discloses it before the click** — `title="Switching the shoe deals a fresh hand"` on the inactive segment, never on the active one, and the disclosure swaps sides after the switch.

A literal "next deal only" reading would undo Phase 6's locked, shipped, verified BJ-07 findability behavior — the mid-round re-run *is* the feature. Forcing it would be a regression, not a fix. I concur with the interpretation.

---

## Review Fix Verification (7/7 present in source)

| ID | Claim | Verified | How |
|----|-------|----------|-----|
| WR-01 | Structural disabled/title gating on both segments | YES | `DeckCountToggle.tsx:66-67,76` — `oneDeckActive ? undefined : …`, `twoDecksActive ? undefined : …`; segment 2 has no `disabled` prop at all. **Negative control fired** |
| WR-02 | Store-free sweep hole closed | YES | `App.modeShell.guard.test.ts:354-361` (`../state/` path pin) + `:373-376` (case-insensitive game-name pin). **Both negative controls fired** |
| WR-03 | Recursive markup sweep | YES | `:517-549` — `readdirSync(SRC_DIR, { recursive: true })`, separator normalization, bare `Deck count` literal, `App.tsx` falsifiability control, canonical-form pin, quoting-agnostic call-site pins. **Negative control fired** |
| WR-04 | Golden provenance corrected | YES | Provenance rewritten to authored-then-proven; **every factual claim in it independently verified against git** (see SC1 Leg 2). Retraction of the vitest-console folk-fact present in `08-01-SUMMARY.md:156-157` as strikethrough + correction |
| IN-01 | Hold'em call-site comment trimmed | YES | `HoldemGame.tsx:235-249` — call-site concerns only, explicitly recording the trim; invariant prose lives once in `DeckCountToggle.tsx` |
| IN-02 | Tautological assertions collapsed | YES | Zero `not.toHaveAttribute(name, value)` pairs remain in the consolidation suite |
| IN-03 | `testidPrefix` hard union | YES | `src/ui/deckTogglePrefix.ts:20` — two-value union in its own module (so WR-02's name pin stays enforceable); `DeckCountToggle.tsx:8` consumes it |

Note the WR-02/IN-03 conflict was resolved correctly: putting the union in its own module lets both rules hold simultaneously. Verified — `DeckCountToggle.tsx` names neither game in any casing, and the guard pin enforcing that passes.

---

## Sanctioned Retargets (post-Phase-8 user-directed visual work)

The control bar was reorganized twice, the felt enlarged, the deck regenerated, a CSS 3D tilt added and the blackjack table made half-moon — all user-directed, **not** Phase 8 deliverables. Two Phase 8 pins were retargeted for them. Per the brief I confirmed each retarget **preserved the assertion's force**. Both did more than preserve it:

| Pin | Before | After | Verdict |
|-----|--------|-------|---------|
| 08-UI-SPEC A2 last-child (`App.holdemDeckToggle.test.tsx`) | `sessionRow.lastElementChild === toggle` + parent check | `sessionBar.lastElementChild === toggle` **plus** a new `compareDocumentPosition` assertion that the bar precedes the felt; role/aria-label/both labels untouched | **STRENGTHENED** — gained an assertion. The comment explicitly forbids relaxing it to `toBeInTheDocument()` |
| Felt-subtree control census (`App.modeSwitch.test.tsx`) | `toHaveLength(1)` + one testid check | Exact **ordered array** of all four testids, **plus** explicit `scene.contains(deck-toggle) === false` and same for the mode switcher | **STRENGTHENED** — exact census kept (not relaxed to `toBeGreaterThan`), and the deck toggle's off-felt position is now positively pinned |

Both carry in-file comments recording the user request that motivated the change. Neither is drift; neither weakened. Notably the second retarget *adds* a Phase-8-relevant guarantee — the shoe toggle must stay off the felt.

---

## Regression Gates (all run fresh at HEAD)

| Gate | Command | Result |
|------|---------|--------|
| Full suite | `npx vitest run` | **72 files / 1134 tests passed**, 0 failures |
| Typecheck (**the real gate**) | `npx tsc -b` | exit 0, clean |
| Lint | `npx eslint .` | exit 0, clean |
| Build | `npm run build` | clean — 490 modules, pre-existing chunk-size warning only |

`npx tsc --noEmit` was **not** used as evidence: root `tsconfig.json` is solution-style (`files: []` + `references`), making it vacuous in this repo. This matches the correction raised in 08-REVIEW's fix notes.

Working tree left clean after all negative-control probes (`git status --short src/` empty).

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/App.deckToggleDom.golden.test.tsx:71,177` | The literal string `console.log` | Info — **false positive** | Both occurrences are *prose inside the corrected provenance comments* describing why the console channel was not used. No executable debug statement |

Zero `TBD` / `FIXME` / `XXX` debt markers across all eight Phase 8 files — the debt-marker gate passes. Zero `as any`, `@ts-ignore`, `@ts-expect-error`, `.only`, `.skip`, `.todo`, `eslint-disable`, `debugger`.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DECK-02 | 08-01/02/03 | Toggle deck count (1 or 2) **per game**; changing it cancels in-flight simulation and recomputes all odds under the new shoe | **SATISFIED in code** | Clause 1: separate `gameStore.deckCount` / `blackjackStore.deckCount`, no shared store, contradicting-stores round-trip test. Clause 2: SC2 evidence above |

**Warning — traceability not updated.** `REQUIREMENTS.md` still lists DECK-02 as `[ ]` with status `Pending`, while ROADMAP.md marks Phase 8 complete. This is bookkeeping only; the requirement is substantively met. It is not unique to Phase 8 (Phase 4's DECK-01/03/04 and Phase 5's BJ-01 are also stale), but Phases 6 and 7 *did* update theirs — so the convention exists and was not followed here for this phase's sole requirement. One-line fix; does not block the goal or the next phase.

---

## Known Limitation (recorded, not a failure)

Frame-dependent live-browser verification rests on automated evidence plus the orchestrator's **frame-independent** live checks. The browser pane suspends rAF while hidden, so screenshot compositing is unavailable and no human has inspected pixels.

What *was* verified live in real Chromium (08-03-SUMMARY Post-Merge Live-Browser Addendum): the shared toggle rendering identically in both games (only the testid prefix differs), per-game independence across two mode round trips with zero cross-game testid leakage, and both SC2 cancel/recompute paths. Zero new console errors.

What remains unobserved: pixel-level visual appearance. The empty CSS diff plus the byte-identical nine-state golden make a visual change structurally impossible, but the record honestly states nobody looked, and carries an explicit attribution caveat that verification was agent-performed under a standing no-operator-input directive rather than personally observed by a human. That honesty is itself the right outcome — the phase recorded unobservable halves as NOT VERIFIED rather than assumed-pass (T-08-23).

---

## Gaps Summary

**None blocking.** The phase goal is achieved in the codebase.

I began from the hypothesis that the tasks completed but the goal was missed, and tried to break the phase's central claims rather than confirm them. The three claims most likely to be hollow all survived direct attack:

1. **"One shared control" could have been a cosmetic extraction** that quietly changed the rendered DOM. It did not — and the proof is structural, not narrative: the nine-state golden was frozen in a tree that provably predates the shared component, its constants are byte-untouched since, and it passes at HEAD.
2. **The new guard pins could have been decorative.** They are not. All three fixed sweeps fired against the exact evasions they were written to close, including the hoisted-constant + single-quote combination and the `blackjackOddsStore` case that defeated the original seven-token list.
3. **SC3 could have been a literal miss dressed up as compliance.** It is an interpretation, and it is labelled as one everywhere it appears — including in the executable test name, where it cannot be lost. The interpretation is substantively correct: forcing the literal reading would regress Phase 6's shipped BJ-07 behavior.

One non-blocking warning: `REQUIREMENTS.md` should tick DECK-02 to `[x]` / Complete.

---

_Verified: 2026-08-25T19:09:05Z_
_Verifier: Claude (gsd-verifier)_
_Mode: goal-backward, FORCE adversarial stance_
