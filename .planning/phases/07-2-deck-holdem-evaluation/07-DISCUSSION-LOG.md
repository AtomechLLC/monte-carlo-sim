# Phase 7: 2-Deck Hold'em Evaluation Layer - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-08-25 | **Mode:** `--auto` (standing directive) | **Areas:** Mode entry, toggle semantics, evaluation-layer strategy, copy cue, trap retirements

## Mode entry
| Option | Selected |
|--------|----------|
| Hold'em-local toggle mirroring blackjack's segmented control; Phase 8 absorbs both | ✓ (pattern reuse, absorbable) |
| Dev-only flag until Phase 8 | rejected — SC1 says "User can enable"; a hidden flag fails the criterion |

## Toggle semantics
| Option | Selected |
|--------|----------|
| Toggle triggers fresh deal (mid-hand) / sets deckCount (idle); no same-cards re-run | ✓ (predetermined runout can't survive a shoe swap; findability is a BJ-07 requirement, not HE2) |
| Blackjack-style same-cards re-run | rejected — invalidates the predetermined runout + settled cache semantics |

## Evaluation layer
| Option | Selected |
|--------|----------|
| Detection gate + wrapper; duplicate-free hands delegate unchanged; algorithm = researcher deliverable | ✓ (1-deck path pays zero cost, goldens hold; highest-risk item gets researched, not improvised) |
| Replace the evaluator wholesale | rejected — reintroduces solved 5-of-7 ranking risk for the 99%+ duplicate-free case |

## Copy cue
| Option | Selected |
|--------|----------|
| Corner badge on the second visible copy, badge tokens, rides the card | ✓ |
| Tint/border variation on duplicates | rejected — reads as state (selected/error), not identity |

## Trap dispositions
- WR-03 retires this phase (D-12, retarget the rejection test). WR-04 folds in (D-07). WR-01 stays Phase 8 unless D-07's picker tests force the setPick wire — noted in CONTEXT.
- Five-of-a-Kind-above-Royal convention: locked as working convention per STATE flag; researcher asked to source it better if possible.

## Post-research resolutions (2026-08-25, `--auto`)
| Research flag | Resolution |
|---------------|-----------|
| D-09 "top of table" vs shipped ascending order | D-09 amended — Five of a Kind renders as the LAST DOM row (strength end, after Royal Flush) |
| deckCount home | D-14 — gameStore (blackjack D-10 precedent) |
| CardPicker deckCount=1 pinned wire | D-15 — WR-01 closes early this phase with behavioral tests |
| Pitfall 7 "any duplicate crashes" | D-16 — corrected: silent garbage dominates; value-asserting tests mandatory |
| Five-of-a-Kind convention sourcing | Upgraded: pagat.com + Bicycle Cards — STATE flag resolvable |

## Claude's Discretion
Wrapper decomposition, copy-cue treatment within tokens, row-injection mechanism, toggle placement, test organization.

## Deferred
Cross-game toggle (P8), >2 decks, delta callouts, visual excellence pass (pending insertion), blackjack picker.
