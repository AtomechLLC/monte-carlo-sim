<!-- GSD:project-start source:PROJECT.md -->
## Project

**Monte Carlo Poker Simulator**

A graphical Monte Carlo simulator for Texas Hold'em, running in the browser as a full casino-style poker table. The user sits at a felt table with detailed, animated playing cards and three anonymous opponents, and watches live-computed odds — the probability of making each hand category and the probability of winning — evolve as the hand advances through pre-flop, flop, turn, and river. It's a game design learning tool: a way to make probability and randomness visible, explorable, and intuitive.

**Core Value:** Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information (a dealt street, a revealed opponent) reshapes the numbers.

### Constraints

- **Platform**: Browser-based web app — zero install, easy to share, and canvas/SVG rendering suits detailed card visuals
- **Architecture**: Client-side simulation — Monte Carlo trials must run fast enough in the browser to feel live (likely Web Worker territory to keep the UI responsive)
- **Fidelity**: Full table feel — felt table, seated opponents, animated cards; visual craft is part of the deliverable, not a skin
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| React | 19.2.8 | UI framework | Largest ecosystem for exactly the pieces this app needs: SVG card component patterns, animation libraries with first-class React bindings, and Web Worker/hook patterns. React 19's compiler removes most manual memoization concerns, closing the gap with more "surgical" frameworks for the update frequency this app has (odds table refreshing a few times/sec, not per-frame). For a solo/portfolio project, ecosystem depth and AI-tooling familiarity outweigh Svelte's raw micro-benchmark edge (see Alternatives). |
| Vite | 8.2.2 | Build tool / dev server | The 2025/2026 default for client-only SPAs — instant HMR, native ESM dev server, first-class Web Worker support via the `?worker` import suffix (no separate worker-loader config), and zero-config production bundling with automatic code-splitting. No SSR/server framework (Next.js, Remix) is needed — this is a pure client-side app with no backend, so a server-oriented meta-framework would add complexity with no payoff. |
| TypeScript | 6.0.3 | Language / type system | Use the 6.x line, **not** 7.0.2, despite 7.0 being `npm dist-tag latest`. TypeScript 7.0 (the Go-native "tsgo" compiler, GA July 2026, ~10x faster type-checking) ships **without a compiler API**, so `typescript-eslint` (and other API-dependent tooling) does not yet support it — confirmed as "not planned" for 7.0, targeted for TS 7.1 in autumn 2026. Pin `typescript@6.0.3` for full ecosystem compatibility today; revisit TS 7.1 once it's GA and typescript-eslint adds support. |
| Zustand | 5.0.15 | Client state management | Manages simulation state (current street, hole/board cards, revealed opponents, live trial counts/odds) without Redux-style boilerplate. ~1KB, no providers needed, plays well with a Web Worker feeding it streamed updates. No server state exists in this app (no backend), so a data-fetching layer like TanStack Query is unnecessary — Zustand alone is the complete state story. |
### Rendering Approach (the key architectural decision)
| Approach | Verdict | Why |
|----------|---------|-----|
| **DOM + SVG + Motion (recommended)** | ✅ Use this | The scene has a small, bounded element count: 4 seats × 2 hole cards + 5 community cards + felt table + seat markers + an odds table ≈ 15-20 animated visual elements plus a data-dense HTML table. SVG "works beautifully up to a few thousand elements" — this app uses a tiny fraction of that ceiling, so canvas's performance advantage never materializes. SVG is also natively vector, which is exactly what "detailed pips and proper court cards" calls for — no rasterization/texture-atlas work needed. Critically, the odds table (live-updating percentages, hand-category rows) is inherently tabular text data — DOM/HTML is dramatically better than canvas for text rendering, accessibility, and layout than drawing text manually onto a `<canvas>`. |
| PixiJS 8.20.0 | ❌ Avoid | A WebGL sprite engine built for hundreds/thousands of moving sprites (games, particle effects). This project has ~13 cards on screen at once. PixiJS adds WebGL context management, texture-atlas asset pipeline, and a completely separate rendering/hit-testing model from the DOM-based odds UI — real complexity with no performance payoff at this element count. |
| Konva 10.3.1 / react-konva | ❌ Avoid (but closest runner-up) | Konva's strength is a canvas-based retained-mode scene graph with built-in drag/drop and hit detection — useful for card games with many freely-draggable pieces (e.g., a full solitaire tableau). This app's interactions are simpler (click a seat to reveal, click a card slot to open a picker), which DOM click handlers already do natively and accessibly. Reconsider Konva only if playtesting reveals CSS-transform card animations are janky on low-end/mobile devices (see Stack Patterns by Variant). |
### Animation
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| Motion (`motion` package, formerly Framer Motion) | 13.1.1 | Deal, flip, and reveal animations | Purpose-built for exactly this: declarative `animate`/`variants` API for the deal-from-deck movement, `rotateY` + `backfaceVisibility: hidden` for the classic 3D card-flip reveal, and layout animations (FLIP technique) for cards moving between deck → seat → community row as streets advance. First-class React bindings, actively maintained, and the de facto standard React animation library in 2025/2026 (the `framer-motion` package name still works as an alias but `motion` is the current canonical package). |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@poker-apprentice/hand-evaluator` | 4.3.0 | Fast hand evaluation + Hold'em equity primitives | **Primary recommendation** for hand evaluation. v4 (June 2026 rewrite) replaced the core with an integer/lookup-table evaluator, ~18M 7-card evaluations/sec (Apple M3 Pro benchmark), pure TypeScript with no Node-only APIs (Rollup-built ESM + CJS + type defs, only dependency is a types-only package) — safe to run inside a Web Worker. Actively maintained (published as recently as July 2026). Has a purpose-built `equityHoldem` helper (win/tie/total/equity) AND lower-level `evaluate`/`rank` primitives you'll need anyway to build the **hand-category distribution** (pair/flush/straight/etc. frequency) this project requires — `equityHoldem` alone only returns win/tie/total, not category breakdowns, so plan to write a thin custom Monte Carlo loop around the raw evaluator (see Architecture research / PITFALLS.md). |
| `@pokertools/evaluator` | 1.0.16 | Alternative fast evaluator | Newer (created Nov 2025) perfect-hash + lookup-table evaluator, benchmarked ~15-20M evals/sec for 5-card and ~10-12M/sec for 7-card hands, with a documented test suite verifying all 2.6M 5-card and 20.3M 6-card combinations. Consider as a fallback/comparison if `@poker-apprentice/hand-evaluator` has an API mismatch, or if profiling shows you need the raw speed edge — but it's a much younger project (6 GitHub stars at research time) so carries more adoption risk. |
| Comlink | 4.4.2 | Web Worker RPC | Wraps `postMessage` boilerplate so the simulation worker can be called (and can call back with progress) like a local async function/callback. Use `Comlink.proxy()` to pass a progress-reporting callback from the main thread into the worker so partial results (running win/tie/loss + hand-category counts) can stream back for the "live convergence" requirement, rather than waiting for a final result. |
| `pure-rand` | 8.4.2 | Seedable, statistically-vetted PRNG | Use instead of `Math.random()` for the deck shuffle / trial sampling. A seedable RNG (e.g. xoroshiro128+) makes simulations **reproducible** — essential for writing deterministic unit tests of the probability math (see Testing below) and for potential future "replay this exact deal" features. Also the RNG engine `fast-check` itself uses internally, so no new statistical-quality risk. |
| Immer | 11.1.18 | Immutable state updates | Optional. Useful if the Zustand store's card/street state gets nested enough that hand-written spread updates get error-prone (e.g., updating one opponent's revealed status inside an array of 3 opponents inside a street-indexed history for rewind). Skip it if the store stays flat. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | 10.9.0 | Linting | Flat config (`eslint.config.js`) is standard now; requires Node `^20.19.0 \|\| ^22.13.0 \|\| >=24`. |
| `typescript-eslint` | 8.67.0 | TS-aware lint rules | Peer-depends on TypeScript `>=4.8.4 <6.1.0` at research time — confirms pinning TypeScript to the 6.x line (see Core Technologies) rather than 7.0. |
| Prettier | 3.9.6 | Formatting | Standard, no notable config needed for this project. |
| `@vitejs/plugin-react` | 6.1.0 | Vite React integration | Enables Fast Refresh; use the default (Babel-based) transform unless you specifically want the React Compiler's oxc/SWC path. |
## Web Workers for Monte Carlo Trials
- Import the worker with Vite's built-in syntax: `import MyWorker from './simulation.worker.ts?worker'` — no bundler config needed, worker code gets its own chunk in production, ESM imports work natively inside the worker during dev.
- Run the Monte Carlo loop (random-complete the unknown hole/board cards many times, evaluate all 4 hands with the lookup-table evaluator, tally win/tie/loss + hand-category counts per player) entirely inside the worker so the main thread and UI stay responsive.
- Stream partial aggregates back periodically (e.g., every few thousand trials or every ~50-100ms via a `Comlink.proxy()` progress callback) rather than only returning a final result — this is what makes the "watch the percentages converge live" requirement actually visible, and it's a well-established pattern (confirmed via multiple 2025 Comlink + Web Worker writeups).
- At this app's scale (13 cards, 3 opponents, small integer tallies as payload) there's no need for `Transferable`/`SharedArrayBuffer` optimization — the data crossing the worker boundary is tiny. Don't add that complexity preemptively.
- Re-run/cancel: when the user advances/rewinds a street or reveals an opponent, terminate or signal the in-flight worker loop and restart with the new known/unknown card partition — don't let a stale simulation keep writing to the store.
## Poker Hand Evaluation: Library vs. Hand-Rolled
- Writing a correct *and* fast 7-card evaluator from scratch (perfect-hash or Two-Plus-Two-style lookup tables) is a well-trodden, solved problem — there's no learning-goal or product reason to reinvent it, and getting hand ranking edge cases right (wheel straights, kicker ordering, best-5-of-7 selection) is exactly the kind of thing that's easy to get subtly wrong.
- Avoid the older, once-popular options: **`pokersolver`** (last published 2020, unmaintained) and the original **`poker-evaluator`**/**`poker-evaluator-ts`** (dependency tree still pinned to TypeScript ^3.7 and `@types/node` ^13, and historically ships its lookup table via a pattern that trips up bundlers expecting `fs.readFileSync` to work — a known Webpack/Vite footgun for browser targets). Both are functionally superseded by the actively-maintained options above.
- The orchestration layer (looping N trials, drawing from the remaining deck respecting already-known cards, tallying results, streaming partial progress) is specific enough to this app's exact requirements (rewind, manual reveal, live convergence) that it should be hand-written — no off-the-shelf "poker equity calculator" package will match the interaction model (forward/backward street navigation, opponent-reveal mid-simulation) out of the box.
## Testing Tools for Probability Math
| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| Vitest | 4.1.11 | Unit/integration test runner | Native Vite integration (shares config/transform pipeline), fast, ESM-native — the default pairing with a Vite app. Use it for the simulation engine, hand evaluator wrapper, and deck/shuffle logic — the actual math this app lives or dies on. |
| `fast-check` | 4.9.0 | Property-based testing | The right tool for probability code: instead of asserting exact output on a handful of hand-picked hands, assert *invariants* that must hold for any input — e.g. "win% + tie% + loss% always sums to ~1", "a evaluated hand's category is never better than a strictly stronger 7-card hand's category", "revealing a card never increases another player's probability of holding it". `fast-check` generates hundreds of randomized card/board combinations per run and shrinks failures to a minimal reproducing case. 10M+ weekly downloads, ships its own TS types. |
| `@fast-check/vitest` | 0.4.1 | Vitest integration for fast-check | Thin adapter so `fc.test`/property assertions read as native Vitest tests (`it.prop`) instead of manual `fc.assert(fc.property(...))` boilerplate. |
| `@testing-library/react` | 16.3.2 | Component testing | For UI-level tests (does the odds table re-render with new numbers, does clicking a seat trigger reveal state) — pairs with `@testing-library/user-event` (14.6.6) and `@testing-library/jest-dom` (7.0.1) matchers, run under Vitest. |
| `@playwright/test` | 1.62.1 | End-to-end smoke tests | Use sparingly — one or two E2E flows (deal a hand, advance through all streets, watch odds converge and settle, reveal an opponent) to catch integration breaks across the worker/UI boundary that unit tests can't. Not a substitute for the property-based math tests above. |
- For scenarios where exact odds are known/computable (e.g., pre-flop heads-up hand vs. random hand equities are widely published; a fully-determined board with all cards known has a deterministic single "trial" outcome), assert the simulation's output converges within a tolerance band (e.g., ±1-2%) of the known value after N trials — this is a statistical assertion, not an exact-equality one; use a generous epsilon and a fixed seed (via `pure-rand`) to keep the test deterministic despite being "random."
- Test the hand evaluator in isolation against a small set of known-answer hands (royal flush beats straight flush, wheel straight (A-2-3-4-5) ranks correctly low, kicker comparisons) as exact-value unit tests — these are cheap and catch the most common evaluator bugs immediately, complementing the property-based invariant tests.
## Installation
# Core
# Poker logic
# Dev dependencies
## Alternatives Considered
| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|--------------------------|
| Framework | React 19 | Svelte 5 | If raw update performance/bundle size is the top priority over ecosystem depth — 2026 benchmarks show Svelte 5 with ~5-8% overhead vs. vanilla JS on high-frequency-update suites vs. React 19 compiler's ~12-18%. This app's update frequency (a few times/sec, not per-frame) doesn't need that edge, and React's ecosystem (animation libs, SVG card patterns, worker examples) is deeper for this specific domain. |
| Card rendering | DOM + SVG + Motion | Konva (react-konva 19.2.5) | If playtesting on low-end/mobile hardware shows CSS-transform-based flip/deal animations dropping frames, Konva's canvas scene graph with built-in tweening is the natural escape hatch — it keeps a similar declarative React API (`react-konva`) while moving rendering off the DOM. |
| Card rendering | DOM + SVG + Motion | PixiJS 8.20.0 | Only relevant if scope grows well beyond a single table (e.g., simultaneous multi-table view with dozens of animated tables/cards) — not justified for this project's single-table scope. |
| Hand evaluator | `@poker-apprentice/hand-evaluator` | `@pokertools/evaluator` | If you need the extra 5-10M evals/sec headroom after profiling, or the API shape fits your Monte Carlo loop more naturally. Both are pure TS and browser-safe. |
| State management | Zustand | Jotai | If the state model turns out to be more naturally atomic (many independent small pieces of derived state) than a single store — plausible given per-street, per-opponent, per-hand-category state, but Zustand's single-store simplicity is the better starting point for a project this size. |
| TypeScript | 6.0.3 | 7.0.2 (tsgo) | Once `typescript-eslint` ships TS 7.1 support (targeted autumn 2026) and 7.1 is GA, revisit — the ~10x faster type-checking is a genuine upgrade, just not compatible with the lint toolchain yet. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|--------------|
| PixiJS or Konva as the default rendering choice | Solves a scaling problem (hundreds/thousands of sprites, complex drag interactions) this project doesn't have; adds WebGL/canvas asset pipeline and hit-testing complexity, and makes the data-dense odds table harder to render well (canvas text is worse for accessibility/crispness than DOM text) | DOM + SVG cards + Motion (see Rendering Approach) |
| `pokersolver` | Unmaintained since 2020; string-based hand parsing is far slower than lookup-table evaluators — unsuitable for a Monte Carlo loop needing millions of evaluations | `@poker-apprentice/hand-evaluator` |
| `poker-evaluator` / `poker-evaluator-ts` | Dependency tree pinned to TypeScript ^3.7/`@types/node` ^13; historically ships its lookup table in a way that trips up bundlers expecting Node's `fs` module in a browser build | `@poker-apprentice/hand-evaluator` |
| TypeScript 7.0.2 as the primary compiler today | No compiler API yet, breaks `typescript-eslint` (peer range explicitly excludes it); ecosystem-wide blocker, not project-specific | TypeScript 6.0.3 |
| Next.js / Remix / any SSR meta-framework | No backend, no SEO/SSR need — this is a pure client-side simulator that should be shippable as static files; a server-oriented framework adds deployment and mental-model complexity with zero payoff | Vite in SPA mode |
| Redux / Redux Toolkit | Boilerplate-heavy for a single-page app with one cohesive state domain (current hand/street/simulation results) and no server-state synchronization needs | Zustand |
| Running Monte Carlo trials on the main thread | Blocks the UI thread during simulation bursts, defeating the "feels live" requirement and risking dropped frames on card animations that run concurrently | Web Worker + Comlink (see above) |
| `Math.random()` for simulation trials | Not seedable — makes convergence/regression tests non-deterministic and "replay this exact deal" impossible to build later | `pure-rand` |
## Stack Patterns by Variant
- Migrate just the card layer to `react-konva` (Konva 10.3.1), keeping the odds table and controls in DOM/React as-is — a hybrid canvas-cards + DOM-chrome split is a common, low-risk escape hatch since the two layers don't need to share a rendering context.
- Because everything is behind component boundaries from day one, this migration should only touch the card-rendering components, not the simulation/state layer.
- Re-check evaluator library support — `@poker-apprentice/hand-evaluator` and `@pokertools/evaluator` are Hold'em-oriented; Omaha's "must use exactly 2 hole cards" rule needs either a library with explicit Omaha support or a hand-rolled combination-selection layer on top of the same core 5-card evaluator.
- Consider a worker pool (multiple workers via `navigator.hardwareConcurrency`) splitting trials across cores, still coordinated via Comlink — straightforward extension of the single-worker pattern, not a stack change.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `typescript-eslint@8.67.0` | `typescript >=4.8.4 <6.1.0` | Confirms TypeScript must stay on the 6.x line, not 7.0.2, until typescript-eslint adds TS 7.1 support. |
| `eslint@10.9.0` | Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` | Verify your Node version before scaffolding tooling. |
| `@vitejs/plugin-react@6.1.0` | `vite@8.x` | Verify against installed Vite major when scaffolding — plugin majors track Vite majors closely. |
| `@poker-apprentice/hand-evaluator@4.3.0` | `@poker-apprentice/types@^1.4.0` (its only runtime dependency) | No Node-only APIs; safe inside a Web Worker/browser bundle. |
## Sources
- Context7 (`ctx7` CLI): `/vitejs/vite` — Web Worker `?worker` import syntax and bundling behavior (HIGH confidence, official docs)
- Context7 (`ctx7` CLI): PixiJS ecosystem package resolution (used for popularity/maintenance cross-check, MEDIUM confidence)
- npm registry (`npm view`, live, 2026-08-23) — authoritative current version numbers for all packages listed above (HIGH confidence)
- [TypeScript 7.0 RC Moves Microsoft's Go Rewrite Into the Mainline Compiler](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx) — MEDIUM confidence, corroborated by multiple sources and GitHub issue
- [typescript-eslint GitHub Issue #12518 — TypeScript 7.0.2 Support](https://github.com/typescript-eslint/typescript-eslint/issues/12518) — HIGH confidence, primary source for the TS7/lint incompatibility
- [Announcing TypeScript 7.0 — TypeScript Blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) — HIGH confidence, official
- GitHub: [poker-apprentice/hand-evaluator](https://github.com/poker-apprentice/hand-evaluator) — MEDIUM-HIGH confidence, official repo/README fetched directly
- GitHub: [aaurelions/pokertools](https://github.com/aaurelions/pokertools/tree/main/packages/evaluator) — MEDIUM confidence (newer, smaller project), official repo/README fetched directly
- GitHub: [htdebeer/SVG-cards](https://github.com/htdebeer/SVG-cards) — referenced as the SVG asset source underlying `react-deck-o-cards`; MEDIUM confidence
- [Konva "Best JavaScript Canvas Library" guide](https://konvajs.org/docs/guides/best-canvas-library.html) and [SVG vs Canvas vs WebGL 2026 comparison](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025) — MEDIUM confidence, cross-referenced across multiple 2025/2026 sources, consistent conclusions
- WebSearch: Zustand/Jotai/Redux 2026 comparisons (multiple sources, consistent "Zustand for small-to-medium client state" consensus) — MEDIUM confidence
- WebSearch: Comlink + Web Worker Monte Carlo patterns (LogRocket, multiple 2024-2025 implementation writeups) — MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
