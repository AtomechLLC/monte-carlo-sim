# Walking Skeleton — Monte Carlo Poker Simulator

**Phase:** 1
**Generated:** 2026-08-23

## Capability Proven End-to-End

A user clicks **Deal** in the browser and watches a Web-Worker-computed Monte Carlo simulation stream live win/tie/lose percentages, a hand-category probability table, and a climbing trial counter back to an unstyled page that never freezes.

This is the thinnest slice that exercises the entire stack this project depends on: build tooling, React state, the pure simulation engine, the worker boundary, the streaming protocol, and the render path. Everything Phases 2 and 3 add hangs off this spine.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React 19.2.8 + Vite 8.2.2, SPA mode, no SSR | Client-only app with no backend; Vite gives first-class Web Worker support via the `?worker` import suffix with zero loader config. A server meta-framework would add deployment complexity with no payoff. |
| Language | TypeScript 6.0.3, pinned exactly (`--save-exact`) | The `latest` dist-tag is 7.0.2, which ships without a compiler API and breaks `typescript-eslint` (peer range `>=4.8.4 <6.1.0`). The pin is load-bearing, not cosmetic. |
| Linter | ESLint 10 flat config (`--eslint` scaffold flag) | `create-vite`'s React template now defaults to Oxlint; the `--eslint` flag is mandatory to get the locked ESLint + `typescript-eslint` stack. |
| Data layer | **None** — no database, no backend, no persistence | Explicit `PROJECT.md` constraint. All state is in-memory and discarded on refresh. The "one real read/write" a normal skeleton proves is replaced here by the equivalent full-stack proof: one real off-main-thread compute round trip. |
| Compute boundary | Web Worker via Comlink 4.4.2, worker instantiated once at module scope | The only tier boundary in the app. Module-scope instantiation (not inside a `useEffect`) avoids React 19 StrictMode double-invocation leaking a second worker thread. |
| Worker protocol | Chunked batches, worker-side throttled progress callbacks, generation-tagged `requestId` cancellation | Streaming partial results is what makes "watch it converge" real; it cannot be retrofitted later without re-architecting the protocol. Generation tagging on both sides prevents a stale run overwriting fresher odds. |
| Worker logic placement | All logic in `worker/simulationApi.ts` (pure, Comlink-free); `worker/simulation.worker.ts` is a `Comlink.expose` one-liner | Makes the entire streaming/cancellation loop testable in Node with no Worker and no jsdom shim. |
| Randomness | `pure-rand` 8.4.2 (xoroshiro128+), partial Fisher-Yates, never `Math.random` or `sort()`-shuffles | Seedability makes probability tests deterministic; `sort`-based shuffles are a documented non-uniform bias. Import via subpaths only — the package has no top-level `"."` export. |
| Hand evaluation | `@poker-apprentice/hand-evaluator` 4.3.0's `evaluateHoldem` / `compare` primitives, wrapped in `engine/evaluator.ts` | Never hand-roll a 7-card evaluator. The library's own `simulate`/`simulateHoldem` helper is deliberately NOT used: its RNG is a hardcoded `Math.random` with no injection point, and its result shape has no hand-category breakdown. |
| Comparator convention | Normalised once in `engine/evaluator.ts`'s `compareHands` (+1 = `a` stronger) | The raw library comparator is inverted (`-1` means `a` is stronger). A sign flip silently inverts every probability while still passing every sum-to-100% check, so it is isolated to one module and pinned by a test. |
| Hand categories | **10**, not 9 — `HandStrength` treats Royal Flush (9) as distinct from Straight Flush (8) | Verified against the installed type declarations. A 9-bucket histogram still sums to 100%, so this error is otherwise invisible. |
| State management | Zustand 5.0.15, two stores: `gameStore` (authoritative, synchronous) and `oddsStore` (derived, async, written only by the simulation service) | Keeps user choices and computed output on separate clocks. `dealNonce` is a single counter serving as both re-deal trigger and worker `requestId`. |
| Rendering | Plain DOM, unstyled, `data-testid` hooks | Phase 1 is deliberately ugly. SVG cards, felt table, and Motion animation are Phase 3 and must not gate correctness. |
| Testing | Vitest 4 (jsdom default, `// @vitest-environment node` pragma for engine/worker files), `fast-check` 4 for invariants, Testing Library for UI | Engine and worker logic run in Node for speed and to avoid jsdom's missing Worker support; component tests mock the simulation service rather than instantiating a real worker. |
| Directory layout | `src/engine` (pure, zero UI/DOM imports) → `src/worker` → `src/state` → `src/ui` | The engine having no framework dependency is what allows it to run identically in Node tests and inside the worker. Do not import React or DOM APIs into `src/engine`. |
| Deployment | Local dev server (`npm run dev`) plus a green `npm run build` | Client-only static app; no hosting target is required for v1 and none is chosen here. |

