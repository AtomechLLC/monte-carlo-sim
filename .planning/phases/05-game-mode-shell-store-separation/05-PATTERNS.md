# Phase 5: Game-Mode Shell & Store Separation - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 6 (2 new store, 2 new component, 2 modified, 1 new isolation test — 7 counting the test pair for the store/component)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/state/gameModeStore.ts` | store | CRUD (single-field set) | `src/state/uiStore.ts` | exact (minimal curried store, no cross-store reads) |
| `src/state/gameModeStore.test.ts` | test | CRUD | `src/state/uiStore.test.ts` | exact (direct `getState()` calls, no React) |
| `src/ui/GameModeSwitcher.tsx` | component (control) | event-driven | `src/ui/StreetControls.tsx` | exact (thin component, store selectors + bound actions, two sibling buttons, `data-testid` per button) |
| `src/ui/GameModeSwitcher.test.tsx` | test | event-driven | `src/ui/CardPicker.test.tsx` / `src/App.test.tsx`'s toggle tests | role-match (render + `userEvent.click` + assert active/testid state) |
| `src/ui/BlackjackScene.tsx` | component (placeholder screen) | transform (static render, no data) | `src/ui/TableScene.tsx` (shell) + `App.tsx`'s `empty-hand-state` block (copy/testid convention) | role-match (felt wrapper) + exact (empty-state contract) |
| `src/App.tsx` (modified: mode branch, odds-effect scoping, switch-away cancellation) | controller | streaming + event-driven | `src/App.tsx`'s own existing odds effect (lines 37-97) | exact (self-analog — same file gains a guard + a dependency, not a rewrite) |
| `src/App.css` (modified) | config (styles) | n/a | `src/App.css`'s existing phase-tagged comment-block convention (e.g. "Phase 3 felt table scene (03-02)", lines 332-343) | exact |
| New isolation test file (e.g. `src/App.modeIsolation.test.tsx`) | test | event-driven | `src/App.test.tsx` (gate/cancellation describe blocks) + `src/state/gameStore.test.ts` (snapshot-equality style) + `src/App.acceptance.test.tsx` (guard-test naming/structure) | exact (composite of three existing conventions) |

## Pattern Assignments

### `src/state/gameModeStore.ts` (store, CRUD)

**Analog:** `src/state/uiStore.ts` (whole file, 37 lines — read in full, no re-reads needed)

**Why this analog over `gameStore.ts`:** `gameModeStore` per D-02 holds ONLY `{ mode, setMode() }` this phase — no cross-store reads, no derived fields, no side-effecting actions. `uiStore.ts` is the only existing store this minimal (a single primitive field + guarded setters, zero imports from other stores). `gameStore.ts`/`pickerStore.ts` are richer analogs for the *curried-store syntax* only, not for the *shape*.

**Curried store + doc-comment convention** (`src/state/uiStore.ts` lines 1-37):
```typescript
import { create } from 'zustand';

interface UiState {
  /**
   * Number of card animations currently in flight. A counter, never a boolean: ...
   */
  pendingAnimationCount: number;
  beginAnimation: () => void;
  endAnimation: () => void;
  resetAnimations: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  pendingAnimationCount: 0,
  beginAnimation: () => set((state) => ({ pendingAnimationCount: state.pendingAnimationCount + 1 })),
  endAnimation: () => set((state) => ({ pendingAnimationCount: Math.max(0, state.pendingAnimationCount - 1) })),
  resetAnimations: () => set({ pendingAnimationCount: 0 }),
}));
```
Apply this exact shape to `gameModeStore.ts`: a closed-union field (`mode: 'holdem' | 'blackjack'`, mirroring `Street`'s style in `src/engine/streets.ts` and `DeckCount`'s style in `src/engine/shoe.ts` — no boolean, no enum, a literal union) plus one setter (`setMode`). Every doc-comment in this codebase that states an invariant (e.g. "never negative", "TEST-ONLY") is load-bearing — write one for `setMode` even if it looks trivial, matching this file's density.

