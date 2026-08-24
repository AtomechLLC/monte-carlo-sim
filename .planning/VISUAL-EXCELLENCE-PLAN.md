# Visual Excellence Plan — dramatically improving the simulator's visual quality

Drafted 2026-08-24 at the user's request, mid-v2.0. A phase-shaped plan ready to insert into the roadmap (recommended: **Phase 9**, immediately after v2.0's Phase 8, so it skins the finished two-game product). Consumable by `/gsd:phase --insert 9` + the standard discuss→plan→execute chain.

## Where the visuals stand today (honest assessment)

The v1/v2 UI is *correct* but utilitarian: a flat CSS felt oval, plain-text odds panel, default-ish typography, functional-but-personality-free animations, and no environmental depth. The card art (vendored CC0 deck) is the strongest visual element; everything around it reads as a prototype. "Visual craft is part of the deliverable, not a skin" (PROJECT.md constraint) is only half-honored.

## Goal

**As a** player sitting at the table, **I want** the simulator to look and feel like a crafted casino environment with beautifully presented information, **so that** the probability lessons land inside an experience that feels premium rather than clinical.

## The six pillars

### 1. Environment & atmosphere (the room)
- Layered felt: subtle procedural texture (SVG turbulence/noise), radial lighting vignette from a consistent overhead source, deeper rim shadow.
- Wooden table rail with highlight/lowlight edges wrapping the oval; padded-leather look via CSS gradients (no images needed beyond maybe one small SVG texture).
- Ambient page environment: deep casino-dark backdrop with a faint radial glow centered on the table; the page must no longer read as "content on a website."
- A consistent elevation system: cards cast soft shadows; seats sit ON the felt; in-flight cards lift (bigger shadow + slight scale) and settle.

### 2. Card presentation (the stars)
- Rest/hover/lift states with shadow depth; dealt cards land with a settle micro-bounce (respecting reduced-motion).
- Deal trajectories get arcs (slight curve + rotation drift) instead of straight lines; per-card rotation jitter (±2-3°) at rest so hands look hand-placed, not machine-aligned (deterministic per slot+nonce — no Math.random).
- Reveal flip gains a brief highlight sweep; the revealed pair gets a momentary glow ring to draw the eye (ties to the odds shift).
- Deck stack rendered as a proper fanned stack with edge highlights.

### 3. Information design (the numbers ARE the product)
- Odds panel redesigned as a proper instrument cluster: hero-sized win% with tabular-numeral font, tie/loss as satellites, the trial counter as a subtle progress ring or thin bar to 200k.
- Category table becomes label + inline probability BAR + percentage — the distribution becomes visible as shape, not just digits. Five-of-a-kind row (P7) and locked-in ✓ get distinct treatments.
- Convergence made felt: digits animate (damped count-up), and a subtle "settled" state change (weight/glow) when the run completes — the settling IS the lesson.
- Blackjack cluster (dealer distribution buckets, bust-if-hit, EV cards) gets the same treatment — EV cards styled as decision tiles.
- Delta indicators on knowledge changes (reveal/street): brief `▲/▼ from x%` ghosts (pulls forward the queued IMPROVEMENTS item 6).

### 4. Motion personality
- One easing vocabulary (e.g. custom cubic-beziers for deal/flip/settle) documented as tokens; no default `ease` anywhere.
- Micro-interactions: buttons depress, seats respond to hover, the switcher slides its active pill instead of snapping.
- All gated behaviors unchanged: the animation gate, reduced-motion instant paths, and restore-mount instant swap are load-bearing contracts — polish layers on top, never around.

### 5. Typography & identity
- A real typeface pairing, self-hosted (bundle a variable font — e.g. a humanist sans for UI + tabular numerals for odds); no CDN (offline constraint).
- Type scale refresh within the existing 4-size discipline; letter-spacing/weight tuning for the display numbers.
- App identity: refined favicon already exists; add a small wordmark treatment for the h1.

### 6. Layout & responsiveness
- Composition pass: the felt + odds cluster as one designed spread at desktop; the odds panel becomes a styled sidebar card with its own surface elevation.
- The deferred responsive pass folds in here: graceful 768-1180px behavior (stacked odds below felt), eliminating the hero/community overlap at ALL widths (closes IMPROVEMENTS item 17's cosmetic thread and the earlier overlap fix's residual).

## Constraints (locked)

- Stack stays DOM + SVG + Motion (CLAUDE.md; Konva only if measured jank). No canvas, no new heavy deps; a bundled font file and possibly tiny SVG textures are the only new assets.
- Every contractual `data-testid` and the full test suite (388+) stay green; visual work must be presentation-layer.
- Accessibility floors hold: contrast ratios verified for all new colors, 44px hit areas, `prefers-reduced-motion` yields instant-but-still-styled states.
- UI-SPEC system evolves, not forks: new tokens (elevation scale, easing tokens, texture assets, font stack) extend the existing custom-property system; accent budget renegotiated explicitly in the phase's UI-SPEC.
- TBL-04's invariant untouched: odds never move while cards fly.

## Quality gates (how "dramatically better" gets proven)

1. **Playwright visual harness first** (pulls forward IMPROVEMENTS item 4): screenshot baselines per scene state (empty, dealt, flop, reveal, blackjack decision point) at 2 viewports, diffed in CI fashion — the phase's own before/after evidence and the project's long-missing real-motion coverage.
2. `/gsd:ui-phase` design contract with the new token system BEFORE implementation; `/gsd:ui-review` 6-pillar audit AFTER.
3. Human checkpoint with side-by-side before/after screenshots per pillar.
4. Performance budget: deal choreography holds 60fps on a mid-tier laptop (measured via Playwright tracing), bundle growth < 300KB (font + textures).

## Phase shape (when inserted)

| Plan | Scope | Effort |
|------|-------|--------|
| 1 | Playwright visual harness + baseline captures | M |
| 2 | Environment: felt/rail/backdrop/elevation tokens | M |
| 3 | Card presentation & motion personality | M |
| 4 | Information design: odds cluster + category bars + convergence animation (+ deltas) | M-L |
| 5 | Typography/identity + responsive composition pass | M |
| 6 | UI review audit + acceptance checkpoint | S |

Estimated: a full phase (~5-6 plans), comparable to Phase 3's scope.

## Sequencing recommendation

**Insert as Phase 9, after Phase 8** — the polish then covers Blackjack's table and the deck toggle rather than needing a second pass. If visual quality is more urgent than the remaining v2.0 features, it CAN run before Phase 7 (it touches presentation only), at the cost of a small re-skin of whatever P7/P8 add later.

## Explicitly out of scope

Sound, chip/betting visuals (PROJECT constraint), 3D/WebGL table, camera moves, mobile-first redesign beyond the responsive pass, dark/light theme switching (single dark casino theme is the identity).
