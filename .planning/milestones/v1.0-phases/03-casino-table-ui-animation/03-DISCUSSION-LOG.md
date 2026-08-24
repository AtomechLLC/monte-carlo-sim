# Phase 3: Casino Table UI & Animation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 3-Casino Table UI & Animation
**Areas discussed:** Card art source, Table scene composition, Animation system & choreography, Odds/animation coordination
**Mode:** `--auto` (unattended chain authorized by the user's standing "keep going through all phases without operator input" directive). All selections are Claude's recommended defaults, logged here for audit.

---

## Card art source

| Option | Description | Selected |
|--------|-------------|----------|
| Vendored open-license SVG deck | Commit a public-domain/CC0 (preferred) SVG deck into the repo; researcher verifies license + bundling | ✓ |
| Hand-drawn SVG components | Programmatic pips feasible, but court-card art is a large bespoke art effort | |
| Unicode/CSS-only cards | Fails TBL-02's "proper pips and court cards" | |

**Choice:** Vendored open-license SVG deck (recommended default)
**Notes:** No CDN/network fetch — app stays static. One `<PlayingCard>` bridge component from card codes to art (D-03).

---

## Table scene composition

| Option | Description | Selected |
|--------|-------------|----------|
| Felt centerpiece, odds docked outside | Oval felt with seats/community center; odds panels beside/below; picker via "Set Up Scenario" | ✓ |
| Everything on the felt | Odds embedded in the table surface; crowds the scene and hurts the data-dense table readability | |
| Tabbed views | Table view vs odds view; breaks the "watch odds converge while watching cards" core loop | |

**Choice:** Felt centerpiece with docked odds (recommended default)
**Notes:** All Phase 1-2 data-testids survive; DOM+SVG+CSS only (locked stack); desktop-first.

---

## Animation system & choreography

| Option | Description | Selected |
|--------|-------------|----------|
| Motion with staggered deal + rotateY flips | Locked-stack library; ~250-350ms/card, 60-100ms stagger; reduced-motion honored | ✓ |
| CSS-only transitions | No choreography/sequencing primitives; harder completion callbacks for TBL-04 | |
| Konva/canvas layer | Explicitly the escape hatch, not the default (CLAUDE.md) | |

**Choice:** Motion (recommended default)
**Notes:** Re-deal mid-animation cancels choreography cleanly (D-10); prefers-reduced-motion → instant states (D-09).

---

## Odds/animation coordination (TBL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Gate simulation trigger on animation completion | Animation-state flag as odds-effect dependency; runs start after cards land | ✓ |
| Run immediately, freeze the display | More parallelism but two sources of truth for "what the user may see" — riskier | |

**Choice:** Gate the simulation trigger (recommended default)
**Notes:** Makes the invariant structural; cached rewind values appear after the short exit transition (D-12); worker errors surface after animation settles (D-13).

---

## Claude's Discretion

- Felt styling/palette values, seat badges, animation timing within bounds, deck-origin placement, component decomposition, animation-flag store location, odds-panel docking side.

## Deferred Ideas

- Sound effects; chip/pot graphics (betting excluded by PROJECT.md); mobile-first redesign; Konva escape hatch unless jank observed; v2 EDU items.