**No cross-store import guard (mirrors `oddsStore.ts` line 6):**
```typescript
// oddsStore must not import gameStore — the dependency runs one way only ...
```
`gameModeStore.ts` should carry an equivalent one-line comment: it must not import `gameStore`/`oddsStore`/`pickerStore` — those stores stay entirely unaware that Blackjack mode exists (D-05).

---

### `src/state/gameModeStore.test.ts` (test)

**Analog:** `src/state/uiStore.test.ts` (whole file, 35 lines)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore — pendingAnimationCount gate (D-11)', () => {
  beforeEach(() => {
    useUiStore.getState().resetAnimations();
  });

  it('starts with pendingAnimationCount === 0', () => {
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
  // ... direct getState() calls, no render(), no React at all
});
```
`gameModeStore.test.ts` should follow this exact shape: `beforeEach` resets via `useGameModeStore.setState({ mode: 'holdem' })` (mirrors `useGameStore.setState({...})` in `gameStore.test.ts` line 21 — tests reset via `.setState`, production code never calls a bespoke reset for non-counter stores), then plain `getState()`/`setMode()` calls with no rendering. Title the describe block with the D-number this store's minimality traces to (`D-02`), matching every other test file's `describe('<store> — <invariant> (D-NN)')` convention seen in `uiStore.test.ts` line 4 and `pickerStore.test.ts` line 15.

---

### `src/ui/GameModeSwitcher.tsx` (component, event-driven)

**Analog:** `src/ui/StreetControls.tsx` (whole file, 24 lines)

```typescript
import { useGameStore } from '../state/gameStore';
import { STREET_LABEL } from '../engine/streets';

export function StreetControls() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);
  const advanceStreet = useGameStore((state) => state.advanceStreet);
  const rewindStreet = useGameStore((state) => state.rewindStreet);

  const noHand = runout === null;

  return (
    <div>
      <h2>Street</h2>
      <button type="button" data-testid="rewind-button" onClick={rewindStreet} disabled={noHand || street === 'preflop'}>
        Rewind
      </button>
      <span data-testid="street-label">{STREET_LABEL[street]}</span>
      <button type="button" data-testid="advance-button" onClick={advanceStreet} disabled={noHand || street === 'river'}>
        Advance
      </button>
    </div>
  );
}
```
Copy this shape directly: two `useGameModeStore` selectors (`mode`, `setMode`), two sibling `<button type="button">`s with `data-testid="mode-switch-holdem"` / `data-testid="mode-switch-blackjack"` (lowercase-hyphen convention, matching every existing testid in this codebase — `rewind-button`, `advance-button`, `set-up-scenario-button`, `opponent-seat-0`, etc.), each `onClick={() => setMode('holdem'|'blackjack')}`. Labels must be the exact locked strings `"Hold'em"` and `"Blackjack"` per D-01 — no dynamic label rewriting, mirroring the `"Set Up Scenario"` toggle's own locked-label rule (UI-SPEC A5, `src/App.tsx` lines 132-140: `aria-expanded` conveys state, the visible label text never changes). For `GameModeSwitcher`, convey the active game via `aria-pressed={mode === 'holdem'}` (or `aria-current`) on each button plus a CSS hook — not by changing the button text.

**Active-state visual precedent (non-accent territory, D-01):**
`src/ui/CardPicker.tsx` line 67 — the ONLY existing "this thing is in a selected/filled state" conditional class in the codebase:
```typescript
<button type="button" data-testid={`picker-slot-${slot}`} className={value !== null ? 'picker-slot-filled' : undefined} onClick={() => openPanel(slot)}>
```
paired with `src/App.css` lines 164-172:
```css
/* Accent is reserved for exactly three things: the current street-name
 * label, a filled picker slot's text, and the Advance button's label while
 * it is the enabled/actionable next step. Never a background fill, never on
 * the Deal button. */
