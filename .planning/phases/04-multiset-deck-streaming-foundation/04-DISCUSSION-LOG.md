# Phase 4: Multiset Deck & Streaming Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 4-Multiset Deck & Streaming Foundation
**Areas discussed:** Identity representation, Shoe API shape, Runner extraction scope, v1-parity gate mechanics
**Mode:** `--auto` (standing no-operator-input directive). All selections are recommended defaults, logged for audit.

---

## Identity representation

| Option | Description | Selected |
|--------|-------------|----------|
| Count-based multiset, flat Card[] pools | Duplicates coexist in arrays; count-aware logic replaces Set membership; no new types on the hot path | ✓ |
| PhysicalCard identity wrappers ({card, copy}) | Explicit object identity; heavier churn through worker serialization, evaluator boundaries, every signature | |
| Branded identity strings ("As#0") | Identity without objects, but leaks into evaluator/display code and needs constant parsing | |

**Choice:** Count-based multiset (recommended)
**Notes:** rng primitives verified duplicate-safe; React keys already positional; PITFALLS' identity concerns are satisfied by count logic + property tests.

---

## Shoe API shape

| Option | Description | Selected |
|--------|-------------|----------|
| buildShoe/shoeWithout + ConditionedState.deckCount | New shoe module; deckCount flows through conditioning to worker validation (52×deckCount − known) | ✓ |
| Generalize deckWithout in place | Fewer files but mutates a stable v1 contract used by green tests | |

**Choice:** New shoe module, deckCount in ConditionedState defaulting to 1 (recommended)

---

## Runner extraction scope

| Option | Description | Selected |
|--------|-------------|----------|
| Extract supersession/chunk/throttle/done into generic streamingRunner | simulationApi becomes Hold'em config; existing tests must pass unchanged | ✓ |
| Duplicate the loop for blackjack later | Faster now, two divergent copies of subtle supersession logic forever | |

**Choice:** Extract now (recommended — research build order; Phase 6 rides on it)

---

## v1-parity gate mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Golden-first: record seeded golden values from current code, then refactor | Drift detection is real; gate exists before the change it gates | ✓ |
| Rely on existing suite only | 216 tests are strong but don't pin exact seeded tally values | |

**Choice:** Golden-first + full suite unchanged (recommended)

---

## Claude's Discretion

- Module naming, count-math internals, runner generic signature, deckCount default plumbing.

## Deferred Ideas

- Deck toggle UI (P8), mode shell/namespaced worker (P5), blackjack logic (P6), duplicate evaluation + copy cues (P7), >2 decks (v2.x).
