# Project Research Summary

**Project:** Monte Carlo Poker Simulator
**Domain:** Browser-based, client-side Monte Carlo Texas Hold'em odds simulator with animated casino-table visuals (educational, no backend)
**Researched:** 2026-08-23
**Confidence:** HIGH

## Executive Summary

This is a client-side probability-visualization tool wearing the skin of a casino poker table: a React + Vite SPA that runs Monte Carlo Hold'em equity simulations in a Web Worker and renders the result as an animated, felt-table scene rather than a form-based calculator. The domain splits cleanly into two solved-but-separate lineages — utilitarian equity calculators (Equilab, PokerStove, PokerNews-style web tools), which supply the analytical table stakes (card picker, win/tie/lose, hand-category breakdown, street progression), and broadcast-TV odds overlays, which supply the visual language this project borrows. No surveyed competitor fuses the two into an interactive, rewindable, reveal-capable table — that fusion is this project's entire differentiation, and the research across all four files converges on the same conclusion: the hard, must-get-right part is the simulation engine (hand evaluator, deck conditioning, win/tie/lose logic), and the differentiating part is the presentation layer sitting cleanly on top of it.

The recommended approach is "engine first, pixels second." Build a pure, framework-agnostic simulation core (deck/RNG, a library-based 7-card evaluator, and a hand-rolled Monte Carlo trial runner) that can be unit-tested in Node against known reference odds before any UI exists, then wrap it in a Web Worker using a chunked, generation-tagged streaming protocol (via Comlink) so partial results can be posted several times a second — this is what makes "watch the percentages converge live" a real, working feature rather than a UI aspiration. State should be split into two stores: an authoritative, synchronous gameStore for what the user chose (cards, street, reveals) and a derived, asynchronous oddsStore for what the simulation computed, with an immutable, ordered history (not a single mutable blob) underlying street rewind. Rendering should be DOM + SVG + the motion library, not a canvas engine — the on-screen element count (~13 cards, a felt table, a data-dense odds table) is far below where canvas's performance advantage would matter, and DOM/SVG is dramatically better for the text-heavy odds table and click-to-reveal interactions.

The key risks are all correctness risks, not scaling risks: hand-evaluator bugs (wheel straights, kicker chains, tie precedence), hand-category buckets that double-count and fail to sum to 100%, win/tie/lose logic that mishandles multi-way ties among 4 players, deck-conditioning drift that lets revealed or already-dealt cards leak back into the sampling pool, and worker race conditions where a stale in-flight result overwrites a fresher one. Every one of these is well-documented, has a known fix pattern, and is testable with property-based tests (fast-check) plus reference-odds smoke tests (e.g., AA ~85% heads-up). The single biggest sequencing risk called out by PITFALLS.md is investing in animation polish before the evaluator/simulation core is validated — the roadmap should retire the engine's correctness risk first and treat the full casino-table visual as a layer applied afterward to a numerically-trustworthy foundation.

## Key Findings

### Recommended Stack