.picker-slot-filled,
[data-testid='street-label'],
[data-testid='advance-button']:not(:disabled) {
  color: var(--accent);
}
```
**Flag for the planner:** `.picker-slot-filled` is ITSELF one of the three reserved accent uses — it is not a free non-accent pattern to reuse verbatim. D-01 asks for the conditional-`className`-on-active-state *mechanism* (`className={active ? 'mode-switch-active' : undefined}`) but a DIFFERENT, non-accent token for the color (e.g. `var(--border)`/`var(--text-h)`/font-weight 600, all already defined in `src/index.css`) unless the UI-SPEC accent budget is explicitly amended. There is no existing non-accent "active/selected" CSS rule anywhere in the codebase to copy byte-for-byte — this is a genuine gap (see "No Analog Found" below).

---

### `src/ui/GameModeSwitcher.test.tsx` (test)

**Analog:** `src/ui/CardPicker.test.tsx` (render + `userEvent` + testid assertions) combined with `src/App.test.tsx` lines 444-456 (the `"Set Up Scenario"` toggle test):
```typescript
it('the "Set Up Scenario" disclosure starts collapsed and toggles the card picker on click', async () => {
  const user = userEvent.setup();
  render(<App />);

  const toggle = screen.getByTestId('set-up-scenario-button');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('card-picker')).not.toBeInTheDocument();

  await user.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('card-picker')).toBeInTheDocument();
});
```
Mirror this shape for `GameModeSwitcher`: render the component standalone (it only needs `gameModeStore`, no `simulationService` mock required), click the Blackjack button, assert `aria-pressed`/active-class flips and `useGameModeStore.getState().mode === 'blackjack'`.

---

### `src/ui/BlackjackScene.tsx` (placeholder component)

**Analog 1 — felt shell wrapper:** `src/ui/TableScene.tsx` lines 33-44:
```typescript
return (
  <div data-testid="table-scene" className="felt">
    <HandDisplay />
    <BoardDisplay />
    <div data-testid="deck-origin" className="deck-origin" aria-hidden="true">
      <CardBack />
      <CardBack />
      <CardBack />
    </div>
  </div>
);
```
`BlackjackScene.tsx` reuses the `.felt` CSS class (radial-gradient felt background, oval shape, rail shadow — `src/App.css` lines 344-355) for the "shell" per D-03, but renders NO seats/board/deck-origin — only the empty-state block described next. Do not read/write `gameStore`, `oddsStore`, `pickerStore`, or `uiStore` from this component at all (D-05).

**Analog 2 — empty-state copy/testid contract:** `src/App.tsx` lines 105-113:
```tsx
{runout === null && (
  <div className="empty-hand-state" data-testid="empty-hand-state">
    <h2>No hand dealt yet</h2>
    <p>
      Click Deal to draw a random hand, or click Set Up Scenario to construct your own
      hand, then click Deal.
    </p>
  </div>
)}
```
paired with `src/App.css` lines 131-137:
```css
.empty-hand-state {
  margin-top: 16px;
  padding: 8px 12px;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
}
```
Copy this exact `<h2>` + `<p>` shape into a `data-testid="blackjack-empty-state"` block (D-03's exact testid), reusing the `.empty-hand-state` CSS class (or a renamed shared class — planner's call) rather than inventing new type-scale rules. Copy text must explain the Blackjack table is "coming next" (UI-SPEC-conformant, no generic "Coming Soon" placeholder) — follow the Copywriting Contract convention in `03-UI-SPEC.md` (`## Copywriting Contract`, line 247): every locked user-facing string in this codebase is stated once, verbatim, and tested for verbatim match (see `src/App.test.tsx` line 470-476's `.toContain(...)` assertion against the exact A7 string). D-03 also requires NO Hold'em testid anywhere in this component's subtree, and NO disabled/dead gameplay controls — unlike `CardPicker.tsx`'s pattern of rendering disabled buttons (`disabled={used}`), `BlackjackScene` must render zero interactive gameplay controls, not disabled ones.

---

### `src/App.tsx` (modified — mode branch, odds-effect scoping, switch-away cancellation)

