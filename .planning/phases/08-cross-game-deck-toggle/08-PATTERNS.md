# Phase 8: Cross-Game Deck-Count Toggle UI - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 6 new/modified (2 created, 3 modified, 1 amended guard)
**Analogs found:** 6 / 6 (no gaps)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/DeckCountToggle.tsx` (new; name at planner's discretion) | component (presentational, stateless, props-only) | request-response (click → callback) | `src/ui/GameModeSwitcher.tsx` | exact (structural twin — both inline toggles cite it as such in their own comments) |
| `src/ui/DeckCountToggle.test.tsx` (new, optional component-level suite) | test | — | `src/ui/GameModeSwitcher.test.tsx` | exact |
| `src/ui/BlackjackControls.tsx` (modified — replace inline toggle with `<DeckCountToggle/>`) | component (control cluster) | request-response | itself (verbatim-move discipline) | exact |
| `src/ui/HoldemGame.tsx` (modified — replace inline toggle with `<DeckCountToggle/>`) | component (game root) | request-response | itself + 06-02 extraction precedent | exact |
| `src/App.modeShell.guard.test.ts` (amended, same commit as component creation) | test (raw-source guard) | file I/O (readFileSync sweeps) | its own 06-02/06-07/07-05 amendment blocks | exact |
| `src/App.deckToggleConsolidation.test.tsx` (new consolidation suite; name at planner's discretion) | test (App-level behavioral) | — | `src/App.holdemDeckToggle.test.tsx` (harness + conventions) | exact |

## Pattern Assignments

### 1. The two inline toggles being consolidated — exact line map

#### Blackjack toggle: `src/ui/BlackjackControls.tsx`

| Piece | Lines |
|-------|-------|
| Locked A3 guard title constant `DUPLICATE_GUARD_TITLE` | 4-5 |
| `hasPhysicalDuplicate` import (guard predicate input) | 2 |
| Store reads: `deckCount` L20, `setDeckCount` L24 (plus `round` L17, `playerHand` L18, `dealerPlayoutCards` L19 feeding the guard) | 17-24 |
| Guard predicate `duplicateOnTable` | 47-48 |
| Structural-twin comment block ("Structural twin of GameModeSwitcher (A4)…") | 67-70 |
| **Toggle JSX block (wrapper div `blackjack-deck-toggle` → `</div>`)** | **71-93** |
| — segment 1 button (`blackjack-deck-toggle-1`, disabled + title guard) | 72-84 |
| — segment 2 button (`blackjack-deck-toggle-2`, no disabled, no title, ever) | 85-92 |

#### Hold'em toggle: `src/ui/HoldemGame.tsx`

| Piece | Lines |
|-------|-------|
| Locked A3 title constant `FRESH_DEAL_TITLE` | 21-22 |
| Locked A4 title constant `DUPLICATE_PICK_GUARD_TITLE` | 24-26 |
| Store reads: `runout` L35 (title predicate input), `deckCount` L41, `setDeckCount` L42, `picks` L46 | 35-46 |
| Guard predicate `duplicateInPicks = hasDuplicatePick(picks)` | 47 |
| Long rationale comment block ("Structural twin of the mode switcher (D-01, UI-SPEC A2 — last control-bar child)…") | 224-233 |
| **Toggle JSX block (wrapper div `holdem-deck-toggle` → `</div>`)** | **234-269** |
| — segment 1 button (`holdem-deck-toggle-1`, disabled + 3-way title ternary) | 235-257 |
| — segment 2 button (`holdem-deck-toggle-2`, no disabled ever, conditional fresh-deal title) | 258-268 |

#### Precise JSX diff (what the extraction must parameterize)

Identical in both (belongs INSIDE the shared component, hardcoded):

- Wrapper: `<div data-testid={prefix} role="group" aria-label="Deck count">` — role + aria-label identical strings (BlackjackControls L71 / HoldemGame L234).
- **No `className` anywhere** — neither wrapper nor buttons carry a class; all styling is testid-attribute-keyed (see Shared Patterns / CSS below).
- Both buttons: `type="button"`, `aria-pressed={deckCount === N}`, `onClick={() => setDeckCount(N)}` (BJ L73-75/81, L86-89 / HE L236-238/254, L259-261/265).
- Labels: `1 deck` (BJ L83 / HE L256) and `2 decks` (BJ L91 / HE L267) — locked copy, never state-dependent.
- Guard shape: `disabled` appears on segment 1 ONLY; segment 2 has NO `disabled` attribute in either game (active-never-disabled + structurally one-directional 2→1 guard).
- JSX attribute order is the same in both originals (`type`, `data-testid`, `aria-pressed`, [`disabled`], [`title`], `onClick`) — keep that order in the shared JSX so rendered DOM serialization is byte-identical per D-06.

Differences (must arrive via props; guard predicates stay at the call sites per D-01/CONTEXT discretion):

| Aspect | Blackjack | Hold'em | Prop |
|--------|-----------|---------|------|
| testid prefix | `blackjack-deck-toggle` | `holdem-deck-toggle` | `testidPrefix` (component renders `{prefix}`, `` `${prefix}-1` ``, `` `${prefix}-2` ``) |
| `deckCount` source | `useBlackjackStore` (L20) | `useGameStore` (L41) | `deckCount: DeckCount` — both stores already share `type DeckCount = 1 \| 2` from `src/engine/shoe.ts` L8 (imported `import type` in blackjackStore L5 and gameStore L4; a type-only import in the shared component adds no coupling) |
| click handler | `setDeckCount` from blackjackStore (L24, wired L81/L89) | `setDeckCount` from gameStore (L42, wired L254/L265) | `onSelect: (count: DeckCount) => void` |
| Segment-1 `disabled` | `duplicateOnTable` (L79; predicate L47-48 over round physical cards via `hasPhysicalDuplicate`) | `duplicateInPicks` (L246; predicate L47 via `hasDuplicatePick`) | boolean prop (e.g. `oneDeckDisabled`) |
| Segment-1 `title` | 2-state: `duplicateOnTable ? DUPLICATE_GUARD_TITLE : undefined` (L80) | 3-state with precedence: `duplicateInPicks ? DUPLICATE_PICK_GUARD_TITLE : deckCount === 2 && runout !== null ? FRESH_DEAL_TITLE : undefined` (L247-253) | pass a **computed** `title?: string` per segment; keep both ternaries (and the A4-beats-A3 precedence, HE comment L244-245) at the call sites — the component stays dumb |
| Segment-2 `title` | never (no `title` attribute in source, L85-92) | `deckCount === 1 && runout !== null ? FRESH_DEAL_TITLE : undefined` (L264) | optional `title?: string`; blackjack passes `undefined` — React omits the attribute, so blackjack's rendered DOM stays byte-identical |

The three title constants (BJ L4-5; HE L21-26) STAY in their current files — titles are computed at the call sites, and no source-level guard pins those strings (they are pinned only against rendered DOM, which is location-independent).

### 2. `src/ui/DeckCountToggle.tsx` (new component)

**Analog:** `src/ui/GameModeSwitcher.tsx` (35 lines, entire file) — the component both inline toggles describe as their "structural twin."

**Shape to copy** (GameModeSwitcher.tsx L11-35): a single exported named `function` component, doc comment stating the locked-label / aria-pressed-carries-state / never-disabled rules with decision citations, wrapper `div` with `data-testid` + `role="group"` + `aria-label`, two `<button type="button">` children. Differences from the analog: DeckCountToggle reads NO store (GameModeSwitcher reads gameModeStore L12-13 — the new component is stricter: fully props-driven, zero imports beyond the optional `import type { DeckCount } from '../engine/shoe'`), and testids come from the `testidPrefix` prop rather than literals.

**Imports pattern:** zero runtime imports. Type-only: `import type { DeckCount } from '../engine/shoe';` (same style as gameStore.ts L4 / blackjackStore.ts L5).

**Doc-comment pattern to copy** (GameModeSwitcher.tsx L3-10): name the locked semantics (labels never change with state; `aria-pressed` alone carries the active count; active segment never disabled — clicking it is a no-op routed through the store's same-value early return) and cite Phase 8 D-01/D-02/D-06. CAUTION on comment wording — see Traps #3.

### 3. `src/ui/BlackjackControls.tsx` (rewire)

Replace lines 67-93 (comment block + toggle JSX) with `<DeckCountToggle testidPrefix="blackjack-deck-toggle" deckCount={deckCount} onSelect={setDeckCount} oneDeckDisabled={duplicateOnTable} oneDeckTitle={duplicateOnTable ? DUPLICATE_GUARD_TITLE : undefined} />` (prop names planner's call). Everything above L67 — including the WR-01 guard-predicate comment essay (L34-46) and `duplicateOnTable` (L47-48) — stays byte-untouched. Keep the toggle as the LAST child of the returned fragment (current order: Deal, Hit, Stand, toggle) so BlackjackGame.tsx's control bar (L218-221: `GameModeSwitcher` then `BlackjackControls`) renders identically.

### 4. `src/ui/HoldemGame.tsx` (rewire)

Replace lines 234-269 with the shared component call; the rationale comment L224-233 can stay (retarget its wording minimally or leave verbatim — it describes call-site semantics, not markup). CRITICAL placement pin: the component must remain the **last child of `.control-bar`** (currently L211-270: GameModeSwitcher, DealButton, Set Up Scenario, StreetControls, toggle) — `App.holdemDeckToggle.test.tsx` L255-257 asserts `controlBar.lastElementChild === getByTestId('holdem-deck-toggle')`, which resolves to the shared component's root div. Nothing else in HoldemGame moves: the odds effect (L65-160), its guard pins, and the title constants stay.

### 5. `src/App.modeShell.guard.test.ts` (amend — same commit as the extraction, retarget/add, never delete)

The full impact audit of every raw-source pin (this file is the ONLY test that reads UI-file source — verified: `readFileSync`/`readSource` exists only here, in `src/engine/shoePath.guard.test.ts` (engine files only), and the `node-builtins.d.ts` shim):

| Pin (lines) | Reads | Extraction impact |
|-------------|-------|-------------------|
| gameModeStore token sweep (L95-117: no `deckCount`/`gameStore`/`oddsStore`/`pickerStore`/`uiStore`) | `state/gameModeStore.ts` | **none** |
| Hold'em-store no-`blackjack`/`gamemode` sweep (L119-143) | 4 stores + conditioning.ts | **none** |
| `cancelSimulation(` count = 1 in HoldemGame / = 0 in App (L154-181) | comment-stripped source | **none** — the odds effect does not move |
| `resetAnimations` zero-occurrence sweep (L183-209, 9-file `it.each`) | raw source | **ADD `'ui/DeckCountToggle.tsx'` to the list in the creating commit** — exact precedent: 06-02 added `ui/HoldemGame.tsx` on creation, 06-07 added the blackjack files (comment at L189-192 states the prohibition covers "every production file that could be tempted to 'drain' the gate") |
| mode-gate literal + `pendingAnimationCount, mode]` dependency-tail pins (L211-231) | `ui/HoldemGame.tsx` | **none** — both literals stay in HoldemGame |
| **deckCount-zero sweep (L234-254)** | `App.tsx`, `state/gameModeStore.ts`, `ui/GameModeSwitcher.tsx` ONLY | **no assertion change** — HoldemGame/BlackjackControls are not in this sweep, and the new component must NOT be added (it necessarily contains `deckCount` as a prop). The prose at L24-25 and L249-251 says "the only sanctioned Hold'em wire is ui/HoldemGame.tsx's deck toggle" — after extraction the *markup* lives in DeckCountToggle.tsx but the *wire* (store read + `setDeckCount`) stays in HoldemGame, so the comment stays true; an optional comment-only amendment citing Phase 8 D-01 follows the standing rule (L30-34, which explicitly anticipates Phase 8) |
| Blackjack-UI no-Hold'em-store sweep (L256-288: `gameStore`/`oddsStore`/`pickerStore` in BlackjackGame/BlackjackTable/BlackjackControls; `uiStore` in BlackjackControls) | **raw source, comments included** | **stays green as-is** — the new import line `import { DeckCountToggle } from './DeckCountToggle'` contains no forbidden token. See Traps #3 for the comment-wording hazard. Recommended ADDITIVE pin: sweep `ui/DeckCountToggle.tsx` for zero store-module tokens (`gameStore`, `oddsStore`, `pickerStore`, `uiStore`, `blackjackStore`, `gameModeStore`, `zustand`) — the shared component is store-free by construction (D-01) and this makes it enforceable |
| BlackjackGame effect pins (L291-361) | `ui/BlackjackGame.tsx` | **none** — BlackjackGame is untouched (its control bar renders `<BlackjackControls/>` unchanged, L218-221) |
| Store-vocabulary disjointness (L363-386) | both blackjack stores | **none** |
| Locked-copy block (L388-471) | BlackjackGame/OutcomeBanner/BustEv/DealerDistribution/GameModeSwitcher | **none** — no toggle string is pinned here today. Optional additive pins mirroring the GameModeSwitcher block (L457-470): `'1 deck'`, `'2 decks'`, `'Deck count'` verbatim in `ui/DeckCountToggle.tsx`. Note the GameModeSwitcher **testid** source-pin technique does NOT transfer — after extraction the literal testid prefixes live at the two CALL SITES, so prefix pins would target BlackjackControls.tsx / HoldemGame.tsx, not the component |
| **App.css style-contract block from 07-05 (L485-584)** | `App.css` ONLY (chunk-split on `}`, `theChunkWith(...)` uniqueness) | **ZERO changes** — it reads no component file, has no component sweep list, and the CSS itself needs zero edits (next row) |

**Answer to "does a new component file need adding to any CSS sweep list":** No. The CSS guard's `theChunkWith` helper matches rules inside App.css only. And no App.css edit is needed at all — see Shared Patterns.

### 6. New consolidation suite (SC2/SC3 through the shared component)

**Analog:** `src/App.holdemDeckToggle.test.tsx` — copy the harness wholesale:

- File-header rationale citing why it is a NEW sibling file (L30-33: the five frozen v1 suites + App.holdemCachePoison.test.tsx must not be edited — same precedent as App.modeIsolation.test.tsx), and the jsdom reduced-motion note (L35-36: toggle-triggered re-deals complete synchronously inside the click; assert END STATES only, never frames).
- Explicit-factory worker mocks for BOTH services (L41-51): `vi.mock('./state/simulationService', () => ({ startSimulation: vi.fn(), cancelSimulation: vi.fn() }))` and the blackjack mirror — bare automocking instantiates a real Worker at module scope, unsupported by jsdom.
- `resetStores()` (L86-128): both game stores' `setState` with `deckCount: 1` explicitly in the reset, `useUiStore.getState().resetAnimations()` placed AFTER the store resets, both odds stores' `reset()` + `clearCache()`, `usePickerStore.getState().clearAll()`, `useGameModeStore.setState({ mode: 'holdem' })`, all mocks reset.
- `settledSnapshot(win, deckCount)` fixture (L72-84): internally consistent counts; **10-entry categoryCounts at 1 deck, 11 at 2 decks** — the length asymmetry is the contract and doubles as proof of which shoe a run was conditioned on (L159-161).
- `callIndex` distinct-win convention (L60-63): each mocked run's settled win is unique, so a cache-served number is distinguishable from a coincidentally identical fresh one.
- D-16/D-09 value-assertion discipline throughout: assert `aria-pressed` VALUES, `title` VALUES, `startSim.mock.calls[n][0].deckCount`, `getCached(...)?.outcomes.win` — never mere presence where a value is checkable (e.g. L336-343 reads the mocked call's first argument, "never a store field that might coincidentally agree with it").
- Blackjack-side interaction fixtures: `src/App.blackjackLoop.test.tsx` L382-412 (mid-turn toggle re-runs same cards), L414-448 (resolved toggle = pending only), L450-496 (A3 guard incl. hidden-hole case with locked title asserted verbatim at L468/L493), L585-614 (late-snapshot/wrong-deckCount masking, "deckCount IS the generation here" L606).

## Test Impact Map — every suite that touches the toggles

**Break-on-extraction risk: NONE.** Every existing toggle test asserts through testids, rendered DOM attributes, and `getState()` — no test imports either toggle's internals, and the only structure pin is the last-control-bar-child assertion, which the extraction preserves.

| Suite | What it pins | Required change |
|-------|--------------|-----------------|
| `src/App.holdemDeckToggle.test.tsx` (375 lines, all 12 tests) | D-03 cache guard both directions; D-02 lifecycle; A2 placement (`controlBar.lastElementChild` = toggle, L257) + group semantics + labels (L258-261); A3/A4 titles/disabled (L264-322); conditioned payload (L325-344); keyboard + focus retention (L346-375) | **zero edits** (D-03/D-08 require this) |
| `src/App.blackjackLoop.test.tsx` toggle blocks (L382-614) | A3/A16 toggle semantics, locked guard title verbatim (L468, L493), aria-pressed flips, late-snapshot masking | **zero edits** |
| `src/App.modeIsolation.test.tsx` | both-ways DOM-absence via imported `HOLDEM_ONLY_TESTIDS` (L222) + `BLACKJACK_ONLY_TESTIDS` (L300) | **zero edits** — testids unchanged (D-02) |
| `src/App.modeSwitch.test.tsx` | pre-deal absence smoke sweep (L160); blackjack-scene control census = 1 button (L130-133, scene subtree only — the toggle lives in the control bar, outside `blackjack-scene`); `blackjack-deck-toggle` presence (L138) | **zero edits** |
| `src/test/holdemTestids.ts` (L49-51: the three `holdem-deck-toggle*` entries) / `src/test/blackjackTestids.ts` (L21-23) | the sweep lists themselves | **zero edits — HOLDEM_ONLY_TESTIDS and the blackjack sweep need NO change; testids are contractual and unchanged** |
| Five frozen v1 suites + `App.holdemCachePoison.test.tsx` | pre-toggle behavior | **zero edits** (D-08/D-11 — they predate the toggles and never query them) |
| `src/ui/GameModeSwitcher.test.tsx` | the analog only | **zero edits** |
| `src/App.modeShell.guard.test.ts` | see the full audit in Pattern Assignment 5 | **additive only:** `ui/DeckCountToggle.tsx` joins the resetAnimations sweep (+ optional store-free and locked-label pins); zero retargets strictly required, zero deletions |

## Shared Patterns

### CSS — zero changes needed (the load-bearing finding)

**Source:** `src/App.css`. Every toggle rule is keyed on `data-testid` **attribute selectors**, never class names — there is no `.game-mode-switcher` class rule; the "GameModeSwitcher-derived" rules select `[data-testid='game-mode-switcher']` etc. Neither toggle (nor either of its buttons) carries a `className` in source. Since testids arrive via the prefix prop unchanged, **the shipped selector lists match the shared component's output verbatim with zero App.css edits and zero style-guard edits** (D-06 satisfied by construction):

- Wrapper rule (L632-639): `[data-testid='game-mode-switcher'], [data-testid='blackjack-deck-toggle'], [data-testid='holdem-deck-toggle'] { display: inline-flex; … }`
- Segment sizing/typography (L641-654): `[data-testid^='blackjack-deck-toggle-'], [data-testid^='holdem-deck-toggle-'] …`
- Internal divider (L656-660): the `-1` segments' `border-right`
- Active segment (L662-668): `[…][aria-pressed='true']`
- Disabled dimming (L233-244): `[data-testid='blackjack-deck-toggle-1']:disabled, [data-testid='holdem-deck-toggle-1']:disabled`

### 06-02 extraction precedent — the conventions to copy

**Source:** `.planning/phases/06-blackjack-core-odds-loop/06-02-PLAN.md` / `06-02-SUMMARY.md` (the D-07 HoldemGame extraction). Enumerated:

1. **Verbatim-move discipline:** DOM order, testids, classNames (here: none), copy, ids, and aria attributes byte-untouched; only the mechanical parameterization changes. 06-02 moved five JSX regions with `mode === 'holdem' &&` guards removed and nothing else altered.
2. **Same-commit guard amendment:** guard sweep additions/retargets land in the SAME COMMIT as the file creation/extraction; if an intermediate state would flip any suite red, stage without committing and land as one commit (06-02 Tasks 1+2 = single commit `4551bb9`). Phase 8 note: unlike 06-02, the extraction alone flips no guard red (no pin targets toggle markup), so the same-commit rule binds only the ADDITIVE amendments to the commit that creates `DeckCountToggle.tsx`.
3. **Retarget/add, never delete or weaken:** each amended assertion message cites the phase decision and states the assertion MOVED/was ADDED (06-02: "retargeted, not weakened" appears in every moved message); the file-header comment block records the dated amendment per the guard's STANDING RULE (L30-34 — which names Phase 8 explicitly).
4. **Guard green at every commit, verified by checkout:** 06-02 ran the guard suite at a detached checkout of each commit in the range and recorded the counts in the SUMMARY. D-07 re-asserts this for Phase 8.
5. **Negative control:** after retargeting/adding, deliberately break the pinned property (06-02: added a second `cancelSimulation()`), watch the guard go red with the expected message, revert. Record in the SUMMARY.
6. **Behavior-preservation proof:** frozen suites pass with ZERO edits; `git diff --name-only` over the plan range lists exactly the planned files; sanctioned mechanical retargets enumerated in the SUMMARY (D-08). Baseline full-suite count before, after, delta explained as all-additive.

### Component + component-test conventions

**Source:** `src/ui/GameModeSwitcher.tsx` + `src/ui/GameModeSwitcher.test.tsx`. Component: named function export, decision-citing doc comment, `role="group"` + `aria-label` wrapper, `type="button"` + `aria-pressed` segments, never-disabled active segment. Test: one describe, `beforeEach` state reset, tests for default active state, aria-pressed flip on click, already-active no-op, never-disabled, labels-never-change, wrapper group semantics — the exact checklist a DeckCountToggle component suite should mirror (rendered with prop fixtures instead of a store).

## Traps for the Planner

1. **Focus retention forbids remount-inducing patterns:** `App.holdemDeckToggle.test.tsx` L360-374 asserts `document.activeElement` stays on the clicked segment across the fresh deal it triggers. The shared component must be a top-level module-scope component (never defined inline inside a render function) with no `key` derived from changing state — otherwise React remounts the buttons on re-render and focus drops to `<body>`. Stateless + no hooks = no StrictMode/render-identity concerns beyond this.
2. **Attribute-absence semantics:** blackjack segment 2 has NO `title` attribute and segment 2 in both games has NO `disabled` attribute; tests assert `.not.toHaveAttribute('title')` (e.g. holdemDeckToggle L269-270, L276, L281, L321) and `.not.toBeDisabled()`. Passing `title={undefined}` renders no attribute (safe); prefer omitting `disabled` entirely on segment 2 in the shared JSX rather than `disabled={someAlwaysFalseProp}` — simplest byte-identical guarantee.
3. **Raw-source sweeps read comments:** the blackjack-UI store sweep (`App.modeShell.guard.test.ts` L264-288) and the recommended new DeckCountToggle store-free sweep check RAW source including comments (deliberately — L363-368 calls a comment normalising shared vocabulary "the first symptom"). Any comment written in `BlackjackControls.tsx` or `DeckCountToggle.tsx` must avoid the literal tokens `gameStore`, `oddsStore`, `pickerStore`, `uiStore` (existing BlackjackControls comments already dodge this by writing "no Hold'em store, no odds store" with spaces, L9-10). Only comment-stripped counts (`stripCommentLines`) tolerate token mentions.
4. **Do NOT add `DeckCountToggle.tsx` to the deckCount-zero sweep** (guard L234-254) — the component necessarily contains `deckCount`; that sweep pins the three cross-game SHELL files forever, and the new component is game-parameterized UI, not shell. Conversely DO add it to the resetAnimations sweep.
5. **Same-wave file-ownership:** `BlackjackControls.tsx`, `HoldemGame.tsx`, `DeckCountToggle.tsx`, and `App.modeShell.guard.test.ts` must all be owned by the extraction plan (one plan, sequenced commits — each commit independently green since rewiring one game while the other stays inline breaks nothing). The consolidation suite is a new file with no conflicts but must be sequenced AFTER the extraction lands, or its "through the shared component" premise is false. No other Phase 8 work touches these files.
6. **The A4-beats-A3 title precedence is call-site logic:** Hold'em's segment-1 ternary (L247-253) encodes "guard title takes precedence over fresh-deal title" (comment L244-245). If the planner moves title computation into the component, that precedence — and blackjack's never-any-title-on-segment-2 — must be reproducible; passing pre-computed `title` strings per segment sidesteps the whole problem. Recommended.
7. **No snapshot serialization exists** (no `toMatchSnapshot` in any suite), so attribute-order drift can't flip a test — but D-06's "byte-identical DOM" still makes matching the originals' JSX attribute order the zero-thought-required choice.

## No Analog Found

None — every file has an exact in-repo analog.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Metadata

**Analog search scope:** `src/ui/`, `src/state/`, `src/engine/`, `src/test/`, `src/App*.test.*`, `src/App.css`, `.planning/phases/06-*/`
**Files scanned:** 21 read in full or by targeted range (both toggle components, the full mode-shell guard, both testid lists, GameModeSwitcher + test, the full Hold'em toggle suite, targeted ranges of App.blackjackLoop / App.modeSwitch / App.modeIsolation / App.css / BlackjackGame, 06-02-SUMMARY, both stores' deckCount declarations, engine/shoe DeckCount)
**Pattern extraction date:** 2026-08-24
