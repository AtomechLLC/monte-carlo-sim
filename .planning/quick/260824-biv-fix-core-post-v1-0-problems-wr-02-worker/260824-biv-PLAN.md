---
phase: quick/260824-biv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/state/simulationService.ts
  - src/state/simulationService.test.ts
  - tsconfig.app.json
  - src/ui/formatPct.ts
  - src/ui/lockedCategory.ts
  - src/ui/lockedCategory.test.ts
  - src/ui/WinTieLossDisplay.tsx
  - src/ui/OddsTable.tsx
  - src/App.tsx
  - src/App.css
  - src/test/setup.ts
autonomous: true
requirements:
  - IMP-01   # WR-02 — surface hard worker crashes
  - IMP-02   # explicit TS strictness + drop "node" types from the browser tsconfig
  - IMP-1b-1 # win/tie/loss row lost its labels
  - IMP-1b-2 # category-table reads as "at least", is exclusive-final
  - IMP-13   # dedupe formatPct
  - IMP-14   # remove dead scaffold CSS block
  - IMP-15   # harden the test matchMedia polyfill
  - IMP-16   # render the captured errorMessage detail

must_haves:
  truths:
    - "A hard worker death (script-load failure / undeserializable message) shows the simulation-error banner instead of freezing the odds silently"
    - "The odds panel reads as labelled statistics (Trials / Win / Tie / Loss), not one run-on string"
    - "The category table states that it lists the FINAL hand at the river in exclusive categories, and marks the category the hero has already secured"
    - "The 'already secured' mark is derived from visible cards only and never from the hidden runout"
    - "The error banner shows the underlying error detail alongside the existing recovery-path copy"
    - "All 208 pre-existing tests still pass, with every contractual data-testid keeping its exact textContent"
  artifacts:
    - path: "src/state/simulationService.test.ts"
      provides: "WR-02 regression guard — Worker error/messageerror routed to onError"
      contains: "messageerror"
    - path: "src/ui/formatPct.ts"
      provides: "single shared percentage formatter"
      exports: ["formatPct"]
    - path: "src/ui/lockedCategory.ts"
      provides: "visible-cards-only made-hand category for the locked-in indicator"
      exports: ["lockedInCategory"]
    - path: "src/ui/lockedCategory.test.ts"
      provides: "unit coverage for the locked-in derivation, including the <5-known-cards null case"
  key_links:
    - from: "src/state/simulationService.ts"
      to: "onError callback"
      via: "worker.addEventListener('error' | 'messageerror')"
      pattern: "addEventListener\\('(error|messageerror)'"
    - from: "src/ui/OddsTable.tsx"
      to: "src/engine/conditioning.ts"
      via: "deriveConditionedState — the only sanctioned reader of the runout"
      pattern: "deriveConditionedState"
    - from: "src/ui/WinTieLossDisplay.tsx"
      to: "src/ui/formatPct.ts"
      via: "import { formatPct }"
      pattern: "from '\\./formatPct'"
---

<objective>
Clear the eight open post-v1.0 defects in `.planning/IMPROVEMENTS.md` Tier 1 (items 1-2), Tier 1b (both items) and Tier 4 (items 13-16): one real robustness hole (hard worker crashes are invisible), one toolchain hole (implicit strictness + Node ambient types in the browser tsconfig), two first-real-user UX defects in the odds panel, and four small polish items.

Purpose: every one of these was found by review or by driving the shipped app — they are known-bad, not speculative. Clearing them in one pass closes every open review item from the v1.0 milestone.
Output: a hardened `simulationService`, an explicit `tsconfig.app.json`, a labelled and self-explaining odds panel with a leak-safe locked-in indicator, one shared `formatPct`, a detail-carrying error banner, a query-parsing test `matchMedia` polyfill, and no dead scaffold CSS.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/IMPROVEMENTS.md
@.planning/phases/03-casino-table-ui-animation/03-UI-SPEC.md

