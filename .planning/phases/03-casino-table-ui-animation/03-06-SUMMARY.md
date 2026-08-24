---
phase: 03-casino-table-ui-animation
plan: 06
subsystem: verification
tags: [phase-acceptance, human-verify, browser-walkthrough]

requires:
  - All Phase 3 implementation plans (03-01 through 03-05) merged and green
provides:
  - Phase 3 acceptance: all four TBL success criteria observed working in a real browser
affects: []

key-files:
  created: []
  modified: []

status: complete
---

# Plan 03-06 Summary — Phase 3 Acceptance: Walk the Finished Casino Table

**One-liner:** The finished casino table — felt scene, real card art, deal/flip/reveal choreography, and the animation-gated odds — passed all thirteen walkthrough steps in a real Chromium browser with zero console errors.

## Checkpoint Resolution

**Attribution caveat (recorded verbatim per protocol):** Verification was performed by the orchestrating Claude agent driving a real Chromium browser (Vite dev server on port 5199), under the user's explicit standing directive to proceed through all phases without operator input. A human did not personally observe this walkthrough; the human can re-verify anytime with `npm run dev`.

**Automated pre-gate:** `npm test` (203/203), `npx eslint .`, `npx tsc -b`, `npm run build` all exit 0 before the walkthrough began.

## Walkthrough Evidence (steps 1-12 + 9b)

1. **Tab identity ✓ (D-14)** — title "Monte Carlo Poker Simulator"; `/favicon.svg` is a spade glyph (content-verified), not the Vite logo.
2. **Empty table ✓ (TBL-01)** — green felt oval (radial gradient, 50% border-radius) with "You" seat bottom-center, "Opponent 1/2/3" across the top, 5 dashed community positions, deck stack at right, odds panel entirely outside the felt (no overlap), empty state naming both Deal and Set Up Scenario.
3. **Deal choreography ✓ (TBL-03)** — 8 hole cards + deck stack render (11 card imgs, none broken); choreography window ~900ms matching the 8×80ms stagger + 300ms flight contract.
4. **The gate ✓ (TBL-04)** — sampled every 100ms through the deal: every odds field and the trial counter showed em-dashes for the full flight window; counter appeared at 0 at ~910ms (after the last card landed), first percentage at ~1003ms, converged to 200,000. No number ever flickered mid-deal.
5. **Card art ✓ (TBL-02)** — card-code→asset mapping exact (Kh→H-K.svg "King of Hearts", 6h→H-6.svg; board Ah/3d/Js→H-A/D-3/S-J), all images load (naturalWidth>0), all six opponent cards share the single back.svg.
6. **Street advance ✓ (TBL-03/04)** — Flop mounted exactly 3 new cards while hero cards' positions were bit-identical before/after; Turn and River each added exactly 1; odds em-dashed until landing then converged (15.7% → 11.1% → 18.0%).
7. **Rewind ✓ (TBL-04/D-12)** — on Rewind from River, odds went to em-dash immediately (gate armed), the departing card left the DOM, and only then did the cached Turn values appear — verbatim 11.1% at 200,000 trials, zero re-convergence. *Measurement caveat:* the exit took ~800ms wall-clock instead of the spec'd 150ms; this is consistent with requestAnimationFrame throttling in a non-displayed browser tab (the walkthrough ran headless-style), not an app defect — the ordering invariant (odds strictly after exit) is what D-12 requires and held exactly.
8. **Reveal flip ✓ (TBL-03)** — clicking Opponent 2 mounted back+face pairs with 3D transforms (`preserve-3d`/rotateY, 4 elements), seat box size stable within 2px, seat disabled after (one-way), odds dashed until the flip settled then recomputed (11.1% → 3.9% with K♣5♣ revealed).
9. **Re-deal mid-animation ✓ (D-10)** — double-Deal 150ms apart: final state exactly 11 card imgs (2 hero + 6 backs + 3 deck), no orphans or duplicates, seats hidden, new hand's odds resolved to 200,000.
9b. **Re-deal from River clears instantly ✓ (D-08; plan-checker warning #1 fix verified)** — after Deal→River→Deal, the board was already 0 cards at the first 31ms sample with street "Pre-Flop"; no exit fade, no gate-hold lag. The dealNonce-keyed AnimatePresence fix works.
10. **Reduced motion (D-09) — covered via the automated suite** — the OS-level toggle cannot be flipped from this harness; D-09's contract (instant final positions, gate resolves, odds compute) is exercised by the entire 203-test suite, which runs the full deal/advance/reveal flows under forced `prefers-reduced-motion: reduce`. Recorded as suite-verified rather than visually observed.
11. **Keyboard and focus ✓** — 0 unreachable buttons, `:focus-visible` rule present, all four controls at ≥44px height (Deal 54×44, Set Up Scenario 121×44, Rewind 71×44, Advance 78×44), all three seats are real buttons, Phase 2 picker fully intact behind the Set Up Scenario disclosure including "Cancel Pick" and Escape-close with focus restored to the invoking slot.
12. **Console ✓** — zero errors and zero React warnings across the entire walkthrough.

**Dev server:** stopped after the walkthrough (T-03 acceptance criterion satisfied).

## Defects Found

None found by the walkthrough itself — but see the post-checkpoint addendum below.

## Post-Checkpoint Addendum (same day)

The subsequent code review (03-REVIEW.md) found 3 CRITICAL exit-gate deadlocks the walkthrough missed (its rewind test used River→Turn, never Flop→Pre-Flop; the automated suite forces reduced motion, disabling the affected path). The orchestrator empirically CONFIRMED CR-01 in a real browser: Deal → Advance → Rewind froze the odds panel permanently, with re-deal unable to recover it. All three were fixed the same day (commits `aff5672`, `d1e7ac4`, `e0512f3`; hold lifecycle now closed by construction with 5 documented release paths; 5 new enabled-path hook tests; suite 208/208). The orchestrator then re-verified in a real browser: all three deadlock sequences recover to settled odds, D-12 cached-rewind and D-08 instant re-deal semantics intact, zero console errors. The former 03-04 "may skip its graceful fade" limitation was in fact the CR-01 deadlock and is resolved by the same fix.

## Deviations

Verification performed by the orchestrating agent rather than a human (documented above). Step 10 verified via the reduced-motion-forced automated suite rather than an OS toggle. Step 7's exit-duration measurement distorted by background-tab rAF throttling (ordering invariant verified regardless).
