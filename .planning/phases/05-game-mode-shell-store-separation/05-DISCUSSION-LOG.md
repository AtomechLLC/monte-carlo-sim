# Phase 5: Game-Mode Shell & Store Separation - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md; this preserves alternatives considered.

**Date:** 2026-08-24 | **Mode:** `--auto` (standing directive) | **Areas:** Switcher UX, Placeholder scope, Store architecture, Switch semantics

## Switcher UX
| Option | Selected |
|--------|----------|
| Segmented two-button control in control bar, store-backed, no routing | ✓ |
| URL routes per game | deferred (v2.x permalinks territory) |
| Dropdown select | weaker discoverability for 2 items |

## Blackjack placeholder scope
| Option | Selected |
|--------|----------|
| Felt shell + honest empty state, zero dead controls | ✓ |
| Disabled Deal button "coming soon" | rejected — dead controls are anti-UX |
| No placeholder (switcher disabled until P6) | rejected — BJ-01 requires a real switch with independent state now |

## Store architecture
| Option | Selected |
|--------|----------|
| gameModeStore with only {mode}; Hold'em stores untouched; isolation tests | ✓ (locked by milestone research) |
| Generalized shared game store | rejected — mode-leakage pitfall |

## Switch semantics
| Option | Selected |
|--------|----------|
| Persist state; cancel in-flight sim; drain animation gate; cache-restore on return | ✓ |
| Reset Hold'em on switch | rejected — hostile to exploration loop |

## Claude's Discretion
Component naming, switcher styling within tokens, App.tsx branch mechanics.

## Deferred
Routing/deep links, per-game deckCount fields (P6/P8), blackjack gameplay (P6).
