# Phase 3: Casino Table UI & Animation - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (unattended chain authorized by user). Every decision below is the recommended default, logged for audit; the user did not hand-pick these answers.

<domain>
## Phase Boundary

Phase 3 delivers the full casino-table presentation over the already-proven interaction loop: a felt table scene with the hero's seat, 3 anonymous opponent seats and a community card area (TBL-01); detailed playing cards with proper pips and court-card art (TBL-02); deal/flip/reveal animations (TBL-03); and animation-coordinated odds so numbers never contradict or spoil cards still mid-animation (TBL-04). No new simulation capability, no new interaction capability — Phases 1-2 behavior must survive unchanged underneath the new skin.

</domain>

<decisions>
## Implementation Decisions

### Card art source
- **D-01:** Card faces come from a vendored, openly-licensed SVG deck committed into the repo as self-contained assets (public-domain/CC0 strongly preferred; permissive licenses acceptable with attribution recorded in the repo). No CDN or runtime network fetch — the app must stay fully static/offline. The researcher MUST verify the chosen deck's license and pick the bundling mechanism (inline SVG components vs. sprite/img references) based on bundle-size and styling needs.
- **D-02:** Card backs are a simple repeating pattern (CSS or SVG) consistent across all hidden cards; opponents' hidden cards render as face-down card backs on the felt (replacing the Phase 1-2 "Hidden" text).
- **D-03:** The `Card` string union (e.g. "As", "Td") remains the single card identity everywhere; a single mapping component (e.g. `<PlayingCard card="As" faceUp />`) is the only bridge from card codes to art. No component may hand-compose rank/suit art outside it.

### Table scene composition
- **D-04:** The felt table (oval, green felt) is the visual centerpiece: hero seat bottom-center showing the hero's two face-up cards, 3 opponent seats arced across the top/sides showing face-down backs (or face-up cards once revealed), community card area in the table center with the 5 board positions, and a deck origin position for deal animations.
- **D-05:** Odds displays (win/tie/loss, trial counter, 10-row category table) dock OUTSIDE the felt — a panel beside or below the table — keeping the felt purely diegetic. All existing `data-testid` contracts (`hero-hole`, `opponents`, `opponent-seat-{i}`, `board-cards`, `trial-counter`, `win-pct`, `tie-pct`, `lose-pct`, `category-table`, `category-pct-{n}`, `street-label`, `empty-hand-state`, `simulation-error`) MUST survive the re-skin — the acceptance suite and prior tests are the regression harness and should pass with at most minimal, justified test adjustments.
- **D-06:** The card picker stays functionally identical but is opened from a "Set Up Scenario" control near the table (its slot/panel/dialog semantics, copy, and testids from 02-UI-SPEC carry forward). Street controls (Rewind / street label / Advance) sit adjacent to the community area or the odds panel — planner's choice, but keyboard reachability and 44px hit areas are non-negotiable.
- **D-07:** Rendering stays DOM + SVG + CSS (per locked CLAUDE.md stack decision). Desktop-first layout; small-screen behavior may simply scale/scroll (mobile-first polish is out of scope). Konva/canvas is the escape hatch ONLY if real-device testing shows CSS-transform animations dropping frames — do not pre-emptively adopt it.

