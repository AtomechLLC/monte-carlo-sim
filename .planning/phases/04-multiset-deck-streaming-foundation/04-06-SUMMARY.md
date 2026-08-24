---
phase: 04-multiset-deck-streaming-foundation
plan: 06
subsystem: verification
tags: [phase-acceptance, source-guard, parity-evidence]

requires:
  - Plans 04-01 through 04-05 merged and green
provides:
  - DECK-01 shoe-path source guard (structural, falsification-tested)
  - Phase 4 acceptance: v1-parity evidence collated across every gate
affects: []

key-files:
  created:
    - src/engine/shoePath.guard.test.ts
  modified:
    - src/ui/node-builtins.d.ts

status: complete
---

# Plan 04-06 Summary — Phase 4 Gate: Source Guard & Acceptance

**One-liner:** The DECK-01 source guard is in and falsification-tested, and the full parity gate inventory — byte-frozen artifacts, goldens, 281/281 tests, clean build — proves the multiset/runner foundation landed with zero behavioral drift at deckCount=1.

## Task 1 — Source guard + untouchable-artifact pins (commit `ada1cc0`)

- `src/engine/shoePath.guard.test.ts`: 12 tests structurally forbidding Set-based collapse in the shoe path; falsification-verified (a deliberately inserted `new Set<Card>` failed the guard with the intended message, then was reverted).
- `src/ui/node-builtins.d.ts` extended (scoped `readFileSync` shim; browser tsconfig stays Node-free).
- Suite 269 → 281, tsc/eslint green.

## Task 2 — Phase acceptance (checkpoint resolution)

**Attribution caveat (verbatim per protocol):** Verification was performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with `npm run dev`.

**Gate-inventory evidence (all automated, all green):**
- Full suite **281/281** — includes the 8 golden-parity tests (04-01), 19 shoe tests, 4 multiset/DECK-03 properties, 10 count-aware picker tests, the FROZEN 13-test `simulationApi.test.ts`, 12 guard tests, and every v1 acceptance suite unchanged.
- **Byte-frozen artifact check** vs pre-phase base `91d6504`: `src/worker/simulationApi.test.ts` and `src/engine/equity.property.test.ts` byte-identical (`git diff --quiet` = 0). Golden files created in 04-01, untouched since.
- `npm run build` exit 0 (worker chunk healthy); `npx tsc -b`, `npx eslint .` exit 0.

**Live browser observation (partial):** post-merge, a real-browser session observed deal convergence and street advance to Flop/Turn functioning normally. The full 9-step sweep was then cut short by an environmental condition: the Browser pane became fully hidden (`document.visibilityState === "hidden"`, 0 rAF ticks/1.5s measured), under which the browser suspends animation frames entirely — Motion completion callbacks cannot fire and the animation gate correctly defers odds until the tab is visible again. This is standard browser behavior for hidden tabs (nothing to see odds against), not a Phase 4 regression: the gate mechanism is untouched this phase, and the identical suspension applies to shipped v1.0 behavior.

**Informational note (not a gap):** "Hidden tab defers odds until visible" is worth a line in future docs; if ever undesired, Motion's reducedMotion/visibility handling could force-complete on `visibilitychange`. Logged as an observation only.

## Defects Found

None. All four roadmap success criteria are satisfied by the automated inventory:
1. deckCount=1 byte-parity — goldens + frozen artifacts + unchanged suites ✓
2. 2-deck multiset invariants — shoe closure + DECK-03 no-replacement properties ✓
3. Count-aware picker blocking — 10 tests incl. blocked-at-1/blocked-at-2 ✓
4. Streaming runner behavior-preserving — frozen simulationApi.test.ts passes unchanged ✓

## Deviations

Checkpoint resolved via agent-collated evidence rather than human observation (documented above); browser sweep partial due to hidden-pane frame suspension (environmental, diagnosed and recorded).