<interfaces>
<!-- Contracts the executor needs. Extracted from the codebase — do not go exploring for these. -->

From `src/engine/evaluator.ts`:
- `export function evaluateHand(holeCards: [Card, Card], communityCards: Card[]): Hand`
- `export interface Hand { strength: HandStrength; hand: Card[] }`
- `export { HandStrength }` (re-exported from `@poker-apprentice/types`)

`HandStrength` (numeric enum, `@poker-apprentice/types`) — values line up 1:1 with `CATEGORY_LABELS` indices:
`HighCard=0, OnePair=1, TwoPair=2, ThreeOfAKind=3, Straight=4, Flush=5, FullHouse=6, FourOfAKind=7, StraightFlush=8, RoyalFlush=9`

From `src/engine/conditioning.ts`:
- `export function deriveConditionedState(runout: PredeterminedRunout, street: Street, revealedMask: number)`
  returns `{ heroHole: [Card, Card]; knownBoard: Card[]; knownOpponentHoles: (readonly [Card, Card] | null)[]; remainingDeck: Card[] }`
  — this is the ONLY function permitted to read the raw runout (D-02 leak guard). `knownBoard` is `runout.board.slice(0, STREET_BOARD_COUNT[street])`.

From `src/state/gameStore.ts` (as consumed in `src/App.tsx`):
- `useGameStore((s) => s.runout)` → `PredeterminedRunout | null`
- `useGameStore((s) => s.street)` → `Street`
- `useGameStore((s) => s.revealedMask)` → `number`

From `src/state/uiStore.ts`:
- `useUiStore((s) => s.pendingAnimationCount)` → `number`

From `src/state/simulationService.ts`:
- `export async function startSimulation(conditioned, onProgress, onError): Promise<void>`
- `export async function cancelSimulation(): Promise<void>`
- module scope already holds `worker`, `api`, `currentRequestId`, `lastRequestId`, `currentOnProgress`, `progressProxy`

From `src/engine/cards.ts` (test fixtures, as used in `src/worker/simulationApi.test.ts`):
- `FULL_DECK`, `deckWithout(cards)`, `OPPONENT_COUNT`
</interfaces>

<binding_constraints>
1. **All 208 existing tests must stay green.** In particular these exact assertions already exist and must not be broken:
   - `src/App.test.tsx:289` — `screen.getByTestId('simulation-error').textContent` is EXACTLY
     `'The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again.'`
     → the error detail may NOT be appended inside that element.
   - `src/App.test.tsx:131-133` — every `tbody tr`'s FIRST `<th>` textContent equals `CATEGORY_LABELS` verbatim
     → the locked-in "✓" may NOT go inside the row header `<th>`.
   - `src/App.test.tsx` / `src/App.phase3.acceptance.test.tsx` — `trial-counter`, `win-pct`, `tie-pct`, `lose-pct`,
     `category-pct-0..9` textContent is asserted as exactly `'—'`, `'100'`, `'60.0%'`, `'50.0%'`, …
     → new labels go in SIBLING elements; those testids' textContent stays value-only.