**Analog: the file's own existing odds effect** (`src/App.tsx` lines 20-97) — this is the exact block D-05 mode-scopes, not a different file's pattern:
```typescript
function App() {
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const dealNonce = useGameStore((state) => state.dealNonce);
  const pendingAnimationCount = useUiStore((state) => state.pendingAnimationCount);
  // ... transient UI state ...

  useEffect(() => {
    if (pendingAnimationCount > 0) return;
    if (!runout) return;

    const cached = useOddsStore.getState().getCached(street, revealedMask);
    if (cached) {
      useOddsStore.getState().applySnapshot(cached);
      queueMicrotask(() => setErrorMessage(null));
      return;
    }

    let ignore = false;
    useOddsStore.getState().reset();

    const conditioned = deriveConditionedState(runout, street, revealedMask);
    void startSimulation(
      conditioned,
      (snapshot) => { /* ... */ },
      (message) => { /* ... */ },
    );

    return () => {
      ignore = true;
      void cancelSimulation();
    };
  }, [runout, street, revealedMask, dealNonce, pendingAnimationCount]);

  return (
    <MotionConfig reducedMotion="user">
      {/* ... control-bar, empty-hand-state, table-row ... */}
    </MotionConfig>
  );
}
```
**Required change shape (D-05/D-07), following the file's OWN established idiom, not a new pattern:**
1. Add `const mode = useGameModeStore((state) => state.mode);` alongside the existing subscribed-value block (mirrors the existing `pendingAnimationCount` comment's discipline — a subscribed value, never a live `getState()` read inside the effect body).
2. Add `if (mode !== 'holdem') return;` as the FIRST line inside the effect body — matching how `pendingAnimationCount > 0` is already checked first, before the `runout` null-check (the file's own comment at lines 38-42 explains why gate checks come first: "checked FIRST... a settled-cache hit... is the branch most likely to be left ungated").
3. Add `mode` to the dependency array: `[runout, street, revealedMask, dealNonce, pendingAnimationCount, mode]`. This is the SAME "ignore-flag cleanup" mechanism already documented at lines 64-66 ("dependency array covers all four navigation triggers ... a narrow fix would still leave the identical stale-write race reachable") — `mode` becomes a fifth trigger. **This is what gives D-07's cancellation for free**: when `mode` flips away from `'holdem'` mid-run, React tears down the previous effect instance, firing the EXACT SAME cleanup already at lines 93-96 (`ignore = true; void cancelSimulation();`) — no new cancellation call site is needed, only a new dependency-array entry.
4. Wrap the existing JSX body (empty-hand-state / error banner / control-bar / table-row) in `mode === 'holdem' && (...)`, and render `<BlackjackScene />` in the `else` branch, alongside a `<GameModeSwitcher />` in the control bar that is visible in BOTH branches (D-01: "visible in both modes"). This is the "conditional render tree" option from CONTEXT's Claude's Discretion list — it satisfies D-04's DOM-isolation requirement (Hold'em testids literally absent from the tree) for free, since React unmounts everything under a falsy `&&` branch.

**Switch-away cancellation call site (D-07) — no new code, existing pattern already covers it:**
`src/state/simulationService.ts` lines 112-117:
```typescript
/** Drops the main-thread current request id and cancels the worker's in-flight run. */
export async function cancelSimulation(): Promise<void> {
  const requestId = currentRequestId;
  currentRequestId = -1;
  await api.cancel(requestId);
}
```
This is called from exactly one place today — the effect's own cleanup (line 95). Step 3 above is sufficient to route a mode switch through it; do not add a second, separate `cancelSimulation()` call inside `setMode()` or a click handler (that would create two competing cancellation call sites for the same generation, contradicting the file's own "one owner" discipline documented in `simulationService.ts`'s module-level comments).

**Gate-drain-to-zero on switch-away (D-07/D-08) — already-existing unmount-cleanup paths, no new code:**
`src/ui/useAnimationGate.ts` lines 38-56:
```typescript
useEffect(() => {
  if (!enabled) return;
  useUiStore.getState().beginAnimation();
  pendingRef.current = true;
  notify();

  return () => {
    // An interrupted or unmounted card can never strand the gate (D-10): release here if
    // `complete()` was never called for this registration.
    if (pendingRef.current) {
      pendingRef.current = false;
      useUiStore.getState().endAnimation();
      notify();
    }
  };
}, [animationKey, enabled, notify]);
```
and `src/ui/useAnimationGate.ts` lines 180-196 (`useExitGate`'s equivalent unmount cleanup). Because step 4 above unmounts the entire Hold'em JSX subtree (every `AnimatedCard`/`FlipCard` calling `useAnimationGate`/`useExitGate`) when `mode` flips away, React's unmount pass fires every one of these cleanups automatically — this is exactly what D-08 calls "the useAnimationGate/useExitGate unmount-cleanup paths already guarantee this." **No new gate-reset code should be written in `App.tsx` or `gameModeStore.ts`** — `useUiStore.getState().resetAnimations()` is explicitly commented as TEST-ONLY (`src/state/uiStore.ts` lines 17-29) and must never be called from production code; the isolation test's job (D-08) is to PROVE the existing unmount paths already bring the counter back to 0, not to add a new forced reset.

---

### `src/App.css` (modified)

**Analog — phase-tagged comment-block convention** (`src/App.css` lines 332-343, the "Phase 3 felt table scene" header):
```css
/* ---------------------------------------------------------------------------
 * Phase 3 felt table scene (03-02)
 *
 * The oval felt composition root, seat/community/deck absolute placement, and
 * the control-bar/scene-row shell. Positioned via `position: absolute` +
 * percentage offsets (RESEARCH Pattern 1) — never CSS Grid — anchored to
 * `.felt`'s own `position: relative` box. ...
 * ------------------------------------------------------------------------- */
```
Add an equivalent `/* Phase 5 game-mode switcher (05-NN) */` banner comment above any new rules, following the SAME format (rationale paragraph, cross-references to the locked decision numbers). New selectors should be `data-testid`-scoped (`[data-testid='mode-switch-holdem']`, etc.) to match the established selector convention (lines 168-172, 196-200, 226-234 all key off `[data-testid^='...']`), not a new bespoke class hierarchy — the one exception already in this file is `.control-bar`/`.felt`/`.card-slot*` (layout classes with no natural testid), which is the right precedent for `.blackjack-empty-state` if it needs a distinct class from `.empty-hand-state`.

---

### New isolation test file (D-06/D-08) — suggested `src/App.modeIsolation.test.tsx`

**Analog 1 — store-snapshot-equality style** (`src/state/gameStore.test.ts` lines 19-32, direct `getState()` assertions with no rendering needed for the pure-store half of D-06):
```typescript
describe('gameStore — predetermined runout and street pointer', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
    useUiStore.getState().resetAnimations();
  });

  it('starts with no runout, preflop street, no reveals, and dealNonce 0', () => {
    const state = useGameStore.getState();
    expect(state.runout).toBeNull();
    // ...
  });
});
```
D-06's "snapshot before switch === snapshot after switch-away-and-back" assertion should read `useGameStore.getState()` / `useOddsStore.getState()` / `usePickerStore.getState()` before and after a `setMode('blackjack')` → `setMode('holdem')` round trip and deep-equal them (`toEqual`), exactly like this file already reads whole-store snapshots via `getState()`. Also assert `useOddsStore.getState().settledCache.size` is UNCHANGED across the round trip (D-06's "no oddsStore cache key is written while in blackjack mode") — `settledCache` is a plain `Map`, inspectable via `.size`/`.has(knowledgeKey(...))` exactly as `src/state/oddsStore.ts` lines 14-25 define it.

**Analog 2 — App-level mock/reset boilerplate + mid-animation gate manipulation** (`src/App.test.tsx` lines 1-34 for the mock/reset harness, and lines 643-674 for the exact D-08 "mid-deal" shape):
```typescript
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

// ...

it('re-dealing while three animations are manually armed releases exactly those three without the counter ever going negative (D-10)', async () => {
  vi.mocked(simulationService.startSimulation).mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<App />);

  act(() => {
    useUiStore.getState().beginAnimation();
    useUiStore.getState().beginAnimation();
    useUiStore.getState().beginAnimation();
  });
  expect(useUiStore.getState().pendingAnimationCount).toBe(3);

  await user.click(screen.getByRole('button', { name: /^deal$/i }));
  expect(useUiStore.getState().pendingAnimationCount).toBe(3);
  // ...
});
```
For D-08's "switch-mid-deal" case: `render(<App />)`, click Deal, `act(() => useUiStore.getState().beginAnimation())` one or more times to simulate cards still in flight (this codebase's established way to hold the gate open under jsdom, since Motion doesn't run real animation frames there — see the comment at `src/App.test.tsx` lines 501-503), THEN click the Blackjack switcher button, and assert (a) `useUiStore.getState().pendingAnimationCount === 0` (the manually-armed units must still drain — but note: this test's manual `beginAnimation()` calls bypass `useAnimationGate`'s own unmount-cleanup ref-tracking, since they were never registered through a real card component; the isolation test should therefore drive the mid-flight state through an ACTUALLY-RENDERED `AnimatedCard`/`FlipCard` in the tree — e.g. hold the gate open long enough via `prefers-reduced-motion: no-preference` override or a manual `useAnimationGate` mount — rather than only `act(beginAnimation)`, or explicitly test both the "manually armed, generic counter" case AND a real card's unmount-cleanup path separately), (b) `cancelSimulation` was called, and (c) no Hold'em testid (`hero-hole`, `opponents`, `board-cards`, `table-scene`) remains in the DOM (D-04) while `blackjack-empty-state` is present.

