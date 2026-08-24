# Phase 2: Scenario Construction & Street Navigation - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (unattended chain authorized by user). Every decision below is the recommended default, logged for audit; the user did not hand-pick these answers.

<domain>
## Phase Boundary

Phase 2 delivers the complete interaction loop on the minimal (unstyled) UI proven in Phase 1: manual "what-if" scenario construction via a card picker with duplicate blocking (DEAL-02, DEAL-03), street-by-street advance and rewind (NAV-01, NAV-02), and opponent hole-card reveal (NAV-03) — with win/tie/loss and hand-category odds correctly recalculating to reflect the user's information state at every step. No visual polish (felt table, card art, animation) — that is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Dealing & runout model
- **D-01:** The full hand is predetermined at deal time: hero hole (unless manually picked), 3×2 opponent hole cards, and all 5 board cards are drawn up front in one conditioned draw. Street navigation only moves a "visible street" pointer (pre-flop → flop → turn → river); no cards are drawn during navigation. This directly satisfies NAV-02 — rewinding and re-advancing always shows the same cards — with zero extra machinery. A separate re-deal reshuffles everything.
- **D-02:** Odds computation must condition ONLY on cards the user can currently see (visible street's board cards + hero hole + any revealed opponents), never on predetermined-but-hidden cards. The simulation's "known cards" set is derived from the visibility/knowledge state, not from the stored runout. This keeps the probabilities honest to the user's information state — the educational core.
- **D-03:** One deal flow, not two modes: the Deal action deals a full random hand as today, but respects any picker-set slots (picked cards are kept, unset slots are drawn randomly from the remaining deck). There is no separate "construct mode."

### Card picker interaction
- **D-04:** Slot-based picker: clickable slots for hero hole (2), flop (3), turn (1), river (1). Clicking a slot opens a 52-card selection panel grouped by suit. Minimal unstyled rendering (text/buttons) — card art is Phase 3.
- **D-05:** Already-used cards are visibly DISABLED (grayed with reason), not hidden — making the DEAL-03 duplicate-block observable is part of the learning goal. Selecting a used card is impossible through the UI, and the store rejects duplicates as a second line of defense.
- **D-06:** Partial scenarios are allowed: any unpicked slot is dealt randomly at deal time. Per-slot Clear and a Clear-all reset are provided.
- **D-07:** Opponent hole cards are NOT pickable in this phase — opponents are always dealt randomly from the remaining deck (requirements limit the picker to own hole + board). Picking opponent cards is a deferred idea.

### Reveal semantics
- **D-08:** Clicking an opponent seat reveals that opponent's (predetermined) hole cards. Reveal is one-way for the current hand — no un-reveal; knowledge is monotonic within a hand. Cleared only by re-deal / new scenario.
- **D-09:** Reveals persist across street navigation — rewinding to an earlier street does not "unlearn" a revealed opponent. Earlier-street odds after a reveal are recomputed conditioned on the revealed cards (they legitimately differ from pre-reveal values; watching that shift is the point of the feature).

### Odds behavior on navigation
- **D-10:** Per-street odds results are cached keyed by (street, knowledge set). Rewinding to a street whose knowledge set is unchanged shows the cached settled numbers immediately — the literal "odds return to their earlier-street values" of NAV-02. No re-simulation noise on rewind.
- **D-11:** Any knowledge change (reveal) invalidates ALL cached streets — every street's odds recompute conditioned on the new knowledge when visited.
- **D-12:** Navigating to a street with no cached result always runs a fresh live-converging simulation with the climbing trial counter — visible convergence remains the core value and must not be hidden behind caching.
- **D-13:** Street navigation, reveal, and re-deal all supersede any in-flight simulation run (extend the Phase 1 generation-tagged cancellation; the single `dealNonce` counter grows into a request key that also reflects street/knowledge state — planner decides the exact shape).

### Phase 1 review debt folded in
- **D-14:** Because this phase necessarily reworks `simulationService`/`App.tsx` effect wiring for navigation triggers, the two advisory warnings from `01-REVIEW.md` MUST be fixed as part of that rework, not left behind: WR-01 (same-requestId re-entry can interleave two worker loops; add effect cleanup + per-invocation run token) and WR-02 (no error handling on the worker path; a worker failure must surface visibly, not freeze the display).

### Claude's Discretion
- Exact Zustand store shape (extend gameStore vs new scenarioStore), component decomposition, picker panel layout, and worker protocol changes — planner/executor decide.
- Street indicator/control styling (unstyled buttons + label; anything readable is fine).
- Whether the per-street cache lives in oddsStore or a new structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 2 goal + 4 success criteria (the acceptance bar)
- `.planning/REQUIREMENTS.md` — DEAL-02, DEAL-03, NAV-01, NAV-02, NAV-03 definitions

### Phase 1 contracts this phase builds on
- `.planning/phases/01-core-odds-loop/01-01-SUMMARY.md` — cards/rng/gameStore contracts (FULL_DECK, deckWithout, drawN/createDrawer, dealNonce)
- `.planning/phases/01-core-odds-loop/01-02-SUMMARY.md` — worker protocol, simulationApi cancellation/supersession, oddsStore, simulationService singleton
- `.planning/phases/01-core-odds-loop/01-03-SUMMARY.md` — evaluator wrapper (named imports only), equity trial loop, category table
- `.planning/phases/01-core-odds-loop/01-RESEARCH.md` — pitfalls: re-run/cancel on state change, throttled streaming, no algorithm switching (always Monte Carlo)
- `.planning/phases/01-core-odds-loop/01-REVIEW.md` — WR-01 and WR-02 (folded into this phase per D-14), plus Info items worth opportunistic cleanup where touched

No external specs beyond the above — requirements fully captured in decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/cards.ts` (`FULL_DECK`, `deckWithout`, `OPPONENT_COUNT`): `deckWithout` is exactly the picker's duplicate-blocking primitive.
- `src/engine/rng.ts` (`createRng`, `drawN`, `createDrawer`): conditioned up-front runout draw uses `drawN` over `deckWithout(pickedCards)`.
- `src/engine/equity.ts` `runTrials`: already accepts conditioning inputs; note `ConditionedState.remainingDeck` param is currently unused (review Info) — this phase's conditioning work should rationalize it.
- `src/worker/simulationApi.ts`: generation-tagged cancellation loop — extend, don't replace.
- `src/state/oddsStore.ts`: snapshot application with dev-mode consistency guard — per-street cache can layer on top.
- `src/ui/HandDisplay.tsx`, `OddsTable.tsx`, `WinTieLossDisplay.tsx`: extend for seats/reveal/street display; keep testids stable where possible (`hero-hole`, `opponents`, `trial-counter`, `win-pct`, etc. are contractual in tests).

### Established Patterns
- TDD RED→GREEN commits per plan (`test(NN-MM):` then `feat(NN-MM):`).
- `@poker-apprentice/hand-evaluator` named imports ONLY (default import breaks the production worker chunk).
- `pure-rand` subpath imports only.
- `dealNonce` is the single re-deal trigger and worker requestId — evolve it, don't add parallel counters (D-13).
- Worker singleton at module scope in `simulationService.ts`; tests mock it with an explicit `vi.mock` factory (automock instantiates a real Worker under jsdom and fails).

### Integration Points
- `src/App.tsx` effect currently triggers simulation on `dealNonce`; it becomes the reactive point for street/reveal changes too, and must gain cleanup (WR-01 fix).
- `src/state/gameStore.ts` grows from `{heroHole, dealNonce}` to hold the predetermined runout, visible street, picked slots, and revealed flags (exact shape = planner's call).

</code_context>

<specifics>
## Specific Ideas

- The duplicate-block should be *visible* (grayed cards in the picker), not silent — seeing "this card is already on the board" is part of probability-made-visible.
- After a reveal, rewinding should show earlier streets' odds *changing* relative to what they were pre-reveal — surfacing how information reshapes the numbers is the phase's educational payoff.

</specifics>

<deferred>
## Deferred Ideas

- Picking opponent hole cards in the card picker (beyond DEAL-02 scope; would make reveal trivial/moot for constructed opponents) — future phase or v2.
- Un-reveal toggle / "forget" a revealed opponent — conflicts with monotonic-knowledge model; revisit only if playtesting demands it.
- Street-advance dealing animation and card art — Phase 3 (Casino Table UI & Animation).
- `index.html` title still "scaffold-tmp" — cosmetic, queued for Phase 3 branding pass.

</deferred>

---

*Phase: 2-Scenario Construction & Street Navigation*
*Context gathered: 2026-08-24*