2. **No changes to engine or worker math.** `src/engine/equity.ts`, `src/engine/evaluator.ts`, `src/worker/*` are read-only this plan.
3. **UI copy must conform to `03-UI-SPEC.md`** — Typography roles (Body 16/400/1.5, Label 14/400/1.4 only; no new sizes, weights 400/600 only), Spacing tokens (xs 4 / sm 8 / md 16 / lg 24 px only), and the Copywriting avoid-list (no "Cancel"/"OK"/"Submit"/"Save").
4. **No new npm packages.** Nothing in this plan installs a dependency, so the package-legitimacy gate does not apply.
</binding_constraints>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Surface hard worker crashes (WR-02) and make the app tsconfig explicit</name>
  <files>src/state/simulationService.ts, src/state/simulationService.test.ts, tsconfig.app.json, src/ui/node-builtins.d.ts (conditional — see 1d)</files>

  <read_first>
    - `src/state/simulationService.ts` (full file — 78 lines)
    - `src/worker/simulationApi.test.ts` lines 1-30 (the node-env worker test fixture pattern to crib)
    - `tsconfig.app.json`
    - `src/ui/PlayingCard.test.tsx` lines 1-12 (the only `node:fs`/`node:url`/`node:path` consumer in `src/`)
  </read_first>

  <behavior>
    - Test 1: while a `startSimulation` call is in flight and its Comlink promise never settles, dispatching an `error` event on the worker invokes the caller's `onError` exactly once, with a message containing the underlying `ErrorEvent.message`.
    - Test 2: dispatching a `messageerror` event on the worker invokes the caller's `onError` exactly once with a deserialization-flavoured message.
    - Test 3 (stale-closure guard): after a run's `runSimulation` promise has resolved normally, a later worker `error` event does NOT invoke that finished run's `onError`.
  </behavior>

  <action>
    **1a — `src/state/simulationService.ts`.** Add worker-level failure plumbing that reuses the existing `onError` path:

    - Add a module-scope `let currentOnError: ((message: string) => void) | null = null;` next to the existing `currentOnProgress`.
    - In `startSimulation`, set `currentOnError = onError;` immediately after `currentOnProgress = onProgress;`. In the existing `finally` block, inside the same `if (currentRequestId === requestId)` guard that nulls `currentOnProgress`, also null `currentOnError`.
    - Add two module-scope constants:
      `const WORKER_CRASH_MESSAGE = 'The simulation worker stopped unexpectedly';`
      `const WORKER_MESSAGE_ERROR = 'The simulation worker sent a message that could not be read';`
    - Add a hoisted `function reportWorkerFailure(message: string): void` that (in this order) captures `currentOnError` into a local, sets `currentOnProgress = null`, `currentOnError = null`, `currentRequestId = -1` (so any late-resolving Comlink call for the now-dead generation is filtered out by the existing requestId guard), then calls the captured callback with `message`. Nulling before invoking is what makes a crash report exactly-once.
    - Register both listeners at module scope, immediately below `reportWorkerFailure`:
      - `worker.addEventListener('error', (event) => { event.preventDefault(); reportWorkerFailure(event.message ? `${WORKER_CRASH_MESSAGE}: ${event.message}` : WORKER_CRASH_MESSAGE); });` — `preventDefault()` stops the browser's default "Uncaught error in worker" console spew from remaining the only signal; the banner is now the signal. TS types the `'error'` event on `Worker` as `ErrorEvent`, so no cast is needed.
      - `worker.addEventListener('messageerror', () => reportWorkerFailure(WORKER_MESSAGE_ERROR));`
    - Add a short comment above the listeners naming WR-02 / `02-REVIEW.md`: call rejections were already surfaced; a hard worker death fires this event instead and used to leave every Comlink promise hanging forever.

    **1b — `src/state/simulationService.test.ts` (new).** jsdom (default env — do NOT add `@vitest-environment node`; the test needs `EventTarget` + `ErrorEvent`). Structure:

    - `const { workers, runSimulation, cancel } = vi.hoisted(() => ({ workers: [] as EventTarget[], runSimulation: vi.fn(), cancel: vi.fn() }));`
    - `vi.mock('../worker/simulation.worker?worker', () => { class FakeWorker extends EventTarget { postMessage() {} terminate() {} constructor() { super(); workers.push(this); } } return { default: FakeWorker }; });` — the specifier string must be byte-identical to the one `simulationService.ts` imports (both files sit in `src/state/`, so the same relative path resolves from either).
    - `vi.mock('comlink', () => ({ wrap: () => ({ runSimulation, cancel }), proxy: <T,>(cb: T) => cb }));` — the real `Comlink.wrap` would try to speak the message protocol to the fake worker and hang.
    - Import `startSimulation` AFTER the mocks, plus `FULL_DECK`/`deckWithout` from `../engine/cards` for a minimal pre-flop `ConditionedState` fixture (mirror `src/worker/simulationApi.test.ts` lines 10-18).
    - In each test: `runSimulation.mockImplementation(() => new Promise(() => {}))` to model a hung call, fire `void startSimulation(fixture, vi.fn(), onError)`, then `await vi.waitFor(() => expect(runSimulation).toHaveBeenCalled())` before dispatching — that await is what guarantees `currentOnError` has been assigned (it is set after the `await cancelSimulation()` tick).
    - Dispatch with `workers[0].dispatchEvent(new ErrorEvent('error', { message: 'Failed to load worker script' }))` and `new MessageEvent('messageerror')`.
    - Test 3 uses `runSimulation.mockResolvedValue(undefined)` and `await startSimulation(...)` to completion first, then dispatches `error` and asserts `onError` was never called.
    - Reset `workers`/mock state between tests only via `vi.clearAllMocks()` — do NOT clear `workers`, since the service's worker singleton is constructed once at module load.

    **1c — `tsconfig.app.json`.** Add `"strict": true` explicitly (a sibling of `"target"`, with a short comment that TS 6.0.3 defaults it on but the leak guards depend on the nullability contract, e.g. `FlipCard.card` being `undefined` while hidden) and change `"types": ["vite/client", "node"]` to `"types": ["vite/client"]` — browser code must not see Node ambient globals.

    **1d — scoped fallback for the one on-disk-asset test.** After 1c, run `npx tsc -b --force`. If (and ONLY if) it now reports errors for `src/ui/PlayingCard.test.tsx`'s `node:fs` / `node:url` / `node:path` imports, add a new `src/ui/node-builtins.d.ts` declaring ONLY the four symbols that file uses — `existsSync` from `node:fs`, `fileURLToPath` from `node:url`, `join` and `dirname` from `node:path` — with a comment explaining it is deliberately narrower than `@types/node` (module shapes only, zero Node ambient globals). Do NOT add this file pre-emptively: if `@types/node` is already reaching the program transitively via Vitest's own type references, a duplicate `declare module` would be a hard error.
  </action>

  <verify>
    <automated>npx vitest run src/state/simulationService.test.ts && npx tsc -b --force && npx eslint src/state tsconfig.app.json --no-error-on-unmatched-pattern</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "addEventListener('error'" src/state/simulationService.ts` returns 1 and `grep -c "addEventListener('messageerror'" src/state/simulationService.ts` returns 1
    - `src/state/simulationService.test.ts` has 3 passing tests covering `error`, `messageerror`, and the finished-run stale guard
    - `tsconfig.app.json` contains `"strict": true` and its `types` array is exactly `["vite/client"]`
    - `npx tsc -b --force` exits 0
  </acceptance_criteria>

  <done>A hard worker death routes through `onError` into the existing visible banner, proven by a regression test; the browser tsconfig states its own strictness and no longer pulls Node ambient types into app code.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Label the win/tie/loss row, explain the category table, and dedupe formatPct</name>
  <files>src/ui/formatPct.ts, src/ui/lockedCategory.ts, src/ui/lockedCategory.test.ts, src/ui/WinTieLossDisplay.tsx, src/ui/OddsTable.tsx, src/App.css</files>

  <read_first>
    - `src/ui/WinTieLossDisplay.tsx`, `src/ui/OddsTable.tsx`, `src/ui/categoryLabels.ts` (all short)
    - `src/App.test.tsx` lines 109-142 (the category-table structural assertions this task must not break)
    - `src/App.css` lines 555-600 (the existing `.visually-hidden` utility and `.odds-panel--pending`)
    - `03-UI-SPEC.md` — Typography, Spacing Scale, Copywriting Contract sections
  </read_first>

  <behavior>
    - `lockedInCategory(heroHole, knownBoard)` returns `null` when fewer than 5 cards are known — including pre-flop with a pocket pair, where only 2 cards exist.
    - `lockedInCategory(['Ac','Kd'], ['Ah','7c','2d'])` returns `HandStrength.OnePair` (1).
    - `lockedInCategory(['Ac','Ad'], ['Ah','7c','2d'])` returns `HandStrength.ThreeOfAKind` (3).
    - `lockedInCategory(null, [...])` returns `null`.
    - The returned value is a valid `CATEGORY_LABELS` index (0-9) whenever it is non-null.
  </behavior>

  <action>
    **2a — `src/ui/formatPct.ts` (new).** Move the byte-identical `formatPct(count, trialsCompleted, pending)` currently duplicated in `WinTieLossDisplay.tsx` and `OddsTable.tsx` into this one exported function, carrying its existing em-dash comment (UI-SPEC A9) across verbatim. Delete both local copies and import from `./formatPct` in each. Behaviour must not change by one character — `'—'` when pending or zero trials, else `` `${((count / trialsCompleted) * 100).toFixed(1)}%` ``.

    **2b — `src/ui/lockedCategory.ts` (new).** Export
    `function lockedInCategory(heroHole: readonly [Card, Card] | null, knownBoard: readonly Card[]): HandStrength | null`.
    Return `null` when `heroHole === null` or when `heroHole.length + knownBoard.length < 5` (named constant `MIN_EVALUABLE_CARDS = 5`); otherwise return `evaluateHand([heroHole[0], heroHole[1]], [...knownBoard]).strength`. Document in the header comment that the function is structurally leak-proof: it can only ever see the cards its caller passes, and its caller passes `deriveConditionedState`'s visible-only output (D-02).
    Add `src/ui/lockedCategory.test.ts` with `// @vitest-environment node` as its first line (matching the engine tests), covering the five behaviours above. Use plain card literals (`'Ac'`, `'Ah'`, …), not `FULL_DECK` slices, so each expectation is readable.

    **2c — `src/ui/WinTieLossDisplay.tsx`.** Replace the bare `<div>` of four unlabelled spans with a labelled description list. `data-testid` and textContent for `trial-counter`, `win-pct`, `tie-pct`, `lose-pct` stay EXACTLY as they are today — they simply move onto the `<dd>` elements:

    - `<dl className="odds-stats">` wrapping four `<div className="odds-stat">` groups, each holding `<dt className="odds-stat__label">` + `<dd className="odds-stat__value" data-testid="…">`.
    - Labels, in order: `Trials`, `Win`, `Tie`, `Loss` (`dt`/`dd` gives screen readers real label-value association, which the current run-on markup does not).
    - Keep the existing `pending ? '—' : trialsCompleted.toLocaleString()` expression for the counter unchanged.

    **2d — `src/ui/OddsTable.tsx`.** Three additions, all outside the two contractual testids:

    - `<caption className="category-table__caption">` immediately inside `<table>`, containing the line `Final hand by the river` plus a `<span className="category-table__subtitle">` reading exactly: `Each row is the hand you end up with — the rows are exclusive and add up to 100%.` This is the actual defect: a user holding locked trips read 65.2% as "wrong" because the improvement outcomes live in separate rows.
    - A third column. `<thead>` gains `<th scope="col">Locked In</th>` (add `scope="col"` to the two existing header cells too). Each body row gains a THIRD cell `<td data-testid={`category-locked-${index}`}>` — never a `<th>`, so `row.querySelector('th')` keeps returning the category label. When `lockedIndex === index`, render `<span aria-hidden="true">✓</span>` plus `<span className="visually-hidden">You already have this</span>` (reuse the existing `.visually-hidden` utility already in `App.css`); otherwise render `null`.
    - The `lockedIndex` derivation — visible cards only:
      ```
      const runout = useGameStore((state) => state.runout);
      const street = useGameStore((state) => state.street);
      const revealedMask = useGameStore((state) => state.revealedMask);
      const lockedIndex = useMemo(() => {
        if (pending || runout === null) return null;
        const { heroHole, knownBoard } = deriveConditionedState(runout, street, revealedMask);
        return lockedInCategory(heroHole, knownBoard);
      }, [pending, runout, street, revealedMask]);
      ```
      Two non-negotiable properties, each worth a comment: (1) the cards come from `deriveConditionedState` — the ONLY sanctioned reader of the runout (D-02) — never from `runout.board` sliced here, so a hidden turn/river card can never influence the mark; (2) the `pending` short-circuit means no ✓ appears while cards are still mid-flight, matching UI-SPEC A9's "no value while cards are in flight" rule for the percentage cells.
      Mark only the single category of the hero's current made hand — do not mark dominated categories.

    **2e — `src/App.css`.** Append to the odds-panel section (near `.odds-panel--pending`), using only UI-SPEC tokens — Label role 14/400/1.4 for `dt`, caption subtitle and column header; Body 16/400/1.5 for values; gaps of 4px (xs) and 16px (md) only:
    - `.odds-stats { display: flex; flex-wrap: wrap; gap: 16px; margin: 0; }`
    - `.odds-stat { display: flex; flex-direction: column; gap: 4px; }`
    - `.odds-stat__label { margin: 0; font-size: 14px; font-weight: 400; line-height: 1.4; }`
    - `.odds-stat__value { margin: 0; font-size: 16px; font-weight: 400; line-height: 1.5; font-variant-numeric: tabular-nums; }` — the explicit `margin: 0` matters: the UA stylesheet gives `<dd>` a 40px inline start margin.
    - `.category-table__caption { text-align: left; font-size: 16px; font-weight: 600; line-height: 1.5; margin-bottom: 4px; }` and `.category-table__subtitle { display: block; font-size: 14px; font-weight: 400; line-height: 1.4; }`
    Add a header comment naming the Tier 1b defects these rules fix (the `200,00080.2%3.1%16.7%` run-on string, and the "at least" misreading).
  </action>

  <verify>
    <automated>npx vitest run src/ui/lockedCategory.test.ts src/App.test.tsx src/App.phase3.acceptance.test.tsx && npx tsc -b --force</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "function formatPct" src/ui/WinTieLossDisplay.tsx src/ui/OddsTable.tsx` reports 0 for both files, and `src/ui/formatPct.ts` exports exactly one `formatPct`
    - `src/App.test.tsx`'s `rowLabels` assertion (first `<th>` per row === `CATEGORY_LABELS`) still passes unchanged
    - Every `trial-counter` / `win-pct` / `tie-pct` / `lose-pct` / `category-pct-*` textContent assertion across `App.test.tsx` and `App.phase3.acceptance.test.tsx` still passes unchanged
    - `src/ui/OddsTable.tsx` contains `deriveConditionedState` and does NOT contain `runout.board`
    - `src/ui/lockedCategory.test.ts` has ≥5 passing tests including the pre-flop-null case
  </acceptance_criteria>

  <done>The odds panel reads as four labelled statistics; the category table declares itself as the exclusive final-hand distribution and ticks the category the hero has already made from visible cards only; one `formatPct` exists.</done>
</task>

<task type="auto">
  <name>Task 3: Show the error detail, delete the dead scaffold CSS, and parse queries in the test matchMedia polyfill</name>
  <files>src/App.tsx, src/App.css, src/test/setup.ts</files>

  <read_first>
    - `src/App.tsx` lines 110-120 (the banner block) and `src/App.css` lines 218-232 (`.simulation-error`)
    - `src/App.css` lines 73-154 (the dead `#next-steps` / `#docs` / `#next-steps ul` blocks) and lines 186-194 (the Phase 2 comment that names them)
    - `src/test/setup.ts` lines 27-50 (the matchMedia polyfill)
    - `src/App.test.tsx` lines 278-305 and 596-616 (the two banner assertions that constrain the markup)
  </read_first>

  <action>
    **3a — error detail in the banner (`src/App.tsx` + `src/App.css`).** `src/App.test.tsx:289` asserts `getByTestId('simulation-error').textContent` is EXACTLY `SIMULATION_ERROR_MESSAGE`, and line 288 asserts `role="alert"` sits on that same element — so the detail must be a SIBLING, not a child, and the element keeps both its testid and its role. Replace the banner block with:

    ```
    <div className="simulation-error-banner">
      <div className="simulation-error" data-testid="simulation-error" role="alert">
        {SIMULATION_ERROR_MESSAGE}
      </div>
      <p className="simulation-error-detail" data-testid="simulation-error-detail">
        Reported error: {errorMessage}
      </p>
    </div>
    ```

    Comment the deliberate a11y trade-off: the detail sits outside the `role="alert"` live region so the announced text stays the actionable recovery-path sentence (UI-SPEC Copywriting Contract keeps that copy verbatim) rather than a raw technical string; the detail is still in normal reading order for anyone who wants it.

    In `App.css`, move the box treatment up to the new wrapper so the two elements read as one banner, keeping `--destructive` scoped to this banner exactly as the Color contract requires:
    - `.simulation-error-banner { margin-top: 16px; padding: 8px 12px; border-left: 4px solid var(--destructive); }`
    - `.simulation-error` keeps `color: var(--destructive); font-size: 16px; font-weight: 400; line-height: 1.5;` and DROPS `margin-top`, `padding` and `border-left` (now on the wrapper).
    - `.simulation-error-detail { margin: 4px 0 0; color: var(--destructive); font-size: 14px; font-weight: 400; line-height: 1.4; }` (Label role — no new type sizes).

    **3b — delete the dead scaffold CSS (`src/App.css`).** Delete the three blocks spanning lines 73-154: `#next-steps { … }`, `#docs { … }`, and `#next-steps ul { … }` (which is where the dead `.logo` rule lives). Delete only these three — `.counter`, `.hero`, `#center`, `#spacer` and `.ticks` are out of scope for this plan and stay. Then update the stale Phase 2 comment near line 192, which currently reads "the Phase 1 scaffold selectors (`.counter`, `.hero`, `#next-steps`, etc.) are left exactly as they were" — it must no longer name `#next-steps`; list the selectors that actually remain (`.counter`, `.hero`, `#center`, `#spacer`, `.ticks`) and note that the `#next-steps`/`#docs`/`.logo` block was removed as dead code.

    **3c — harden the test `matchMedia` polyfill (`src/test/setup.ts`).** Replace `matches: query.includes('prefers-reduced-motion')` with a real parse of the one feature this harness cares about. The current substring test answers `true` for `'(prefers-reduced-motion: no-preference)'` — the exact negation of what it means to say. Add above the polyfill:

    ```
    const REDUCED_MOTION_QUERY = /\(\s*prefers-reduced-motion\s*(?::\s*([\w-]+)\s*)?\)/;

    function matchesReducedMotion(query: string): boolean {
      const match = REDUCED_MOTION_QUERY.exec(query);
      if (match === null) return false;
      const value = match[1] ?? 'reduce';
      return value === 'reduce';
    }
    ```

    and use `matches: matchesReducedMotion(query)`. Comment the two cases the regex encodes: the bare feature form `(prefers-reduced-motion)` is true whenever the value is anything other than `no-preference` — and this harness deliberately forces `reduce` for every test (D-09) — while any unrelated query (e.g. `(min-width: 1024px)`) now correctly returns `false` instead of accidentally matching. This change is self-verifying: the whole 208-test suite depends on reduced motion evaluating `true`, so a wrong regex fails loudly rather than silently.
  </action>

  <verify>
    <automated>npx vitest run && npx tsc -b --force && npx eslint . && npm run build && ! grep -q '#next-steps' src/App.css</automated>
  </verify>

  <acceptance_criteria>
    - `npx vitest run` reports ≥208 passing tests, 0 failing (208 pre-existing + the new tests from Tasks 1 and 2)
    - `npx tsc -b --force`, `npx eslint .` and `npm run build` all exit 0
    - `grep -q '#next-steps' src/App.css` finds nothing (including in comments — the Phase 2 comment was updated)
    - `src/App.tsx` renders `data-testid="simulation-error-detail"` as a sibling of `data-testid="simulation-error"`, and the latter still carries `role="alert"` with unchanged textContent
    - `src/test/setup.ts` contains no `query.includes(` call
  </acceptance_criteria>

  <done>The banner shows the underlying error text alongside the recovery-path copy, the scaffold CSS block is gone with no stale comment referencing it, the test polyfill parses queries instead of substring-matching, and the full gate (tests + tsc + eslint + build) is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Web Worker → main thread | `ErrorEvent.message` and Comlink payloads cross into main-thread state and, after this plan, into rendered DOM text |
