# Phase 6: Blackjack Core Odds Loop - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-08-24 | **Mode:** `--auto` (standing directive) | **Areas:** Round lifecycle, EV semantics, Worker/store architecture, Table layout

## Round lifecycle
| Option | Selected |
|--------|----------|
| Predetermine hole card only; hit/dealer cards drawn live | ✓ (reveal needs the hole; no rewind requirement exists) |
| Predetermine everything (full Hold'em discipline) | rejected — machinery without a requirement |
| Draw everything live incl. hole | rejected — breaks the BJ-06 reveal mechanic |

## EV semantics
| Option | Selected |
|--------|----------|
| Hit EV = hit-once-then-stand, visibly labeled; Stand EV = exact playout; S17/3:2/±1/push-0 locked | ✓ |
| Optimal-continuation Hit EV | deferred v2.x — recursive strategy engine out of scope |

## Architecture
| Option | Selected |
|--------|----------|
| blackjackSimulationApi on streamingRunner, namespaced Comlink {poker, blackjack}; parallel stores; WR-02 validation closed; HoldemGame extraction first | ✓ (research-locked + trap fold-ins) |
| Separate second worker thread | rejected — research: one worker, namespaced APIs |

## Table layout
| Option | Selected |
|--------|----------|
| Dealer top (upcard + FlipCard hole), player bottom, Hit/Stand tiles + local deck toggle, odds cluster outside felt | ✓ |
| Odds on the felt | rejected — Phase 3 precedent (diegetic felt, docked data) |

## Claude's Discretion
Blackjack odds store partitioning, component decomposition, dealer playout pacing, EV tile styling, runner snapshot shape.

## Deferred
Double/Split/Surrender, optimal-continuation EV, rule variants, cross-game toggle (P8), visual excellence pass (pending insertion decision).