### Animation system & choreography
- **D-08:** Animation library is Motion (`motion` package, the locked stack choice). Deal: cards fly from the deck origin to seats/board with a stagger (~250-350ms per card, ~60-100ms stagger — exact values are Claude's discretion within "snappy, not sluggish"). Flip/reveal: 3D flip via `rotateY` with `backfaceVisibility: hidden`. Street advance animates only the newly visible board cards; rewind removes cards with a quick fade/slide (no full re-deal choreography).
- **D-09:** `prefers-reduced-motion` MUST be honored: animations become instant state changes (cards appear in final position), and the TBL-04 gating (below) must still function — with zero-duration animations the gate resolves immediately.
- **D-10:** Re-deal during an in-flight animation cancels the running choreography cleanly and starts the new deal — no overlapping/orphaned card sprites.

### Odds/animation coordination (TBL-04)
- **D-11:** The invariant is made structural by GATING THE SIMULATION TRIGGER on animation completion: an animation-state flag (e.g. `dealing: boolean` in a store, set when choreography starts, cleared by its completion callback) is a dependency of the odds effect — the simulation for a new knowledge state starts only after the cards it describes have finished animating. Odds displays show their pending/em-dash state while cards are in flight.
- **D-12:** Rewind to a cached street shows the cached settled odds after the (short) board-card exit transition completes — same gate, trivially short wait. No odds number may change while any card is mid-flight, and no odds number may reflect a card the user cannot yet see.
- **D-13:** The dev-mode consistency guard and error-banner behavior from Phases 1-2 are unchanged; the animation gate must not swallow worker errors (an error surfaced during animation shows once the animation settles).

### Cosmetic debt folded in
- **D-14:** This phase closes the tracked cosmetic debt: `index.html` `<title>` becomes "Monte Carlo Poker Simulator" (replacing "scaffold-tmp"), a simple favicon replaces the Vite default, and the unused scaffold assets (`src/assets/react.svg`, `public/vite.svg` if still referenced/present, dead `src/assets/hero.png` etc.) are removed if nothing references them.

### Claude's Discretion
- Exact felt styling, seat badges, spacing, and color values (within the existing CSS custom-property system; a casino-green palette extension is expected).
- Exact animation durations/easings within D-08's bounds; deck-origin placement.
- Component decomposition (TableScene, Seat, PlayingCard, CommunityArea, etc.) and whether the animation flag lives in gameStore or a new uiStore.
- Whether odds panels sit right or below the felt at desktop widths.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 3 goal + 4 success criteria (TBL-01..04 acceptance bar)
- `.planning/REQUIREMENTS.md` — TBL-01, TBL-02, TBL-03, TBL-04 definitions

### Locked stack guidance
- `./CLAUDE.md` — Technology Stack: DOM + SVG + Motion rendering decision (PixiJS/Konva explicitly avoided), Motion 13.1.1 for deal/flip/reveal, SVG-cards referenced as a known asset source; Web Worker + odds architecture constraints

### Phase 1-2 contracts this phase re-skins (must not break)
- `.planning/phases/02-scenario-construction-street-navigation/02-UI-SPEC.md` — copy, testids, accessibility contract, spacing/color/typography tokens this phase extends
- `.planning/phases/02-scenario-construction-street-navigation/02-01-SUMMARY.md` — conditioning/service contract
- `.planning/phases/02-scenario-construction-street-navigation/02-02-SUMMARY.md` — gameStore runout/street shape, odds effect wiring
- `.planning/phases/02-scenario-construction-street-navigation/02-03-SUMMARY.md` — settled cache + reveal semantics
- `.planning/phases/02-scenario-construction-street-navigation/02-06-SUMMARY.md` — the 10-step behavior baseline that must still hold after the re-skin
- `.planning/phases/02-scenario-construction-street-navigation/02-REVIEW.md` — 2 advisory warnings (stale error banner on cache-hit; unsubscribed Worker error event); fix opportunistically if the odds-effect/service files are touched for D-11, otherwise leave documented

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/*` components (HandDisplay, BoardDisplay, StreetControls, CardPicker, WinTieLossDisplay, OddsTable) — all keep their logic; this phase changes presentation. HandDisplay/BoardDisplay are the primary re-skin targets (their testids are contractual).
- `src/App.css` + `src/index.css` custom-property system (--bg, --border, --accent, --destructive, spacing scale, 44px hit areas) — extend with felt palette; do not fork a second styling system.
- `src/state/gameStore.ts` (runout, street, revealedMask) — the scene is a pure function of this state; animations are transitions between its snapshots.
- `src/App.tsx` odds effect — D-11's gate plugs in here as an additional dependency.

### Established Patterns
- TDD RED→GREEN commits per plan; explicit `vi.mock` factory for simulationService in component tests; `@vitest-environment node` for engine/worker tests; jsdom `<dialog>` polyfill in `src/test/setup.ts`.
- Zustand curried `create<T>()()` stores with wholesale field replacement.
- Contractual testids named lowercase-hyphenated.
- Animation-completion callbacks will need deterministic test handling — Motion animations in jsdom don't run real frames; tests should drive completion via the store flag / callback injection rather than timers (researcher to confirm the canonical Motion testing pattern).

### Integration Points
- `src/App.tsx`: mounts the new TableScene composition; odds effect gains the animation-gate dependency (D-11).
- `src/ui/HandDisplay.tsx` → hero seat + opponent seats on the felt (reveal buttons become seat interactions, same one-way semantics).
- `src/ui/BoardDisplay.tsx` → community card area with per-card animation on street advance.
- `index.html` → title/favicon fix (D-14).

</code_context>

<specifics>
## Specific Ideas

- The deal choreography IS the product feel — "full table feel; visual craft is part of the deliverable, not a skin" (PROJECT.md constraint). Snappy staggered dealing from a visible deck origin, not simultaneous popping.
- TBL-04's spirit: the app must never "spoil" a card — e.g., the river card's effect on odds must not be readable from the numbers before the card face is visible.

</specifics>

<deferred>
## Deferred Ideas

- Sound effects (card swish, chip sounds) — out of scope, no audio this milestone.
- Chip stacks / bets / pot graphics — PROJECT.md explicitly excludes betting.
- Mobile-first responsive redesign — desktop-first accepted this milestone (D-07).
- Konva/canvas card layer — only as the documented escape hatch if CSS animation jank is observed on real devices.
- v2 EDU items (outs callouts, annotations, permalinks) — unchanged, still deferred.

</deferred>

---

*Phase: 3-Casino Table UI & Animation*
*Context gathered: 2026-08-24*