## Stack Touched in Phase 1

- [ ] Project scaffold — Vite + React + TypeScript, ESLint flat config, Vitest with jsdom and a jest-dom setup file
- [ ] Routing — n/a by design (single-view SPA; no router is introduced until a phase actually needs one)
- [ ] Data layer — n/a by design (no backend, no persistence per `PROJECT.md`); the equivalent full-stack proof is one real main-thread → Web Worker → main-thread compute round trip with streamed partial results
- [ ] UI — Deal button wired through `gameStore` to the worker, with live-updating win/tie/lose, trial counter, and 10-row category table
- [ ] Deployment — documented local full-stack run: `npm run dev` exercises scaffold, engine, worker, streaming, and render together; `npm run build` and `npm run lint` gate every plan

## Out of Scope (Deferred to Later Slices)

Explicitly NOT in the skeleton. Later phases must not treat any of these as a Phase 1 regression:

- **Community cards / board dealing.** Phase 1 is preflop-only: hero holds 2 cards, all 5 board cards and all 6 opponent cards are unknown and sampled every trial. Street structure is Phase 2 (NAV-01).
- **Street cursor, history stack, rewind.** Phase 2 (NAV-01, NAV-02). Its state shape is Phase 2's decision — guessing at it now would bake in the wrong model.
- **Opponent reveal / known-versus-unknown opponent flags.** Phase 2 (NAV-03).
- **Manual card picker and duplicate-card blocking.** Phase 2 (DEAL-02, DEAL-03).
- **Any visual design.** No felt table, no seats, no card art, no animation, no CSS beyond the scaffold defaults. Phase 3 (TBL-01 through TBL-04).
- **`motion` and `immer`.** Not installed in Phase 1. `motion` arrives with Phase 3 animation; `immer` only if Phase 2's history state actually gets nested enough to justify it.
- **Playwright E2E.** Deferred; no Phase 1 requirement demands cross-boundary E2E coverage, and the worker boundary is covered by Node tests plus the phase acceptance checkpoint.
- **Exact enumeration when few cards remain unknown.** Logged project decision: always sample, never algorithm-switch. Visible convergence is the product, so jitter is mitigated with throttled updates and a visible trial counter, not by swapping algorithms.
- **User-tunable trial counts or precision settings.** Out of scope per `REQUIREMENTS.md`; the run auto-stops at `DEFAULT_MAX_TRIALS`.
- **Variable opponent count.** Fixed at 3 (`OPPONENT_COUNT`), per `REQUIREMENTS.md` out-of-scope table.
- **Worker pools / multi-core sharding.** A straightforward later extension of the same Comlink pattern if profiling ever demands it; not a Phase 1 concern.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Scenario Construction & Street Navigation:** manual card picker with duplicate blocking, street advance/rewind over an immutable history stack, and opponent reveal. Extends `ConditionedState` from the fixed Phase 1 shape (`heroHole` known, `board: []`, three hidden opponents) to a variable shape; `runTrials` and the worker protocol absorb this by sampling fewer unknown cards, not by changing the streaming contract.
- **Phase 3 — Casino Table UI & Animation:** felt-table scene, seats, SVG card faces, and Motion-driven deal/flip/reveal animations replacing the `data-testid`-hooked plain DOM. The engine, worker, protocol, and stores are untouched; only `src/ui` is rewritten, and a sequencing rule is added so odds never update ahead of an in-flight card animation.
