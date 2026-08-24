# Phase 3: Casino Table UI & Animation - Research

**Researched:** 2026-08-24
**Domain:** DOM/SVG card rendering, CSS 3D flip animation (Motion/React), Zustand-driven animation-gated effects, open-licensed vector asset vendoring
**Confidence:** HIGH (Motion API, npm registry facts, license terms, existing codebase) / MEDIUM (exact card-art repo provenance chain, since the original author's site is offline and only derivative repos are reachable)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card art source**
- **D-01:** Card faces come from a vendored, openly-licensed SVG deck committed into the repo as self-contained assets (public-domain/CC0 strongly preferred; permissive licenses acceptable with attribution recorded in the repo). No CDN or runtime network fetch — the app must stay fully static/offline. The researcher MUST verify the chosen deck's license and pick the bundling mechanism (inline SVG components vs. sprite/img references) based on bundle-size and styling needs.
- **D-02:** Card backs are a simple repeating pattern (CSS or SVG) consistent across all hidden cards; opponents' hidden cards render as face-down card backs on the felt (replacing the Phase 1-2 "Hidden" text).
- **D-03:** The `Card` string union (e.g. "As", "Td") remains the single card identity everywhere; a single mapping component (e.g. `<PlayingCard card="As" faceUp />`) is the only bridge from card codes to art. No component may hand-compose rank/suit art outside it.

**Table scene composition**
- **D-04:** The felt table (oval, green felt) is the visual centerpiece: hero seat bottom-center showing the hero's two face-up cards, 3 opponent seats arced across the top/sides showing face-down backs (or face-up cards once revealed), community card area in the table center with the 5 board positions, and a deck origin position for deal animations.
- **D-05:** Odds displays (win/tie/loss, trial counter, 10-row category table) dock OUTSIDE the felt — a panel beside or below the table — keeping the felt purely diegetic. All existing `data-testid` contracts (`hero-hole`, `opponents`, `opponent-seat-{i}`, `board-cards`, `trial-counter`, `win-pct`, `tie-pct`, `lose-pct`, `category-table`, `category-pct-{n}`, `street-label`, `empty-hand-state`, `simulation-error`) MUST survive the re-skin — the acceptance suite and prior tests are the regression harness and should pass with at most minimal, justified test adjustments.
- **D-06:** The card picker stays functionally identical but is opened from a "Set Up Scenario" control near the table (its slot/panel/dialog semantics, copy, and testids from 02-UI-SPEC carry forward). Street controls (Rewind / street label / Advance) sit adjacent to the community area or the odds panel — planner's choice, but keyboard reachability and 44px hit areas are non-negotiable.
- **D-07:** Rendering stays DOM + SVG + CSS (per locked CLAUDE.md stack decision). Desktop-first layout; small-screen behavior may simply scale/scroll (mobile-first polish is out of scope). Konva/canvas is the escape hatch ONLY if real-device testing shows CSS-transform animations dropping frames — do not pre-emptively adopt it.

**Animation system & choreography**
- **D-08:** Animation library is Motion (`motion` package, the locked stack choice). Deal: cards fly from the deck origin to seats/board with a stagger (~250-350ms per card, ~60-100ms stagger — exact values are Claude's discretion within "snappy, not sluggish"). Flip/reveal: 3D flip via `rotateY` with `backfaceVisibility: hidden`. Street advance animates only the newly visible board cards; rewind removes cards with a quick fade/slide (no full re-deal choreography).
- **D-09:** `prefers-reduced-motion` MUST be honored: animations become instant state changes (cards appear in final position), and the TBL-04 gating (below) must still function — with zero-duration animations the gate resolves immediately.
- **D-10:** Re-deal during an in-flight animation cancels the running choreography cleanly and starts the new deal — no overlapping/orphaned card sprites.

**Odds/animation coordination (TBL-04)**
- **D-11:** The invariant is made structural by GATING THE SIMULATION TRIGGER on animation completion: an animation-state flag (e.g. `dealing: boolean` in a store, set when choreography starts, cleared by its completion callback) is a dependency of the odds effect — the simulation for a new knowledge state starts only after the cards it describes have finished animating. Odds displays show their pending/em-dash state while cards are in flight.
- **D-12:** Rewind to a cached street shows the cached settled odds after the (short) board-card exit transition completes — same gate, trivially short wait. No odds number may change while any card is mid-flight, and no odds number may reflect a card the user cannot yet see.
- **D-13:** The dev-mode consistency guard and error-banner behavior from Phases 1-2 are unchanged; the animation gate must not swallow worker errors (an error surfaced during animation shows once the animation settles).

**Cosmetic debt folded in**
- **D-14:** This phase closes the tracked cosmetic debt: `index.html` `<title>` becomes "Monte Carlo Poker Simulator" (replacing "scaffold-tmp"), a simple favicon replaces the Vite default, and the unused scaffold assets (`src/assets/react.svg`, `public/vite.svg` if still referenced/present, dead `src/assets/hero.png` etc.) are removed if nothing references them.

### Claude's Discretion
- Exact felt styling, seat badges, spacing, and color values (within the existing CSS custom-property system; a casino-green palette extension is expected).
- Exact animation durations/easings within D-08's bounds; deck-origin placement.
- Component decomposition (TableScene, Seat, PlayingCard, CommunityArea, etc.) and whether the animation flag lives in gameStore or a new uiStore.
- Whether odds panels sit right or below the felt at desktop widths.

### Deferred Ideas (OUT OF SCOPE)
- Sound effects (card swish, chip sounds) — out of scope, no audio this milestone.
- Chip stacks / bets / pot graphics — PROJECT.md explicitly excludes betting.
- Mobile-first responsive redesign — desktop-first accepted this milestone (D-07).
- Konva/canvas card layer — only as the documented escape hatch if CSS animation jank is observed on real devices.
- v2 EDU items (outs callouts, annotations, permalinks) — unchanged, still deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TBL-01 | Full casino-table scene: felt table, user's seat, 3 anonymous opponent seats, community card area | Architecture Patterns → Recommended Project Structure + Pattern 1 (oval felt via absolute positioning, not CSS grid); Architectural Responsibility Map confirms this is pure Browser/Client presentation with zero new state |
| TBL-02 | Detailed playing card faces with proper pips and court cards | Standard Stack → Card Art (vendored `letele/playing-cards` CC0 SVGs, verified license + file sizes); Code Examples → PlayingCard mapping component |
| TBL-03 | Cards animate — dealing, flipping, and opponent reveal | Standard Stack → Motion 13.1.1 (verified npm registry); Architecture Patterns → Pattern 2 (stagger deal), Pattern 3 (rotateY flip); Common Pitfalls → interrupted-animation key strategy, transform-style/perspective gotchas |
| TBL-04 | Odds displays coordinate with animations — numbers never contradict or spoil cards still being dealt/flipped | Architecture Patterns → Pattern 4 (animation-gate counter); Common Pitfalls → cache-hit branch must also gate; Code Examples → gated odds effect |
</phase_requirements>

## Summary

Phase 3 is a pure presentation layer over an already-correct, already-tested simulation/state core (120/120 tests green on Phases 1-2). Nothing in this phase touches `src/engine/*` or `src/worker/*`; the work is entirely in `src/ui/*`, `src/App.tsx`, `src/*.css`, and two new asset/library additions: a vendored CC0 SVG card deck and the `motion` animation library (already named in `CLAUDE.md`, not yet installed — confirmed absent from `package.json`/`package-lock.json`).

The single biggest unknown going in — card art licensing and bundle-size impact — is now resolved with a concrete, verified recommendation: **`letele/playing-cards`** (GitHub, CC0-1.0, SPDX-detected by GitHub itself, not just self-declared), a plain conversion of Adrian Kennard's classic public-domain playing-card SVGs. It ships 56 individual SVG files (52 ranks + 2 jokers + 2 backs) totaling ~572 KB raw, with court cards (J/Q/K) topping out around 40-63 KB each and number cards 1.5-2.5 KB each — this is dramatically smaller than the other well-known candidate (`notpeter/Vector-Playing-Cards`, ~8.2 MB total, with single court-card files up to 1.1 MB) while still delivering full pip/court-card fidelity. The htdebeer/SVG-cards deck referenced in `CLAUDE.md` is a viable fallback (LGPLv2.1, single 962 KB sprite file, extremely well-known) if the CC0 deck's small-repo provenance is judged too thin for this project's taste, but D-01 explicitly prefers public-domain/CC0, and the CC0 deck satisfies that outright.

The second major question — how to make TBL-04's "odds never spoil mid-animation" invariant structurally true — has a clean, verifiable answer directly from Motion's own docs and this app's existing `App.tsx` effect shape: track a `pendingAnimationCount` (not a single boolean — deal choreography animates ~13 cards concurrently) that increments when any choreography group starts and decrements per completion callback, and gate **both** branches of the existing odds effect (the cache-hit early-return AND the live-simulation start) on `pendingAnimationCount === 0`. The existing cache-hit branch in `App.tsx` currently applies cached odds synchronously with no such gate — this is the one integration point most likely to be missed, since D-12 explicitly calls out that rewind-to-cached-street must also wait for the (short) exit transition.

Testing the animation layer under jsdom has two verified, concrete gotchas the planner must account for: (1) Motion schedules post-mount renders in a microtask, so component tests must `await` a rendered-frame helper before asserting animated end-state, and (2) `useReducedMotion`/`MotionConfig reducedMotion="user"` call `window.matchMedia`, which jsdom 30.0.1 (this project's pinned version, verified by direct instantiation) does not implement — exactly the same category of gap this codebase already patched once for `<dialog>` in `src/test/setup.ts`, and it will throw at runtime the same way if not polyfilled here too.

**Primary recommendation:** Vendor `letele/playing-cards`' CC0 SVG assets into `public/cards/` (referenced via `<img>`, not inlined as React components, to keep the JS bundle free of ~572 KB of path data since only ~13 cards are ever visible at once); install `motion@13.1.1` for deal/flip choreography; add a `pendingAnimationCount` counter (new `uiStore` or extend `gameStore`) that gates both branches of `App.tsx`'s existing odds effect; and add a `window.matchMedia` polyfill to `src/test/setup.ts` alongside the existing `<dialog>` polyfill before writing any test that touches `useReducedMotion` or `MotionConfig`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Felt table / seat / community layout (TBL-01) | Browser / Client | — | Pure presentational DOM+CSS; a function of existing `gameStore` state, no new data flow |
| Card face/back art rendering (TBL-02) | Browser / Client | — | Static vendored assets resolved at build time (Vite copies `public/`), served same-origin, zero runtime network dependency |
| Deal/flip/reveal animation choreography (TBL-03) | Browser / Client | — | Motion runs entirely in the browser's compositor/JS thread; no interaction with the Web Worker or simulation engine |
| Animation-gated odds coordination (TBL-04) | Browser / Client | — | The gate is a client-side effect dependency (`App.tsx`); the Web Worker/API/engine tiers are untouched and unaware the gate exists |
| Odds computation (existing, unchanged) | API-equivalent (Web Worker) | Database/Storage-equivalent (oddsStore cache) | Out of scope for this phase — confirmed no plan should touch `src/worker/*` or `src/engine/*` |

This app has no server/API/database tiers (client-only per `CLAUDE.md` and `PROJECT.md`) — the Web Worker plays the "API" role and Zustand stores play the "Database" role for this mapping exercise. Every Phase 3 capability is Browser/Client only; if any planned task touches the worker or engine directories, that is a scope violation and should be flagged.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `motion` | 13.1.1 | Deal/flip/reveal animation | Already locked in `CLAUDE.md`; **[VERIFIED: npm registry]** `npm view motion version` → `13.1.1`, published 2026-08-20, repo `github.com/motiondivision/motion`, peerDeps `react: ^18.0.0 \|\| ^19.0.0` (React 19.2.8 compatible), no `postinstall` script, weekly downloads 18.9M (via `framer-motion` legacy alias: 43.9M/week — same maintainers, same current version, `motion` is the canonical successor package per its own repo). Confirmed absent from this project's `package.json`/`package-lock.json` today — a genuinely new install, not already present. |

### Card Art (vendored static assets — NOT an npm dependency)

| Asset Source | License | Files | Size | Recommendation |
|---|---|---|---|---|
| `letele/playing-cards` (GitHub) | **CC0-1.0** — [VERIFIED: GitHub API `license.spdx_id`] `cc0-1.0`, confirmed by GitHub's own SPDX detector against the repo's `LICENSE` file, not just a README claim | 56 SVG files: `{C,D,H,S}-{2..10,J,Q,K,A}.svg`, `J-1.svg`/`J-2.svg` (jokers), `B-1.svg`/`B-2.svg` (backs) | ~572 KB raw total; number cards 1.5-2.5 KB each; court cards (J/Q/K) 30-63 KB each; backs <1 KB each | **Primary.** Vendor the raw `.svg` files (not the npm-wrapped React components) into `public/cards/`. |

**Provenance chain (why CC0, and its one gap):** `letele/playing-cards`'s own README states its SVGs are "converted from Adrian Kennard's original designs," distributed under CC0-1.0. Adrian Kennard's original site (`me.uk/cards`) is offline today, so the primary CC0 declaration page could not be fetched directly in this research session — **this is the one unverified link in the chain, flagged below in Assumptions Log.** However, four independent derivative packages all cite the same CC0 grant from the same original author (`@letele/playing-cards` CC0-1.0, `heruka-urgyen/react-playing-cards` MIT-wrapper-of-CC0-art, `react-free-playing-cards`, `@mudont/react-ts-svg-playing-cards`), and GitHub's automated SPDX license scan on `letele/playing-cards` independently confirms the `LICENSE` file is machine-verifiable CC0-1.0 text (not just an assertion) — this is MEDIUM-HIGH confidence corroboration even without reaching the original source page.

| Fallback Asset Source | License | Files | Size | When to Use |
|---|---|---|---|---|
| `htdebeer/SVG-cards` (GitHub, already referenced in `CLAUDE.md`) | LGPLv2.1 — [VERIFIED via WebFetch of raw `LICENSE`] permits use in non-free/closed software provided the license text and copyright notice ship alongside it (trivial for an open-source-friendly repo: add a `THIRD_PARTY_LICENSES.md` or `public/cards/LICENSE`) | Single 962 KB sprite file (`svg-cards.svg`) containing all 52 cards + backs as `<symbol>` defs, referenced via `<use>` | 962 KB single file (not per-card lazy-loadable via `<img>`; would need to be inlined once and referenced via `<use href="#queen_of_hearts">`) | Use if CC0 provenance uncertainty (see Assumptions Log A1) is judged unacceptable for this project — well-known, widely cited, no smaller-repo trust concerns. Bundling mechanism differs (must inline the sprite once, not per-card `<img>`), so this is a real architectural fork, not a drop-in swap. |
| `notpeter/Vector-Playing-Cards` (GitHub) | Public domain / WTFPL — [VERIFIED via WebFetch] traced to Byron Knoll's public-domain Google Code release | 54 individual SVGs (`{rank}{SUIT}.svg`, e.g. `KC.svg`) | **~8.2 MB total**; court cards alone run 400 KB-1.1 MB each (`KC.svg` = 1.14 MB) | **Do not use as primary** — file weight is disqualifying for a web app (a single King of Clubs is over 1 MB). Documented here only so the planner doesn't independently re-discover and pick this candidate without knowing its size problem. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vendoring raw SVG files into `public/cards/` | Installing `@letele/playing-cards` as an npm dependency and using its React components | D-01 requires assets "committed into the repo as self-contained assets," which reads as vendored files, not a wrapping npm dependency; the npm package also ships all 56 cards as always-bundled JS modules (no lazy `<img>` loading), working against the bundle-size goal. Vendoring the raw `.svg` files gives full control over the `PlayingCard` mapping component (D-03) and lazy per-card network fetch. |
| `<img src="/cards/{code}.svg">` (static reference) | Inline React SVG components (SVGR-style, one component per card) | Inlining lets you theme/recolor via CSS `currentColor` and avoids an extra network request per card, but bloats the JS bundle by the full ~572 KB (all 56 cards) even though at most ~13 are ever visible at once, and adds a build step (SVGR) this project doesn't otherwise need. `<img>` from `public/` defers to the browser's own image cache and only fetches cards actually rendered. |
| `motion` (declarative `motion.div` + `AnimatePresence`) | Raw CSS `@keyframes`/`transition` + `requestAnimationFrame` completion tracking | CLAUDE.md already locks Motion; hand-rolled completion tracking would duplicate Motion's built-in `onAnimationComplete`/interruption/stagger primitives for no benefit. |

**Installation:**
```bash
npm install motion
```
No install command for card art — it is vendored (downloaded once and committed as static files under `public/cards/`), not an npm dependency.

**Version verification:** `npm view motion version` → `13.1.1` (matches `CLAUDE.md`'s locked recommendation exactly; run again at execution time in case a patch has shipped between research and execution).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `motion` | npm | Long-established (package predates this project; latest 13.1.1 published 2026-08-20) | 18.9M/week (`motion`) + 43.9M/week (`framer-motion` alias, same maintainers/version) | `github.com/motiondivision/motion` | **[OK]** — ran `slopcheck install motion` (v0.6.1) in this session; scanner reported `[OK] motion (npm)`, 1/1 packages OK. No `postinstall` script (`npm view motion scripts.postinstall` returned empty). | **Approved** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck ran successfully against the live npm registry in this session (not unavailable — no blanket `[ASSUMED]` fallback needed for `motion`). Note: slopcheck's `install` subcommand also attempts an actual `npm install` after scanning; that install step failed in this sandboxed environment (Windows subprocess spawn error) before touching `package.json`/`node_modules` — confirmed via `git status` (no changes) and `grep motion package.json` (no match). The scan verdict itself (`[OK]`) is unaffected by that downstream failure. The planner's install task should run a plain `npm install motion` directly rather than relying on slopcheck's own install step.

Card art is vendored static files, not an npm install, so it is exempt from the slopcheck gate per the package-legitimacy protocol — its legitimacy is instead established via the license/provenance verification in the Standard Stack section above.

## Architecture Patterns

### System Architecture Diagram

```
User action (deal / advance / rewind / reveal seat)
        │
        ▼
 gameStore action (deal / advanceStreet / rewindStreet / reveal)
        │  (unchanged from Phase 1-2 — mutates runout/street/revealedMask/dealNonce)
        ▼
 React re-render: TableScene reads new gameStore snapshot
        │
        ▼
 Card/seat components diff old→new visual state
        │
        ├─────────────► New cards mount (deal stagger / street-advance enter)
        │                     │
        │                     ▼
        │               Motion choreography runs (rotateY flip / fly-in stagger)
        │                     │  increments pendingAnimationCount on start
        │                     ▼
        │               onAnimationComplete fires per card
        │                     │  decrements pendingAnimationCount
        │                     ▼
        ├─────────────► Cards unmount (rewind exit fade/slide) ──────┤
        │                                                             │
        ▼                                                             ▼
                     pendingAnimationCount reaches 0
                                    │
                                    ▼
                  App.tsx odds effect (dependency: pendingAnimationCount === 0)
                                    │
                        ┌───────────┴────────────┐
                        ▼                         ▼
                cache HIT (getCached)      cache MISS
                        │                         │
                        ▼                         ▼
              applySnapshot(cached)      startSimulation(conditioned, ...)
                        │                         │  (Web Worker, unchanged
                        │                         │   from Phase 1-2)
                        ▼                         ▼
                          oddsStore updates → OddsTable / WinTieLossDisplay re-render
                          (only ever after the gate above has cleared)
```

The critical addition versus Phase 2's diagram is the `pendingAnimationCount` gate sitting **between** every state-change trigger and the existing odds effect — both the cache-hit and cache-miss paths must pass through it, not just the cache-miss (live simulation) path.

### Recommended Project Structure

```
src/
├── ui/
│   ├── TableScene.tsx        # NEW — felt oval, seat positions, deck origin (TBL-01)
│   ├── Seat.tsx               # NEW — one hero/opponent seat: 2 card slots + label/badge
│   ├── CommunityArea.tsx      # RENAME/rework of BoardDisplay.tsx — 5 board card slots on felt
│   ├── PlayingCard.tsx        # NEW — D-03's single mapping component (card code → art + flip)
│   ├── CardBack.tsx           # NEW — D-02's repeating-pattern back (CSS or vendored B-1.svg)
│   ├── HandDisplay.tsx        # EXTENDED in place — becomes hero-seat + opponent-seat data source,
│   │                          #   testids (`hero-hole`, `opponents`, `opponent-seat-{i}`) preserved
│   ├── BoardDisplay.tsx       # EXTENDED in place — testids (`board-cards`, `board-empty-state`) preserved
│   ├── CardPicker.tsx         # UNCHANGED logic — relocated trigger to a "Set Up Scenario" control (D-06)
│   ├── StreetControls.tsx     # UNCHANGED logic — relocated near felt/odds panel (D-06)
│   ├── OddsPanel.tsx          # NEW wrapper — docks WinTieLossDisplay + OddsTable outside the felt (D-05)
│   ├── WinTieLossDisplay.tsx  # UNCHANGED
│   └── OddsTable.tsx          # UNCHANGED
├── state/
│   ├── gameStore.ts           # EXTENDED — OR new uiStore.ts — adds pendingAnimationCount + increment/decrement actions
│   ├── oddsStore.ts           # UNCHANGED
│   └── simulationService.ts   # UNCHANGED
├── assets/
│   └── cardBack.svg           # NEW (if D-02's back is hand-rolled rather than vendored B-1.svg)
public/
└── cards/                     # NEW — vendored letele/playing-cards CC0 SVGs
    ├── LICENSE                # NEW — CC0-1.0 text + provenance note (Adrian Kennard via letele/playing-cards)
    ├── C-2.svg … C-A.svg
    ├── D-2.svg … D-A.svg
    ├── H-2.svg … H-A.svg
    ├── S-2.svg … S-A.svg
    └── back.svg                # (renamed from B-1.svg, or a custom back per D-02)
```

### Pattern 1: Oval Felt Layout via Absolute Positioning (not CSS Grid)

**What:** A `position: relative` felt container with each seat and the community area placed via `position: absolute` + percentage-based `top`/`left` (or `inset`) coordinates, computed to sit on/near an ellipse. CSS Grid is a poor fit here because seat positions are not on a uniform row/column axis — they sit at explicit angles around an oval (hero bottom-center, three opponents arced across top/sides).
**When to use:** Any small, fixed number of positioned elements around a curve (this app's fixed 3-opponent, 1-hero, 1-community layout — variable opponent count is explicitly out of scope per REQUIREMENTS.md, so this doesn't need to generalize).
**Example:**
```css
/* Source: standard CSS technique, cross-referenced against this project's existing
   position:absolute + percentage-inset usage in App.css's .hero/.framework/.vite rules */
.felt {
  position: relative;
  aspect-ratio: 16 / 10;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, #1a5c3a, #0d3d24);
}
.seat-hero    { position: absolute; bottom: 4%;  left: 50%; transform: translateX(-50%); }
.seat-opp-0   { position: absolute; top: 6%;     left: 20%; }
.seat-opp-1   { position: absolute; top: 2%;     left: 50%; transform: translateX(-50%); }
.seat-opp-2   { position: absolute; top: 6%;     left: 80%; transform: translateX(-100%); }
.community    { position: absolute; top: 42%;    left: 50%; transform: translateX(-50%); }
.deck-origin  { position: absolute; top: 42%;    left: 92%; }
```

### Pattern 2: Staggered Deal Choreography with Completion Counting

**What:** Each dealt card animates from the deck-origin coordinates to its seat/board slot using Motion's `animate` + `transition.delay` (via the `stagger()` helper), and a shared counter tracks how many of the concurrently-staggered cards have finished so the animation gate (Pattern 4) knows when the whole deal is done — not just when any single card finishes.
**When to use:** Initial deal (all ~13 cards) and any street-advance (1-2 newly-visible board cards).
**Example:**
```tsx
// Source: motion.dev docs (Context7 /websites/motion_dev, "stagger" + "onAnimationComplete")
import { motion, stagger } from 'motion/react';

function DealtCard({ index, total, onDealt }: { index: number; total: number; onDealt: () => void }) {
  return (
    <motion.div
      initial={{ x: deckOriginX, y: deckOriginY, opacity: 0 }}
      animate={{ x: seatX, y: seatY, opacity: 1 }}
      transition={{ duration: 0.3, delay: stagger(0.08)(index, total) }}
      onAnimationComplete={onDealt}
    />
  );
}
```

### Pattern 3: 3D Flip via rotateY + backfaceVisibility

**What:** A flip container holds two absolutely-stacked faces (card back, card front), each with `backfaceVisibility: hidden`; animating the container's `rotateY` from 0 to 180 deg reveals the front face partway through. **Requires** `transform-style: preserve-3d` on the flipping element and a `perspective` value on its parent — omitting either is the classic reason a "flip" instead looks like a flat squash or shows both faces overlapping.
**When to use:** Opponent-seat reveal (TBL-03); optionally the deal-to-face-up transition for the hero's cards if a "flip on deal" feel (rather than "already face up") is desired — D-08 does not mandate hero cards flip on initial deal, only that opponent reveal is a flip.
**Example:**
```tsx
// Source: motion.dev docs (Context7 /websites/motion_dev, "Animatable values > Transforms" —
// confirms rotateY is an independently-animatable transform axis) + standard CSS 3D-flip technique
// (backfaceVisibility/perspective/transform-style are plain CSS, not Motion-specific — [ASSUMED]
// cross-checked against well-established browser 3D-transform behavior, not Motion documentation).
function FlipCard({ faceUp, card }: { faceUp: boolean; card: Card }) {
  return (
    <div style={{ perspective: 1000 }}>
      <motion.div
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        onAnimationComplete={() => faceUp && onRevealDone()}
      >
        <div style={{ position: 'absolute', backfaceVisibility: 'hidden' }}>
          <CardBack />
        </div>
        <div style={{ position: 'absolute', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <PlayingCard card={card} />
        </div>
      </motion.div>
    </div>
  );
}
```

### Pattern 4: Animation-Gate Counter (TBL-04's structural fix)

**What:** A single numeric counter — not a boolean — because the deal stagger animates many cards concurrently and a boolean would flip `false` the instant the *first* card finishes, not the last. Increment on every choreography group start (one increment per card entering/exiting/flipping), decrement per `onAnimationComplete`. The existing `App.tsx` odds effect gates **both** its cache-hit and cache-miss branches on this counter reaching zero.
**When to use:** Every place D-11/D-12 apply: initial deal, street-advance enter, rewind exit, opponent-seat reveal flip.
**Example:**
```tsx
// Source: this project's existing src/App.tsx effect (read directly), extended per D-11/D-12.
// The load-bearing change vs. Phase 2: the cache-hit branch now ALSO waits on the gate —
// in the current Phase 2 code this branch returns immediately with no animation dependency.
useEffect(() => {
  if (!runout) return;
  if (pendingAnimationCount > 0) return; // NEW: gate both branches below

  const cached = useOddsStore.getState().getCached(street, revealedMask);
  if (cached) {
    useOddsStore.getState().applySnapshot(cached);
    return;
  }
  // ...existing live-simulation branch, unchanged...
}, [runout, street, revealedMask, dealNonce, pendingAnimationCount]); // NEW dependency
```

### Anti-Patterns to Avoid

- **Keying dealt cards by card identity across a re-deal:** If a card component is keyed by its card code (`key={card}`) rather than by seat/slot position, a re-deal (D-10) that happens to draw a different card for the same slot causes Motion to *retarget* the existing element's animation (interrupting smoothly, per Motion's built-in interruption behavior) instead of unmounting the old card and mounting a fresh one — visually this looks like one card morphing into another mid-air, which is not what "re-deal cancels cleanly and starts fresh" means. Key by `dealNonce` + seat/slot position (e.g. `key={`hero-0-${dealNonce}`}`) so a re-deal always fully unmounts and remounts, giving a clean cancel.
- **Syncing per-frame animation progress into a Zustand store:** Motion runs its own RAF loop outside React's render cycle; writing animation progress (e.g., current `x`/`rotateY`) into a store on every frame would defeat that and cause a re-render storm across every store subscriber (including `OddsTable`, which currently subscribes to the whole `oddsStore` via `useOddsStore()` rather than a narrow selector). The `pendingAnimationCount` should only change twice per animation (increment at start, decrement at completion) — never per-frame.
- **Forgetting `transform-style: preserve-3d` on the flip element or `perspective` on its parent:** produces a flat squash/fade instead of a 3D flip; this is the single most common mistake in every CSS 3D-flip tutorial referenced during this research.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Staggered multi-element entrance timing | Manual `setTimeout` per card index | Motion's `stagger()` helper (`transition.delay: stagger(0.08)`) | Handles the delay-per-index math and composes correctly with `AnimatePresence`/interruption; hand-rolled timers don't participate in Motion's automatic interrupt-and-retarget behavior. |
| Waiting for "all N staggered animations done" | A `setTimeout` sized to `(N-1)*stagger + duration` | `onAnimationComplete` per element + a counter (Pattern 4) | A duration-based timer silently drifts out of sync the moment someone tunes the stagger/duration constants (Claude's Discretion area, D-08) — the counter is correct by construction regardless of the exact timing values chosen. |
| Detecting `prefers-reduced-motion` | A hand-rolled `window.matchMedia('(prefers-reduced-motion: reduce)')` listener | Motion's `useReducedMotion()` hook / `<MotionConfig reducedMotion="user">` | Motion's hook already handles the media-query listener lifecycle (subscribe/unsubscribe on mount/unmount) and, when combined with `MotionConfig reducedMotion="user"`, automatically disables transform/layout animations app-wide without per-component conditionals. Still requires the jsdom `matchMedia` polyfill in tests (see Common Pitfalls). |
| Card rank/suit vector art | Drawing pips/court-card faces as inline SVG paths by hand | Vendored `letele/playing-cards` CC0 SVGs | This is exactly the kind of "well-trodden, solved problem" `CLAUDE.md` already calls out for hand evaluation — the same principle applies to vector card art: getting court-card proportions, pip layout, and corner indices right is solved, licensed, and free. |

**Key insight:** Everything hand-written in this phase should be orchestration/composition (which card animates when, which store field gates which effect) — never the animation primitives themselves (stagger math, interruption, reduced-motion detection) or the card artwork.

## Common Pitfalls

### Pitfall 1: The cache-hit branch of the odds effect is not currently gated on anything
**What goes wrong:** A planner extends only the live-simulation (cache-miss) branch of `App.tsx`'s effect with the animation gate, leaving the cache-hit branch (`if (cached) { applySnapshot(cached); return; }`) unchanged. Rewinding to a previously-settled street then shows the cached odds instantly, before the board-card exit fade/slide has visually finished — exactly the TBL-04/D-12 violation this phase exists to prevent.
**Why it happens:** The cache-hit branch was written in Phase 2 specifically to be a fast, side-effect-free early return (no cleanup function, no worker call) — it's easy to treat it as "already fine" because it has no timing dependency on the *worker*, only forgetting it now has a new timing dependency on the *animation*.
**How to avoid:** Place the `pendingAnimationCount > 0` check as the very first line of the effect body, before the cache lookup — see Pattern 4's code example.
**Warning signs:** A test that rewinds through several already-visited streets in quick succession and asserts odds never flash a "wrong" value before settling.

### Pitfall 2: jsdom does not implement `window.matchMedia` — verified, not assumed
**What goes wrong:** Any test that renders a component wrapped in `<MotionConfig reducedMotion="user">` or calling `useReducedMotion()` throws `TypeError: window.matchMedia is not a function` under this project's jsdom setup.
**Why it happens:** [VERIFIED] Directly instantiated `jsdom@30.0.1` (this project's pinned version, from `package.json`) in this research session and confirmed `typeof window.matchMedia === 'undefined'`. This is the same category of gap already documented and patched once in `src/test/setup.ts` for `HTMLDialogElement.showModal`/`.close()`.
**How to avoid:** Add a `window.matchMedia` polyfill to `src/test/setup.ts` (guarded the same way the dialog polyfill is, since some suites run under `@vitest-environment node` with no DOM globals at all) before writing any test that touches reduced-motion behavior. A minimal stub returning `{ matches: false, addEventListener() {}, removeEventListener() {} }` (or reading a settable flag for reduced-motion-specific test cases) is sufficient — Motion only needs the shape, not real media-query evaluation, in a test environment.
**Warning signs:** Any new component test fails immediately on render (not on interaction) with a `matchMedia` TypeError the moment `MotionConfig`/`useReducedMotion` is introduced.

### Pitfall 3: Motion schedules post-mount renders in a microtask — synchronous assertions will read stale DOM
**What goes wrong:** A test renders a `motion.div` with `initial`/`animate` values and immediately asserts computed style or attribute state without awaiting anything; the assertion reads the pre-animation (initial) state because Motion's actual DOM write for the post-mount transition happens in a microtask/animation-frame callback, not synchronously during React's render.
**Why it happens:** [CITED: motion.dev react-upgrade-guide] "Motion components schedule post-mount renders within a microtask rather than synchronously... In testing environments like Jest, tests must await an animation frame rather than assuming synchronous application of updates."
**How to avoid:** In test-mode, prefer forcing `transition={{ duration: 0 }}` (or wrap tests in reduced-motion-forced state) so the end state lands as fast as possible, and still `await` a `waitFor(...)` (already available via `@testing-library/react`, already used elsewhere in this codebase's testing conventions) or a small `nextFrame()` helper built on Motion's own `frame.postRender()` before asserting animated end-state or that `onAnimationComplete` fired.
**Warning signs:** A newly-written animation test is flaky or fails on the very first assertion after render, but passes if an `await screen.findBy...` or `await waitFor(...)` is inserted first.

### Pitfall 4: Bundling all 56 card SVGs as inline React components defeats the file-size research
**What goes wrong:** A planner (or an implementer following a generic "SVG in React" habit) imports every card as an SVGR-generated React component and bundles all 56 into the main JS chunk — reintroducing ~572 KB of always-loaded path data even though this research specifically chose per-file assets to avoid exactly that.
**Why it happens:** Inlining is the more commonly-tutorialized React pattern for "a set of icon/asset components," and it enables CSS `currentColor` theming, which can seem attractive.
**How to avoid:** Reference vendored cards via `<img src={`/cards/${assetName}.svg`} />` from `public/cards/`, resolved through the single `PlayingCard` mapping component (D-03) — only the ~13 cards actually rendered in a given hand ever get network-fetched, and the browser's own HTTP cache handles repeats across hands.
**Warning signs:** A production build's JS bundle size analysis shows an unexpectedly large chunk attributable to card SVG path data.

### Pitfall 5: Card asset filename mapping (`Card` union → vendored deck's naming) is a manual, easy-to-transpose mapping
**What goes wrong:** This project's `Card` type uses lowercase suits and `'T'` for ten (e.g. `"Td"`, `"As"` — [VERIFIED] read directly from `node_modules/@poker-apprentice/types/dist/types/constants.d.ts`), while the vendored deck names files `{SUIT}-{RANK}.svg` with **uppercase** suit letters and `"10"` (not `"T"`) for ten (e.g. `"D-10.svg"`, `"S-A.svg"` — verified via the repo's own file listing). A hand-transposed rank/suit map is an easy place to introduce an off-by-one or letter-case bug that only surfaces for the ten and/or one specific suit.
**Why it happens:** Two independently-designed naming schemes for the same 52 values, with no shared convention.
**How to avoid:** Use the existing `getRank(card)`/`getSuit(card)` helpers already exported from `@poker-apprentice/types` (already imported elsewhere in this codebase, e.g. `CardPicker.tsx`) rather than manual string slicing, and write the rank/suit lookup tables as small, exhaustively-typed `Record<Rank, string>`/`Record<Suit, string>` maps so TypeScript flags any missing case at compile time. See Code Examples below.
**Warning signs:** A picked "Ten" card renders as a blank/404 image while every other rank renders fine.

## Code Examples

### PlayingCard mapping component (D-03)

```tsx
// Source: this project's own src/engine/cards.ts + @poker-apprentice/types (getRank/getSuit
// verified via node_modules/@poker-apprentice/types/dist/types/*.d.ts) combined with the
// vendored letele/playing-cards filename convention (verified via GitHub API directory listing).
import { getRank, getSuit } from '@poker-apprentice/types';
import type { Card } from '@poker-apprentice/types';

const SUIT_TO_ASSET: Record<string, string> = { c: 'C', d: 'D', h: 'H', s: 'S' };
const RANK_TO_ASSET: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A',
};

function cardAssetPath(card: Card): string {
  const suit = SUIT_TO_ASSET[getSuit(card)];
  const rank = RANK_TO_ASSET[getRank(card)];
  return `/cards/${suit}-${rank}.svg`;
}

export function PlayingCard({ card, faceUp }: { card: Card; faceUp: boolean }) {
  if (!faceUp) return <CardBack />;
  return <img src={cardAssetPath(card)} alt={card} width={90} height={126} />;
}
```

### matchMedia polyfill for test setup (mirrors the existing `<dialog>` pattern)

```ts
// Source: pattern mirrors src/test/setup.ts's existing HTMLDialogElement polyfill exactly;
// the underlying jsdom gap is [VERIFIED] via direct jsdom@30.0.1 instantiation in this session.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` as the package name | `motion` as the canonical package (with `framer-motion` retained as a compatibility alias, same version/maintainers) | Documented in `CLAUDE.md` already (2025/2026 rename); [VERIFIED] `npm view framer-motion version` returns the identical `13.1.1` as `npm view motion version` today | Install `motion`, not `framer-motion` — both resolve to the same code today, but `motion` is the forward-looking name and matches the locked stack decision. |
| Motion synchronous post-mount DOM writes (pre-11.0) | Post-mount renders scheduled in a microtask (11.0+) | [CITED: motion.dev react-upgrade-guide] | Any test-writing guidance found in older tutorials/StackOverflow answers describing synchronous assertions immediately after render is stale for the version this project installs — always await a frame/microtask (Pitfall 3). |

**Deprecated/outdated:** None specific to this phase beyond the framer-motion→motion rename already captured in `CLAUDE.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `letele/playing-cards`' SVG assets genuinely trace back to a CC0 dedication by Adrian Kennard | Standard Stack → Card Art | The original `me.uk/cards` declaration page is offline and could not be directly fetched in this session; if the CC0 claim is somehow inaccurate, the fallback is `htdebeer/SVG-cards` (LGPLv2.1, verified license text, well-known/widely-cited repo) — swapping requires re-doing the bundling mechanism (single sprite + `<use>` instead of per-file `<img>`), not just a license-file change. Mitigated by 4 independent derivative repos + GitHub's own SPDX detection agreeing on CC0-1.0, but the primary source itself is unreachable. |
| A2 | `backfaceVisibility`, `transform-style: preserve-3d`, and `perspective` behave as standard CSS 3D-transform properties when set via Motion's `style` prop (i.e., Motion passes them through unmodified rather than intercepting them) | Architecture Patterns → Pattern 3 | These are not Motion-animated values (Motion's docs only confirm `rotateY`/`rotateX`/`rotateZ` as animatable transform axes); the claim that the *static* companion properties pass through untouched is standard CSS/React behavior, not something Motion's docs specifically confirm, so it is marked [ASSUMED] rather than [CITED]. Low risk — this is a well-established, decades-old CSS technique independent of any animation library. |
| A3 | The `letele/playing-cards` repo (3 GitHub stars, last pushed 2023) will remain reachable long enough to vendor its assets before/during phase execution | Standard Stack → Card Art | Low risk since D-01 requires vendoring (a one-time download, then committed to this repo) rather than an ongoing dependency — even if the source repo disappears after vendoring, the already-committed files are unaffected. Recommend downloading and committing the assets as one of the first tasks in the phase plan, before other work depends on their exact filenames. |

## Open Questions (RESOLVED)

Both questions were resolved during UI-SPEC generation — RESOLVED: see `03-UI-SPEC.md` Autonomous Resolution Log rows A2 (card-back design: vendored back with CSS-filter tint to the app palette) and A3 (deal stagger: dealer-rotation order). Plans 03-01 Task 1 and 03-03 Task 2 implement these resolutions.

1. **Should the vendored card back use one of the deck's own `B-1.svg`/`B-2.svg` designs, or a hand-rolled CSS/SVG pattern?**
   - What we know: D-02 only requires "a simple repeating pattern (CSS or SVG) consistent across all hidden cards"; the vendored deck includes two back designs (tiny, <1 KB each) that would match the face-card style/border exactly.
   - What's unclear: Whether a licensing/attribution note is even needed for something this simple (CC0 requires none regardless), or whether the project would rather have a fully custom felt-matching back design (e.g., a purple/gold pattern matching `--accent`) for brand consistency with the rest of the app's existing color system.
   - Recommendation: Default to vendoring `B-1.svg` (visual consistency with the face cards' border/corner style, zero extra design work) unless the planner's UI research (a separate `03-UI-SPEC.md`/UI researcher pass, if this project runs one) recommends a themed back matching the app's purple accent palette.

2. **Exact deck-origin coordinates and stagger order (deal to hero first vs. dealer-order/left-to-right) are unspecified.**
   - What we know: D-08 explicitly leaves exact durations/easings/deck-origin placement to Claude's Discretion.
   - What's unclear: Whether "snappy, not sluggish" implies dealing hero cards first (so the user's own hand resolves fastest) or following real-table dealer order (opponent-0, opponent-1, opponent-2, hero, repeat for second card) for authenticity.
   - Recommendation: Real-table dealer order (each seat gets one card in rotation, then a second pass) reads as more "casino-authentic" per the phase's stated goal ("full table feel... visual craft is part of the deliverable") and is a trivial ordering choice within the same stagger mechanism — no architectural impact either way, safe to leave as an implementation-time choice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Installing `motion`, running the existing Vite/Vitest toolchain | ✓ (proven — `npm test` ran 120/120 passing in this session) | matches `package.json` engine expectations already in use | — |
| Network access (one-time, at asset-vendoring time) | Downloading the ~572 KB of CC0 SVGs from `letele/playing-cards` into `public/cards/` | ✓ (proven — fetched via GitHub API/raw content in this research session) | — | If network access is unavailable at execution time, the exact same files can be vendored from any of the corroborating derivative repos (`heruka-urgyen/react-playing-cards`, `react-free-playing-cards`) since they ship identical Adrian Kennard-derived art. |
| npm registry access | `npm install motion` | ✓ (proven — `npm view motion ...` succeeded repeatedly in this session) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none currently missing — network/registry access both confirmed working in this research session; noted above only for completeness in case execution happens in a different, more restricted environment.

## Security Domain

This is a fully client-side, backend-free application (confirmed by `PROJECT.md`/`CLAUDE.md` — "Server backend" is explicitly out of scope). Phase 3 adds no network calls (all new assets are same-origin static files bundled at build time), no user-supplied data paths, no authentication, and no persistence. The ASVS categories most relevant to typical web apps are largely not applicable here.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth in this app at any phase. |
| V3 Session Management | No | No sessions/cookies. |
| V4 Access Control | No | Single-user, no roles/permissions. |
| V5 Input Validation | Marginal | Card codes flow only from the closed `Card` string union (compile-time type, verified via `@poker-apprentice/types`), never from free-text user input reaching the DOM — no injection surface. The `PlayingCard` mapping component (D-03) should still defensively fall back to a neutral "unknown card" state rather than constructing an unchecked asset URL string, as basic robustness rather than a security control. |
| V6 Cryptography | No | No secrets, no crypto in this app. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SVG-based XSS via `dangerouslySetInnerHTML` of untrusted markup | Tampering / Elevation of Privilege | Not applicable as designed — card art is referenced via `<img src="...">` (browser treats SVG-as-image as a raster-equivalent, sandboxed context with no script execution) rather than inlined via `dangerouslySetInnerHTML`. If a future change ever inlines SVG markup directly into the DOM, it must only ever be the vendored, repo-committed files (never a runtime/user-supplied string). |
| Supply-chain tampering via CDN-hosted assets | Tampering | Already eliminated by design: D-01 mandates vendoring (committed to the repo at a known commit) rather than any CDN/runtime fetch — there is no runtime dependency on `letele/playing-cards`' GitHub repo staying available or unmodified. |

## Sources

### Primary (HIGH confidence)
- Context7 (`ctx7` CLI) `/websites/motion_dev` — `rotateY`/transform-axis animatability, `stagger()` helper, `onAnimationComplete` prop, `AnimatePresence`/`onExitComplete`, `MotionConfig reducedMotion`, `useReducedMotion`, animation interruption/retargeting behavior, microtask post-mount render scheduling and required test-await pattern
- `npm view motion version|time.modified|repository.url|scripts.postinstall|peerDependencies|exports` (live registry query, 2026-08-24) — version 13.1.1, publish date, repo, no postinstall, React 18/19 peer range, subpath exports (`.`, `./react`)
- `npm view framer-motion version` (live registry query) — confirms `13.1.1`, same as `motion` (alias confirmation)
- `slopcheck install motion` (v0.6.1, run live against npm registry in this session) — `[OK]` verdict
- GitHub REST API (`api.github.com/repos/letele/playing-cards`, `.../contents/assets`) — CC0-1.0 SPDX license detection, 56-file listing with exact byte sizes
- GitHub REST API (`api.github.com/repos/notpeter/Vector-Playing-Cards/contents/cards-svg`) — 54-file listing with exact byte sizes (up to 1.14 MB for a single court card)
- Direct read of this project's own source: `src/App.tsx`, `src/state/gameStore.ts`, `src/state/oddsStore.ts`, `src/ui/HandDisplay.tsx`, `src/ui/BoardDisplay.tsx`, `src/ui/StreetControls.tsx`, `src/ui/WinTieLossDisplay.tsx`, `src/ui/OddsTable.tsx`, `src/test/setup.ts`, `src/index.css`, `src/App.css`, `package.json`, `index.html`, `node_modules/@poker-apprentice/types/dist/types/*.d.ts`
- Direct `jsdom@30.0.1` instantiation in this session (`new JSDOM(); typeof dom.window.matchMedia`) — confirmed `undefined`
- `npm test` run in this session — 120/120 tests passing (regression baseline confirmed, not assumed)

### Secondary (MEDIUM confidence)
- WebFetch of raw `LICENSE`/`README.md` for `letele/playing-cards`, `htdebeer/SVG-cards`, `notpeter/Vector-Playing-Cards` — license text summaries
- WebSearch cross-referencing 4+ independent packages (`@letele/playing-cards`, `heruka-urgyen/react-playing-cards`, `react-free-playing-cards`, `@mudont/react-ts-svg-playing-cards`) all citing Adrian Kennard's CC0 SVG playing cards as their common source

### Tertiary (LOW confidence)
- The specific claim that Adrian Kennard's original `me.uk/cards` page declared CC0 — could not be fetched directly (site offline, archive.org unreachable from this environment); relies entirely on derivative-repo citation (see Assumptions Log A1)

## Metadata

**Confidence breakdown:**
- Standard stack (Motion): HIGH — directly verified via live npm registry queries and official Context7-sourced docs
- Card art licensing: MEDIUM-HIGH — the chosen deck's own license file is machine-verified (GitHub SPDX), but the ultimate original-author provenance one hop further back is unreachable (see A1)
- Architecture (animation gate, layout): HIGH — derived directly from this project's own existing, working `App.tsx`/store code plus verified Motion primitives
- Pitfalls: HIGH — the two jsdom/Motion testing gotchas were independently verified (direct jsdom instantiation; official Motion upgrade-guide docs), not inferred

**Research date:** 2026-08-24
**Valid until:** 30 days (stable domain — Motion and the vendored card assets are not fast-moving; re-verify `npm view motion version` if execution starts materially later than this date)
