---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 3 UI-SPEC approved
last_updated: "2026-08-24T10:08:00.494Z"
last_activity: 2026-08-24 -- Phase 03 planning complete
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 16
  completed_plans: 10
  percent: 63
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information reshapes the numbers.
**Current focus:** Phase 3 — casino table ui & animation

## Current Position

Phase: 3
Plan: Not started
Status: Ready to execute
Last activity: 2026-08-24 -- Phase 03 planning complete

Progress: [██████░░░░] 67% (2/3 phases; 10/10 v1-so-far plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 10
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 6 | - | - |

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

- ⚠️ [Phase 2] Code review WR-01 (02-REVIEW.md): the `simulation-error` banner is only cleared by a live run's snapshot — the cache-hit navigation path never clears it, so a stale banner can sit over valid cached odds. Advisory.
- ⚠️ [Phase 2] Code review WR-02 (02-REVIEW.md): hard worker death (script load failure) fires the unsubscribed Worker `error` event and leaves Comlink promises hanging — call-rejection errors are surfaced, but worker-crash errors are not. Advisory.
- ⚠️ [Phases 1-2] Security enforcement is enabled but no SECURITY.md exists for either phase — `/gsd:secure-phase 1` and `/gsd:secure-phase 2` close the gate (client-only app; low risk).
- ⚠️ [Phase 1] Cosmetic: `index.html` title is still "scaffold-tmp"; scheduled for Phase 3 (visual polish). (Phase 1's WR-01/WR-02 were fixed in Phase 2 plan 02-01.)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 requirement | EDU-01: Outs/draw callouts | Deferred | Requirements definition |
| v2 requirement | EDU-02: Educational annotations | Deferred | Requirements definition |
| v2 requirement | EDU-03: Shareable scenario permalinks | Deferred | Requirements definition |

## Session Continuity

Last session: 2026-08-24T09:35:06.912Z
Stopped at: Phase 3 UI-SPEC approved
Resume file: .planning/phases/03-casino-table-ui-animation/03-UI-SPEC.md