React 19 + Vite + TypeScript (pinned to the 6.x line, not the newer 7.0.2 tsgo line, since typescript-eslint doesn't support 7.0 yet) forms the application shell, with Zustand for the two-store state model described above. Rendering is DOM + SVG + the motion animation library — explicitly not PixiJS or Konva, both of which solve a scaling problem (hundreds/thousands of sprites) this project doesn't have. For the simulation itself, use a maintained lookup-table hand evaluator (@poker-apprentice/hand-evaluator, with @pokertools/evaluator as a fallback) rather than writing one from scratch — but hand-roll the Monte Carlo orchestration (trial loop, deck conditioning, rewind/reveal semantics) around it, since no off-the-shelf equity package matches this app's exact interaction model. Comlink wraps the Web Worker boundary, pure-rand provides a seedable PRNG for deterministic tests, and Vitest + fast-check (property-based testing) + Playwright (light E2E) cover correctness.

**Core technologies:**
- React 19.2.8 + Vite 8.2.2 + TypeScript 6.0.3 — UI framework/build tooling; ecosystem depth for this domain outweighs marginal perf gains from alternatives (Svelte)
- Zustand 5.0.15 — client state (two stores: gameStore authoritative, oddsStore derived) with no server-state layer needed
- DOM + SVG + motion 13.1.1 — card rendering and deal/flip/reveal animation; canvas engines (PixiJS, Konva) explicitly avoided as unneeded complexity at this element count
- @poker-apprentice/hand-evaluator 4.3.0 + hand-rolled Monte Carlo loop + Comlink 4.4.2 (Web Worker RPC) + pure-rand 8.4.2 (seedable RNG) — the simulation core

### Expected Features

The table-stakes list matches every surveyed calculator (Equilab, PokerStove, PokerNews/CardPlayer/Omni/CalcBE): card picker, win/tie/lose equity, an accurate 7-card evaluator, hand-category probability distribution, street-by-street input, real-time recompute, and random/quick deal. PROJECT.md's Active requirements already match or exceed this baseline while adding the differentiators no competitor offers: full casino-table visual presentation, live Monte Carlo convergence narration, opponent reveal with live recalculation, and forward/rewind street navigation. Feature dependency analysis confirms "deck/card-removal tracking" is the single most load-bearing piece of state (everything reads/writes it) and that the live-convergence requirement must be architected as streaming from day one — retrofitting it later means re-architecting the worker protocol, not adding a UI element.

**Must have (table stakes, = PROJECT.md Active requirements):**
- 7-card hand evaluator + streaming Monte Carlo engine — nothing else works without this
- Card picker, random deal/re-deal, win/tie/lose vs. 3 opponents, hand-category table by river, street progression with recompute

**Should have (differentiators, also already locked in PROJECT.md):**
- Rewind navigation across streets, opponent reveal with recalculation, live convergence display, full animated casino-table scene

**Defer (v1.x / v2+):**
- Outs/draw callouts and educational annotation layer — additive, don't gate correctness, add once core table/engine are proven
- Shareable scenario permalinks — low priority, low-medium cost
- Variable opponent count, other poker variants, weighted hand-range modeling — explicitly out of scope per PROJECT.md; anti-features whose complexity conflicts with the project's simplicity goal

### Architecture Approach

The system splits into a pure, framework-agnostic engine/ (deck/RNG, evaluator, trial runner — no DOM imports, testable in Node, importable unchanged into a Web Worker), a thin worker/ layer that chunks trials and streams generation-tagged progress messages, a state/ layer split into synchronous gameStore + async oddsStore + an immutable history snapshot stack, and a ui/ layer organized by table region (table, card, odds, controls) rather than generic atomic-design buckets. The most important structural rule is that the engine has zero UI dependencies, which is what makes "build and correctness-test the hardest part before any pixel exists" possible.

**Major components:**
1. **Engine** (engine/cards.ts, deck.ts, evaluator.ts, equity.ts) — deck/RNG, 7-card hand evaluation, trial runner; pure functions, no framework imports, unit-testable in Node
2. **Worker + SimulationService** (worker/simulation.worker.ts, state/simulationService.ts) — chunked (2,000-5,000 trials/batch), generation-tagged (requestId) streaming protocol over Comlink; re-conditions from scratch (discards prior tallies) on every state change rather than incrementally reweighting
3. **State layer** (gameStore, oddsStore, history) — gameStore is authoritative/synchronous (user choices); oddsStore is derived/async (worker output), written only by simulationService; history is an immutable, ordered snapshot stack with a cursor, so rewind is a pointer move, not a re-simulation
4. **UI layer** (table, card, odds, controls) — fully presentational, props-driven components (Card never reaches into gameStore directly), organized by table region

### Critical Pitfalls

1. **Hand evaluator correctness bugs** (kickers, wheel straight A-2-3-4-5, category precedence, ties) — build/adopt an evaluator that checks all C(7,5)=21 combinations with strict lexicographic tie-breaking; write the reference-verified test suite (known preflop equities, wheel, split-pot, kicker-chain cases) before any simulation/UI code depends on it. Even the recommended library (@poker-apprentice/hand-evaluator) has a documented history of exactly this bug class.
2. **Hand-category odds failing to sum to 100%** — bucket each trial by its single best category (not independent "does it contain X" boolean checks); add a dev-mode assertion that the column sums to ~100%.
3. **Win/tie/lose bucketing errors in 4-way comparisons** — use strict-max comparison across all 4 hands (hero wins iff strictly unique max; ties iff hero shares the max with at least one opponent); test all 2-way/3-way/4-way tie-shape permutations explicitly.
4. **Deck-conditioning drift / sampling bias** — maintain one authoritative "known cards" set and derive the sampling deck fresh on every change; use real Fisher-Yates (never array.sort with a random comparator, a documented non-uniform shuffle).
5. **Reveal mechanic re-conditioning bugs** — model each opponent explicitly as unknown (resampled each trial) or known (fixed); on reveal, flip the flag, permanently remove those cards from the shared unknown-pool, and restart simulation from trial zero. This is the project's specific educational payoff and the easiest place to silently reintroduce Pitfall #4.
6. **Worker race conditions (stale results overwrite fresh ones)** — tag every request/response with a monotonically increasing requestId; discard any message that doesn't match the current generation, on both the worker and coordinator sides.

## Implications for Roadmap

Based on combined research (FEATURES.md's dependency graph, ARCHITECTURE.md's component boundaries, and PITFALLS.md's phase-specific warning table all independently converge on the same ordering), suggested phase structure:

### Phase 1: Simulation Core (Deck, Evaluator, Trial Runner)
**Rationale:** FEATURES.md identifies deck/card-removal tracking and the hand evaluator as foundational with no dependencies — everything else in the app reads from this. PITFALLS.md's Critical #1, #2, and #4 all live here and are cheapest to catch before anything is built on top of them. ARCHITECTURE.md confirms this layer has zero UI dependencies, so it can be fully built and tested in Node before a single pixel exists.
**Delivers:** engine/ module (cards, deck/RNG with Fisher-Yates, hand evaluator wrapper around @poker-apprentice/hand-evaluator, trial runner producing win/tie/lose + hand-category tallies), with a reference-verified Vitest + fast-check test suite (wheel straights, kicker chains, split pots, known preflop equities like AA ~85% heads-up).
**Addresses:** 7-card hand evaluator, deck/card-removal tracking (table stakes, foundational).
**Avoids:** Critical Pitfalls #1 (evaluator bugs), #2 (category-sum bugs), #3 (win/tie/lose bucketing), #4 (deck-conditioning bias, biased shuffle).

### Phase 2: Streaming Monte Carlo Engine (Web Worker)
**Rationale:** Once the engine primitives are correct, the next highest-risk item is making them run off the main thread with live progress — PITFALLS.md and STACK.md both flag this as an early architectural decision, not a later optimization, since retrofitting a synchronous engine into a worker touches most of the simulation code.
**Delivers:** worker/simulation.worker.ts + protocol.ts (chunked trial batches, generation-tagged SimRequest/SimProgress/SimDone messages) wired via Comlink; a simulationService coordinator; a minimal headless test harness proving convergence toward known reference odds over time.
**Uses:** Comlink, pure-rand (seedable, deterministic tests), Vite's ?worker import syntax.
**Implements:** Worker Wrapper + SimulationService components from ARCHITECTURE.md; Pattern 2 (chunked/cancellable/generation-tagged stream) and Pattern 3 (re-condition, don't reuse, trials on any state change).

### Phase 3: Game State, Street Navigation & Reveal (Interaction Loop, Minimal UI)
**Rationale:** FEATURES.md's dependency graph shows rewind requires state history (not re-derivation) and opponent reveal requires deck-conditioning to already be airtight (Phase 1) — both are architecture-level decisions PITFALLS.md says must be made before implementation, not retrofitted. Validate this loop against a bare-bones card grid/table (not full art) so the numbers are proven correct before visual investment — PITFALLS.md's Minor #2 explicitly warns against sequencing animation ahead of correctness.
**Delivers:** gameStore (street, hero/board/opponent cards, deal mode) + immutable history snapshot-with-cursor model; street advance/rewind; random deal + manual card picker; opponent reveal wired to re-conditioning; a minimal, unstyled UI (plain card grid + odds table) sufficient to manually verify every number end-to-end.
**Addresses:** Card picker, random deal/re-deal, street-by-street progression, rewind navigation, opponent card reveal (all P1 in FEATURES.md's prioritization matrix).
**Avoids:** Moderate Pitfall #6 (rewind/history conflation), Critical Pitfall #5 (reveal re-conditioning bugs), Moderate #4 (worker lifecycle races surfacing through rapid street/reveal interaction).

### Phase 4: Casino Table Visual & Animation
**Rationale:** ARCHITECTURE.md and FEATURES.md agree the presentation layer "enhances but never gates correctness" — it's safe and recommended to build it last, once Phases 1-3 have proven the odds engine trustworthy. This is also the single largest scope item (the biggest market gap per FEATURES.md) and benefits from a stable, already-correct data layer to animate against.
**Delivers:** Felt table scene, seats, community card row, detailed SVG playing cards, deal/flip/reveal animations via motion, live convergence display (throttled/smoothed percentage updates plus visible trial count), choreographed sequencing between simulation-state updates and card animations.
**Addresses:** Full casino-table visual scene (the project's core presentational differentiator), live convergence display as a felt-table-integrated experience.
**Avoids:** Moderate Pitfall #5 (odds updating ahead of/out of sync with card animations) — treat "state updated" and "presentation finished" as distinct, sequenced steps.

### Phase Ordering Rationale

- **Engine-before-pixels is not just good practice here — all three of FEATURES.md, ARCHITECTURE.md, and PITFALLS.md independently arrive at it.** FEATURES.md's dependency graph puts the evaluator/engine at the root with nothing upstream; ARCHITECTURE.md's structural design makes the engine importable into Node/worker/main-thread identically; PITFALLS.md's Minor Pitfall #2 explicitly warns against animation-before-correctness sequencing.
- **The Web Worker boundary is decided in Phase 2, not deferred**, because PITFALLS.md's Moderate #2 notes retrofitting a synchronous engine into a worker later touches most of the simulation code — best done once, early, right after the engine primitives exist.
- **Rewind/reveal (Phase 3) comes before full visual polish (Phase 4)** because both require state-model decisions (immutable history, explicit known/unknown opponent flags) that are expensive to retrofit, and because validating the interaction loop against a minimal UI de-risks the biggest remaining unknowns before the most expensive phase (art + animation) begins.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Game State, Street Navigation & Reveal):** No competitor implements rewind-with-live-recompute or reveal-with-recalculation as a first-class interaction (per FEATURES.md's competitor analysis) — the state-machine/history-cursor design is bespoke to this project, not a copy-paste pattern. Recommend --research-phase to work out the exact history/cursor and known-unknown-opponent state shape before implementation.
- **Phase 4 (Casino Table Visual & Animation):** The rendering stack itself (DOM+SVG+Motion) is well-documented, but the specific choreography of sequencing simulation-state updates against card animations (Moderate Pitfall #5) has no direct reference implementation in the surveyed market. Recommend --research-phase focused narrowly on animation/state-sequencing patterns (e.g., animation queues, easing odds toward new values in sync with card flips) rather than general animation library usage.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Simulation Core):** Lookup-table hand evaluation, Fisher-Yates shuffling, and reference-odds testing are well-trodden, solved problems with mature libraries and clear correctness benchmarks (AA heads-up equity, wheel straight, etc.).
- **Phase 2 (Streaming Monte Carlo Engine):** Comlink + chunked/generation-tagged Web Worker streaming is a well-established general pattern (multiple independent 2024-2026 writeups), not poker-specific — implementation is mechanical once the protocol shape from ARCHITECTURE.md is adopted.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Framework/tooling versions verified live against npm registry; library-specific picks (hand evaluator, Konva alternative) MEDIUM given smaller ecosystem, but corroborated by direct repo/README inspection |
| Features | MEDIUM-HIGH | Draws on WebSearch summaries of product marketing/review pages rather than hands-on use (poker calculators aren't a documented library ecosystem); table-stakes list corroborated across many independent sources; the "no competitor combines both lineages" claim is a negative claim flagged MEDIUM confidence since an exhaustive market scan wasn't feasible |
| Architecture | HIGH | Cross-referenced against multiple hand-evaluator reference implementations (HenryRLee/PokerHandEvaluator, thlorenz/phe) and established Web Worker streaming practice; component/data-flow design is internally consistent with both STACK.md and PITFALLS.md |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls corroborated by a concrete documented bug in the recommended evaluator library itself (not speculative); official sources (MDN, TC39) back the technical claims (postMessage, Math.random unseedability); some supporting sources are single-vendor docs or blog posts (LOW-MEDIUM individually) but findings are cross-corroborated across the set |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact-enumeration vs. always-sampling tension (decision point, resolved below):** PITFALLS.md's Moderate Pitfall #1 recommends switching to exact enumeration once few cards remain unknown (e.g., river with one hidden opponent — a fully enumerable ~C(46,2) space) to eliminate sampling noise. ARCHITECTURE.md explicitly recommends never doing this, arguing that always sampling — and visibly re-converging after every state change — is the project's core educational value per PROJECT.md's Core Value ("probability made visible... watch odds converge in real time"). **Recommendation: follow ARCHITECTURE.md's position.** Always run Monte Carlo sampling, never silently swap in a different algorithm based on remaining-card count. Mitigate PITFALLS.md's underlying concern (noisy/jittery early percentages looking "buggy") with its own suggested fallback: throttle/smooth the displayed percentage update cadence and prominently surface the trial count so users understand why numbers move — and optionally note in the UI when the sample space is small enough that convergence will be near-instant, without changing the underlying algorithm. This should be logged as an explicit Key Decision in PROJECT.md during roadmap creation.
- **Hand evaluator library validation:** @poker-apprentice/hand-evaluator (the recommended library) has a documented history of a straight-flush detection bug in 6+ card hands (since fixed in the v4 rewrite per STACK.md). Phase 1 must include an explicit regression test for this exact scenario, not just general correctness tests, before trusting the library's current version.
- **TypeScript version pin discipline:** npm install typescript without an explicit version will pull the 7.0.2 latest dist-tag, which breaks typescript-eslint. Scaffolding must pin typescript@6.0.3 explicitly; flag this in Phase 1 setup so it isn't accidentally overridden by a later dependency bump.
- **Low-end/mobile animation performance is untested:** STACK.md's DOM+SVG+Motion recommendation is based on element-count reasoning, not a hands-on benchmark on target devices. If Phase 4 playtesting reveals jank, the documented escape hatch is migrating just the card-rendering layer to react-konva (Konva) while keeping the odds table/controls in DOM — flag this as a contingency to validate early in Phase 4 rather than discover late.
- **v1.x/v2+ feature boundary discipline:** Outs/draw callouts, educational annotations, and shareable permalinks are explicitly deferred per FEATURES.md's MVP definition and are not part of the 4 phases above — ensure the roadmap does not fold these into Phase 3/4 scope without an explicit re-scoping decision.

## Sources

### Primary (HIGH confidence)
- npm registry (npm view, live, 2026-08-23) — authoritative current version numbers for the full stack
- Context7 (ctx7 CLI): /vitejs/vite — Web Worker ?worker import syntax and bundling behavior
- typescript-eslint GitHub Issue #12518 — TypeScript 7.0.2 support gap, primary source
- Announcing TypeScript 7.0 — TypeScript Blog — official
- HenryRLee/PokerHandEvaluator and thlorenz/phe — hand evaluation algorithm references, verified directly
- MDN: DedicatedWorkerGlobalScope.postMessage() — official Web Worker messaging reference
- tc39/proposal-seeded-random — confirms Math.random() is intentionally unseedable

### Secondary (MEDIUM confidence)
- poker-apprentice/hand-evaluator (GitHub) — documented straight-flush detection bug, concrete evidence for Critical Pitfall #1
- Understanding Monte Carlo Sampling — HoldemResources.net and pokeroddscalc.org — deck conditioning and enumeration-vs-sampling practice (informed the reconciled decision point above)
- Nolan Lawson — High-performance Web Worker messages and Smashing Magazine — Web Workers for Multithreading — postMessage batching guidance, cross-corroborated
- PokerListings, PokerStrategy.com, PokerVIP, Cardmates, PokerNews, CardPlayer, PokerScout, Wizard of Odds, CalcBE, Omni Calculator, PokerCruncher, Flopzilla product/review pages — competitor feature landscape, corroborated across many independent sources
- WebSearch synthesis on Zustand/Jotai/Redux and Canvas/SVG/DOM comparisons — consistent conclusions across multiple 2025/2026 sources

### Tertiary (LOW confidence)
- "Estimating the outcome of a Texas hold'em game using Monte Carlo simulation" — Medium blog post — general approach reference, not official docs
- Wayline — Feature Creep blog post — general scope-creep pattern, used for Minor Pitfall #1 framing only

---
*Research completed: 2026-08-23*
*Ready for roadmap: yes*