| Hidden runout → rendered UI | The predetermined runout holds cards the user has not yet been shown; the new locked-in indicator reads hero cards near that data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Information disclosure | `OddsTable` locked-in indicator | mitigate | Derive the mark exclusively from `deriveConditionedState(runout, street, revealedMask)` output (`heroHole` + `knownBoard`) — the D-02 sanctioned reader — never from `runout.board`; additionally short-circuit to `null` while `pending`, so nothing is marked from a card still mid-flight |
| T-quick-02 | Information disclosure | `simulation-error-detail` rendering `errorMessage` | accept | The string originates from this app's own worker/Comlink in a client-only static app with no backend, no secrets and no user accounts; React escapes it as text (never `dangerouslySetInnerHTML`), so it cannot execute |
| T-quick-03 | Denial of service | worker `error` / `messageerror` listeners | mitigate | `reportWorkerFailure` nulls `currentOnProgress`/`currentOnError` and invalidates `currentRequestId` BEFORE invoking the callback, so a crash reports exactly once and cannot loop or resurrect a dead generation — this is the fix, replacing today's silent hang |
| T-quick-SC | Tampering | npm/pip/cargo installs | n/a | No packages are installed by this plan — the supply-chain checkpoint does not apply |
</threat_model>

<verification>
Run from the repo root after all three tasks:

