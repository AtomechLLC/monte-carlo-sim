# Phase 2: Scenario Construction & Street Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 2-Scenario Construction & Street Navigation
**Areas discussed:** Dealing & runout model, Card picker interaction, Reveal semantics, Odds behavior on navigation
**Mode:** `--auto` (unattended chain authorized by the user's standing "proceed without operator input" directive). All selections are Claude's recommended defaults, logged here for audit — the user did not answer these questions directly.

---

## Dealing & runout model

| Option | Description | Selected |
|--------|-------------|----------|
| Predetermined full runout | Draw hero (unless picked) + opponents + all 5 board cards at deal time; streets move a visibility pointer | ✓ |
| Lazy per-street dealing | Draw flop/turn/river cards on first advance; requires per-street draw history to satisfy NAV-02 | |

**Choice:** Predetermined full runout (recommended default)
**Notes:** NAV-02's "re-advancing shows the same cards" falls out for free. Odds must condition only on VISIBLE cards, never the hidden predetermined runout.

---

## Card picker interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Slot-based picker, used cards grayed | Click a slot (hole ×2, flop ×3, turn, river) → 52-card panel grouped by suit; used cards visibly disabled | ✓ |
| Rank-then-suit two-step picker | Two smaller menus per slot; compact but hides the duplicate-block | |
| Free-text card entry | Type "As", "Td"; fastest but error-prone and invisible blocking | |

**Choice:** Slot-based picker with visibly disabled used cards (recommended default)
**Notes:** Visible blocking serves DEAL-03 and the learning goal. Partial scenarios allowed; unset slots random. Opponents never pickable (deferred).

---

## Reveal semantics

| Option | Description | Selected |
|--------|-------------|----------|
| One-way reveal, persists across navigation | Click seat to reveal; knowledge is monotonic within a hand; cleared on re-deal | ✓ |
| Toggleable reveal/un-reveal | User can hide again; simpler to misread as "odds rewind" | |

**Choice:** One-way, persistent (recommended default)
**Notes:** Matches "revealed cards become known information" (NAV-03). Rewinding does not unlearn.

---

## Odds behavior on navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-street cache keyed by knowledge state | Rewind shows cached settled values instantly; reveal invalidates all; new streets run live convergence | ✓ |
| Always re-simulate on every navigation | Simple, but rewound odds differ by MC noise from "their earlier values" and hides nothing | |

**Choice:** Per-street cache with knowledge-based invalidation (recommended default)
**Notes:** Literal NAV-02 compliance; convergence stays visible wherever information is new. Navigation supersedes in-flight runs (extends Phase 1 cancellation).

---

## Claude's Discretion

- Store shape (extend gameStore vs new store), component decomposition, picker layout, worker protocol changes, cache location.

## Deferred Ideas

- Pick opponent hole cards in the picker (future phase / v2)
- Un-reveal toggle (conflicts with monotonic knowledge)
- Card art / dealing animation / `index.html` title fix (Phase 3)
