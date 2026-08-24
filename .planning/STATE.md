---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Blackjack & Multi-Deck
status: planning
last_updated: "2026-08-24T16:00:45.887Z"
last_activity: 2026-08-24
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information reshapes the numbers.
**Current focus:** Milestone complete

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-24 — Milestone v2.0 started

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 6 | - | - |
| 03 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Engine-first correctness (evaluator, deck conditioning, streaming worker) folded into Phase 1 as a thin-but-complete vertical slice (deal + compute + display, minimal UI) rather than a separate headless engine phase — reconciles research's "engine before pixels" guidance with MVP vertical-slice mode.
- Roadmap: Full casino-table visual (felt table, card art, animation) deferred to Phase 3, built only after the odds engine and full interaction loop (street nav, rewind, reveal, manual picker) are proven correct on a minimal UI in Phases 1-2.
- Research: Always run Monte Carlo sampling (never silently switch to exact enumeration when few cards remain unknown) — visible convergence is the core educational value; mitigate jitter via throttled display updates and a visible trial counter, not algorithm switching.
- Phase 1: `@poker-apprentice/hand-evaluator` must be imported via named imports only (`import { evaluateHoldem, compare }`) — the plan-documented default-import pattern breaks the production worker chunk (ESM `module` field has no default export).
- Phase 1: `pure-rand@8.4.2` requires subpath imports (`pure-rand/generator/xoroshiro128plus`, `pure-rand/distribution/uniformInt`) — no top-level `"."` export.
- Phase 1: `dealNonce` is the single counter serving as both re-deal trigger and worker `requestId`; worker supersession is generation-tagged in `simulationApi.ts`.
- Phase 2: The full hand runout is predetermined at deal time; `deriveConditionedState` in `src/engine/conditioning.ts` is the ONLY code allowed to read the raw runout for simulation purposes (D-02 leak guard). Odds condition on visible street + revealedMask only.
- Phase 2: Settled odds are cached per `street|revealedMask` knowledge key in oddsStore; reveal invalidates by key composition; `deal()` clears the cache.
- Phase 2: `simulationService.startSimulation(conditioned, onProgress, onError)` owns its own monotonic requestId generation (dealNonce is no longer the requestId).

### Pending Todos

None yet.

### Blockers/Concerns

- ⚠️ [Phases 1-3] Security enforcement is enabled but no SECURITY.md exists for any phase — `/gsd:secure-phase 1|2|3` closes the gate (client-only app; low risk).
- (Resolved) WR-02 worker-crash surfacing — FIXED in quick task 260824-biv (Worker error/messageerror listeners now route into the error banner).
- (Resolved) Phase 1 cosmetic debt (scaffold-tmp title, default favicon, dead scaffold assets) — closed in Phase 3 plan 03-05 (D-14).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260824-biv | Post-v1.0 hardening: WR-02 worker-crash surfacing, explicit TS strict, odds-panel labels, category-table semantics + locked-in indicator, formatPct dedupe, dead CSS, matchMedia hardening, error detail | 2026-08-24 | e39ade6 | [260824-biv](./quick/260824-biv-fix-core-post-v1-0-problems-wr-02-worker/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 requirement | EDU-01: Outs/draw callouts | Deferred | Requirements definition |
| v2 requirement | EDU-02: Educational annotations | Deferred | Requirements definition |
| v2 requirement | EDU-03: Shareable scenario permalinks | Deferred | Requirements definition |

## Session Continuity

Last session: 2026-08-24T15:46:42.744Z
Stopped at: Quick task 260824-biv complete: post-v1.0 hardening (216/216 tests)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