```
npx vitest run       # ≥208 passing, 0 failing
npx tsc -b --force   # exit 0
npx eslint .         # exit 0
npm run build        # exit 0
```

Manual spot-check (`npm run dev`): deal a hand, advance to the flop, and confirm (1) the odds row reads `Trials … / Win … / Tie … / Loss …` with visible separation rather than one run-on string, (2) the category table shows the "Final hand by the river" caption and its exclusivity subtitle, and (3) a ✓ appears on exactly one category row once you are past pre-flop, and never on a category the visible cards do not support.
</verification>

<success_criteria>
- All eight scoped IMPROVEMENTS items are implemented; nothing outside them is touched
- All 208 pre-existing tests pass, plus new tests for WR-02 (3) and the locked-in derivation (≥5)
- `npx tsc -b`, `npx eslint .`, `npm run build` all exit 0
- Every contractual `data-testid` from the Phase 1-3 testid contract keeps its exact current textContent semantics
- New UI copy conforms to `03-UI-SPEC.md` typography, spacing and copywriting contracts
- `src/engine/*` and `src/worker/*` are unmodified
</success_criteria>

<output>
Create `.planning/quick/260824-biv-fix-core-post-v1-0-problems-wr-02-worker/260824-biv-SUMMARY.md` when done.

Also update `.planning/IMPROVEMENTS.md`: mark items 1, 2, both Tier 1b bullets, and 13-16 as done (leave items 3, 4, 5-12 and 17 untouched), and update the "Suggested sequencing" line so it no longer proposes the now-completed cleanup pass for those items.
</output>