**Analog 3 — guard-test naming/structure and D-NN-tagged assertions** (`src/App.acceptance.test.tsx` lines 1-19, 28-60 — the file-level rationale comment block and the `it.each`/pinned-string style):
```typescript
// DECK-01 source-shape guard (T-04-22, D-01, D-03): proves no value-based `Set<Card>`
// membership survives anywhere in the shoe path. ...
describe('DECK-01 shoe-path guard: no value-based Set<Card> dedup', () => {
  const noSetFiles = ['engine/shoe.ts', 'engine/conditioning.ts', 'state/pickerStore.ts', 'ui/CardPicker.tsx'];
  it.each(noSetFiles)('%s contains no Set<Card> and no new Set( occurrence', (relativePath) => {
    // ...
  });
});
```
This is the naming/structure precedent for a file whose entire purpose is a cross-cutting regression guard (like this phase's isolation test): a top-of-file rationale comment naming the exact D-numbers it protects, `describe` blocks titled `'<subject> — <invariant> (D-NN)'`, and — per D-09/D-10 — this new file should NOT touch `App.test.tsx`/`App.acceptance.test.tsx`/`App.phase3.acceptance.test.tsx` beyond the "mechanical adjustments" ceiling (e.g. adding the `GameModeSwitcher` control's presence to an existing `render()` call if a selector collides); the isolation assertions belong in this NEW sibling file, mirroring how `04-` guarded its own invariants in a new `shoePath.guard.test.ts`/`App.acceptance.test.tsx` rather than editing `simulationApi.test.ts` in place.

