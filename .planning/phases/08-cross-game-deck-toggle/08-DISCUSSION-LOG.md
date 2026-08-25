# Phase 8: Cross-Game Deck-Count Toggle UI - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-08-25 | **Mode:** `--auto` (standing directive) | **Areas:** Component shape, SC reconciliation, scope

## Component shape
| Option | Selected |
|--------|----------|
| Props-driven shared component; per-game stores/testids/guards unchanged | ✓ (behavior-preserving; store locality is a locked invariant) |
| Shared deck-count store | rejected — violates D-10/D-14 store locality; forces cross-game coupling Phase 5 was built to prevent |
| Unified single testid | rejected — 06/07 testids are contractual with live isolation sweeps |

## SC reconciliation
| Option | Selected |
|--------|----------|
| SC2/SC3 satisfied by shipped locked semantics; consolidation suite proves them through the shared component | ✓ (D-04/D-05) |
| Force literal "next deal only" on both games | rejected — would undo Phase 6's locked BJ-07 findability (mid-turn same-cards re-run) |

## Scope
| Option | Selected |
|--------|----------|
| Smallest diff: extract + rewire + consolidation suite + gate | ✓ (milestone closer) |
| Fold in visual polish | rejected — VISUAL-EXCELLENCE-PLAN placement still pending user decision |

## Research
Skipped (no novel domain — mechanical extraction of two shipped near-identical components; pattern mapper covers the line-level census).

## Claude's Discretion
Component name/props, file org, helper hoisting, test structure.

## Deferred
Decks >2, delta callouts, store unification, visual excellence pass.
