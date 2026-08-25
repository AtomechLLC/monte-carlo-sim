---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Blackjack & Multi-Deck
status: executing
stopped_at: Phase 6 complete (verified passed); Phase 7 ready to plan
last_updated: "2026-08-25T00:09:56.066Z"
last_activity: 2026-08-25
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 17
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information reshapes the numbers.
**Current focus:** Phase 7 — 2 deck hold'em evaluation layer

## Current Position

Phase: 7
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-25

Progress: [██░░░░░░░░] 20% (1/5 v2.0 phases; 6/6 plans so far)

## Performance Metrics

**Velocity:**

- Total plans completed: 33
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 6 | - | - |
| 03 | 6 | - | - |
| 04 | 6 | - | - |
| 05 | 3 | - | - |
| 6 | 8 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap (v2.0): 5-phase build sequence, dependency-ordered per research — multiset deck foundation + worker protocol generalization merged into one engine-only phase (Phase 4, observable via regression/property tests and a dev-guard, mirroring v1 Phase 1's engine-first precedent), then game-mode shell (Phase 5), Blackjack vertical slice (Phase 6), 2-deck Hold'em evaluation (Phase 7), and a cross-game deck-count toggle UI last (Phase 8).
- Roadmap (v2.0): Blackjack-before-2-deck-poker is deliberate — the 2-deck poker evaluator is the milestone's single highest-correctness-risk item, so the multiset-deck plumbing gets proven against a real, working, non-error-path consumer (Blackjack) first.
- Research: `evaluateHoldem` throws `TypeError: C is not iterable` on ANY duplicate rank+suit co-occurrence (not just five-of-a-kind) — Phase 7's duplicate-detection gate must cover every duplicate shape, not just rank-count ≥5.
- Research: Zero new runtime dependencies for v2.0 — Blackjack rules engine, multiset shoe, and 2-deck evaluation wrapper are all hand-written TypeScript on the existing v1.0 stack (Comlink, pure-rand, `@poker-apprentice/hand-evaluator`, Zustand, Motion).
- Phase 1: `@poker-apprentice/hand-evaluator` must be imported via named imports only (`import { evaluateHoldem, compare }`) — the plan-documented default-import pattern breaks the production worker chunk (ESM `module` field has no default export).
- Phase 1: `pure-rand@8.4.2` requires subpath imports (`pure-rand/generator/xoroshiro128plus`, `pure-rand/distribution/uniformInt`) — no top-level `"."` export.
- Phase 2: The full hand runout is predetermined at deal time; `deriveConditionedState` in `src/engine/conditioning.ts` is the ONLY code allowed to read the raw runout for simulation purposes (D-02 leak guard). Odds condition on visible street + revealedMask only.
- Phase 2: Settled odds are cached per `street|revealedMask` knowledge key in oddsStore; reveal invalidates by key composition; `deal()` clears the cache.

### Pending Todos

None yet.

### Blockers/Concerns

- ⚠️ [Phase 4→7/8] Remaining 04-REVIEW.md traps: WR-01 Phase 8 MUST pass deckCount into setPick (comment corrected in c29091a); WR-03 nothing may pass deckCount:2 into the HOLD'EM trial path until Phase 7's duplicate-aware evaluator exists (evaluator crashes on duplicates — Phase 6 verified compliance: conditioning default =1, zero hits in gameStore); WR-04 Phase 7 should strengthen the shoe-path guard against .includes() membership and add behavioral 2-deck CardPicker tests.
- (Resolved) 04-REVIEW WR-02 deckCount wire-shape validation — CLOSED in Phase 6 (06-03, both poker and blackjack worker APIs reject 0/>2/non-integers with rejection tests).
- (Resolved) 05-REVIEW WR-03 HoldemGame extraction — CLOSED in Phase 6 (06-02, commit 4551bb9: <HoldemGame /> extracted verbatim, guards retargeted same-commit, testid arrays consolidated into src/test/holdemTestids.ts).
- ⚠️ [Phase 7+ note] 06-REVIEW WR-01 resolution accepted a documented ~one-bit D-02 leak: the blackjack "1 deck" toggle segment disables when the HIDDEN hole duplicates a visible card (impossible-state prevention outweighed the leak; store-boundary refusal is the backstop). Carry this convention if Phase 8's cross-game toggle absorbs the blackjack-local toggle.
- ⚠️ [Phases 1-4] Security enforcement is enabled but no SECURITY.md exists for any phase — `/gsd:secure-phase N` closes the gate (client-only app; low risk).
- ⚠️ [Phase 7 flag] 2-deck poker hand-ranking convention (Five of a Kind above Royal Flush) is single-sourced from a community forum thread, not an official rulebook — treat as working convention, revisit if a more authoritative source surfaces.
- (Resolved) Phase 6 EV-model flag — locked as D-04/D-05 in 06-CONTEXT.md before implementation (S17, 3:2 natural, ±1/push-0, hit-once-then-stand labeling) and shipped as specified.
- (Resolved) WR-02 worker-crash surfacing — FIXED in quick task 260824-biv (Worker error/messageerror listeners now route into the error banner).
- (Resolved) Phase 1 cosmetic debt (scaffold-tmp title, default favicon, dead scaffold assets) — closed in Phase 3 plan 03-05 (D-14).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260824-biv | Post-v1.0 hardening: WR-02 worker-crash surfacing, explicit TS strict, odds-panel labels, category-table semantics + locked-in indicator, formatPct dedupe, dead CSS, matchMedia hardening, error detail | 2026-08-24 | e39ade6 | [260824-biv](./quick/260824-biv-fix-core-post-v1-0-problems-wr-02-worker/) |
| fast | Fix hero hand rendering behind community cards (z-scale + geometry) | 2026-08-24 | 00cfa16 | (inline) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 requirement | EDU-01: Outs/draw callouts | Deferred | Requirements definition |
| v2 requirement | EDU-02: Educational annotations | Deferred | Requirements definition |
| v2 requirement | EDU-03: Shareable scenario permalinks | Deferred | Requirements definition |
| v2.x requirement | Blackjack Double/Split/Surrender EV | Deferred | v2.0 requirements definition |
| v2.x requirement | Deck counts beyond 2 (4/6/8-deck shoes) | Deferred | v2.0 requirements definition |
| v2.x requirement | Deck-count delta callout UI | Deferred | v2.0 requirements definition |

## Session Continuity

Last session: 2026-08-25T00:09:56.059Z
Stopped at: Phase 6 context gathered
Resume file: None

## Operator Next Steps

- Phase 7 (2-Deck Hold'em Evaluation) proceeding under the standing no-operator-input directive: discuss → research → plan → execute