## Shared Patterns

### Curried Zustand store convention
**Source:** `src/state/uiStore.ts` line 32, `src/state/gameStore.ts` line 37, `src/state/pickerStore.ts` line 78 — all three use `create<State>()((set, get) => ({...}))`.
**Apply to:** `gameModeStore.ts`.
```typescript
export const useUiStore = create<UiState>()((set) => ({ /* ... */ }));
```

### Contractual lowercase-hyphen `data-testid` convention
**Source:** every existing testid in the codebase (`rewind-button`, `advance-button`, `street-label`, `set-up-scenario-button`, `opponent-seat-0`, `empty-hand-state`, `table-scene`, `odds-panel`, `card-picker`).
**Apply to:** `mode-switch-holdem`, `mode-switch-blackjack`, `blackjack-empty-state`, `blackjack-scene` (if `BlackjackScene` needs its own root testid distinct from `table-scene`, per D-04's requirement that no Hold'em testid appear — `table-scene` itself is not Hold'em-specific in name, but reusing it for both scenes could make DOM-isolation assertions ambiguous; recommend a distinct testid for the Blackjack root).

### D-NN-tagged inline comments explaining WHY, not just WHAT
**Source:** pervasive — e.g. `src/App.tsx` lines 38-42, `src/state/gameStore.ts` lines 43-47, `src/ui/useAnimationGate.ts` lines 48-49.
**Apply to:** every non-trivial line touched in `App.tsx`'s effect change and the new store/components — cite D-01 through D-10 by number, matching this codebase's existing citation density.

### Explicit `vi.mock` factory for `simulationService` in component tests
**Source:** `src/App.test.tsx` lines 19-22, `src/App.acceptance.test.tsx` lines 15-18.
```typescript
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));
```
**Apply to:** the new isolation test file and `GameModeSwitcher.test.tsx` if it renders `<App />` rather than the switcher standalone.

### Effect ignore-flag + cleanup-calls-cancelSimulation (the mechanism D-07 rides on for free)
**Source:** `src/App.tsx` lines 67, 93-96.
**Apply to:** `App.tsx`'s odds effect — add `mode` to the trigger set, do not add a parallel cancellation call site.

### Gate release via hook unmount cleanup, never a forced store reset
**Source:** `src/ui/useAnimationGate.ts` lines 47-55 and 180-196; `src/state/uiStore.ts` lines 17-29 (`resetAnimations` is TEST-ONLY, never called from production code).
**Apply to:** rely on unmounting the Hold'em subtree (App.tsx's conditional render) to drain the gate for D-07/D-08 — do not call `resetAnimations()` from `setMode()` or anywhere in production code.

### CSS phase-tagged comment blocks + testid-scoped selectors
**Source:** `src/App.css` lines 103-113, 332-343.
**Apply to:** any new `App.css` rules for the switcher/placeholder.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Non-accent "active/selected" visual treatment for `GameModeSwitcher` | component (styling) | n/a | The only existing conditional-active-class precedent (`.picker-slot-filled`) IS one of the three reserved accent uses (UI-SPEC, `src/App.css` lines 164-172) — there is no pre-existing non-accent "this control is the active one" CSS rule to copy. The planner must design a new (but token-only: `--border`/`--text-h`/font-weight) treatment, per D-01's fallback clause. |
| Blackjack gameplay itself (dealer/hit/stand logic, controls) | n/a | n/a | Out of scope — Phase 6 (D-03 explicitly: placeholder only, no dead/disabled gameplay controls). |
| A component-level "mode-scoped effect" abstraction (e.g. a `useModeGatedEffect` hook) | hook | n/a | Not needed this phase — CONTEXT's Claude's Discretion note and the existing single-effect shape in `App.tsx` are sufficient; inventing a generic hook here would be premature abstraction for a single call site (mirrors this codebase's own stated aversion to generalizing before a second consumer exists, per `ARCHITECTURE.md`'s recommended build order). |

## Metadata

**Analog search scope:** `src/` (all of `state/`, `ui/`, `engine/`, `worker/`, and root-level `App.tsx`/`App.css`/test files); `.planning/milestones/v1.0-phases/03-casino-table-ui-animation/03-UI-SPEC.md`; `.planning/phases/04-multiset-deck-streaming-foundation/04-REVIEW.md`.
**Files scanned:** `App.tsx`, `App.css`, `App.test.tsx`, `App.acceptance.test.tsx`, `state/uiStore.ts` (+test), `state/gameStore.ts` (+test), `state/oddsStore.ts`, `state/pickerStore.ts` (+test), `state/simulationService.ts` (+test), `ui/StreetControls.tsx`, `ui/DealButton.tsx`, `ui/TableScene.tsx`, `ui/CardPicker.tsx`, `ui/useAnimationGate.ts`, `ui/OddsPanel.tsx`, `engine/shoe.ts`, `engine/shoePath.guard.test.ts`, `index.css`.
**Pattern extraction date:** 2026-08-24

---
*Phase: 5-Game-Mode Shell & Store Separation*
*Patterns mapped: 2026-08-24*
