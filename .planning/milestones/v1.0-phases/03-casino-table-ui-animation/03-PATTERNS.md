# Phase 3: Casino Table UI & Animation - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 16 (10 new, 6 modified)
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/state/uiStore.ts` (new) — `pendingAnimationCount` | store | event-driven | `src/state/gameStore.ts` + `src/state/oddsStore.ts` | role-match |
| `src/ui/TableScene.tsx` (new) | component | transform (store-snapshot → layout) | `src/App.tsx` (composition section) | role-match |
| `src/ui/Seat.tsx` (new) | component | transform | `src/ui/HandDisplay.tsx` (opponent-seat loop) | exact |
| `src/ui/PlayingCard.tsx` (new) | component | transform (card code → asset URL) | `src/ui/CardPicker.tsx` (rank/suit → `Card` mapping) | role-match |
| `src/ui/CardBack.tsx` (new) | component | transform (static leaf) | `src/ui/DealButton.tsx` (structural shape only) | partial |
| `src/ui/OddsPanel.tsx` (new) | component | transform (wrapper) | `src/App.tsx` lines 105-108 (odds grouping) | exact |
| `src/ui/HandDisplay.tsx` (modified) | component | transform | itself (Phase 1-2 version, read below) | exact |
| `src/ui/BoardDisplay.tsx` (modified) | component | transform | itself (Phase 1-2 version, read below) | exact |
| `src/App.tsx` (modified — animation gate) | controller/root | request-response | itself (Phase 1-2 effect, read below) | exact |
| `src/test/setup.ts` (modified — `matchMedia` polyfill) | test config | — | itself (existing `<dialog>` polyfill) | exact |
| `index.html` (modified — title/favicon, D-14) | config | — | itself | exact |
| `package.json` (modified — add `motion`) | config | — | itself (existing `dependencies` block) | exact |
| `src/App.css` / new felt CSS | style | — | `src/App.css` Phase 2 conformance section | exact |
| `src/ui/*.test.tsx` (new component tests) | test | request-response | `src/ui/CardPicker.test.tsx` | exact |
| `src/state/uiStore.test.ts` (new store test) | test | event-driven | `src/state/gameStore.test.ts` | exact |
| `src/App.test.tsx` / `src/App.acceptance.test.tsx` (modified — gate assertions) | test | request-response | themselves (existing `vi.mock` factory) | exact |

`public/cards/*.svg` (vendored CC0 assets) and `public/cards/LICENSE` are static, non-code files — classified separately under Metadata, not given a role/data-flow row.

## Pattern Assignments

### `src/state/uiStore.ts` (store, event-driven) — NEW

**Analog:** `src/state/gameStore.ts` (curried store shape, action co-location) + `src/state/oddsStore.ts` (partial-merge/no-mutate convention)

**Curried store skeleton** (`src/state/gameStore.ts` lines 1-10, 36-40):
```typescript
import { create } from 'zustand';
...
export const useGameStore = create<GameState>()((set, get) => ({
  runout: null,
  street: 'preflop',
  revealedMask: 0,
  dealNonce: 0,
  deal: () => { ... },
```

**Simple counter-style action** (`src/state/gameStore.ts` lines 92-94 — `reveal`, a monotonic bit-set action, is the closest existing example of a small single-purpose mutator):
```typescript
reveal: (opponentIndex) => {
  set((state) => ({ revealedMask: state.revealedMask | (1 << opponentIndex) }));
},
```

**Reset-without-touching-other-fields convention** (`src/state/oddsStore.ts` lines 42-49, 85):
```typescript
function initialOddsFields(): Omit<OddsState, 'reset' | 'applySnapshot' | ...> {
  return { categoryCounts: new Array(CATEGORY_COUNT).fill(0), outcomes: { win: 0, tie: 0, lose: 0 }, trialsCompleted: 0, done: false };
}
...
reset: () => set(initialOddsFields()),
```

**Apply to `uiStore`:** a `pendingAnimationCount: number` field with `beginAnimation()` (increment) / `endAnimation()` (decrement, clamp at 0) actions, following the same curried `create<T>()()` shape and single-purpose-mutator style as `reveal`. Per RESEARCH Pattern 4/Anti-Patterns, this must be a counter (not boolean) and must NEVER be written per-animation-frame — only twice per animation (start/complete), exactly like `dealNonce`'s "increment once per deal" cadence in `gameStore.ts`.

**Store test pattern** (`src/state/gameStore.test.ts` lines 1-22):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
...
describe('gameStore — ...', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  });
  it('starts with ...', () => {
    const state = useGameStore.getState();
    expect(state.runout).toBeNull();
  });
```
Apply the same `setState(...)` reset in `beforeEach` + direct `getState()` assertions for `uiStore.test.ts`.

---

### `src/ui/TableScene.tsx` (component, transform) — NEW

**Analog:** `src/App.tsx` composition section (lines 75-110) — the existing pattern for assembling multiple store-driven display components into one screen region.

**Core composition pattern** (`src/App.tsx` lines 92-108):
```tsx
<DealButton />
<div className="phase2-section">
  <CardPicker />
</div>
<div className="phase2-section">
  <StreetControls />
</div>
<div className="phase2-section">
  <HandDisplay />
</div>
<div className="phase2-section">
  <BoardDisplay />
</div>
<div className="phase2-section">
  <WinTieLossDisplay />
  <OddsTable />
</div>
```
**Apply to `TableScene`:** it becomes the new felt-scoped composition root (`Seat` × 4 + community area + deck origin), replacing the flat `phase2-section` divs for the felt-related pieces; `App.tsx` then mounts `<TableScene />` plus a separate `<OddsPanel />` (D-05: odds MUST dock outside the felt). No store reads live in `TableScene` beyond what `HandDisplay`/`BoardDisplay`/`Seat` already read — it is purely a layout shell.

---

### `src/ui/Seat.tsx` (component, transform) — NEW

**Analog:** `src/ui/HandDisplay.tsx` opponent-seat loop (lines 21-54) — this IS one seat, already implemented; extracting it into its own component is a refactor, not new logic.

**Full existing pattern to extract** (`src/ui/HandDisplay.tsx` lines 21-54):
```tsx
<div data-testid="opponents">
  {Array.from({ length: OPPONENT_COUNT }, (_, i) => {
    const revealed = opponentHoles !== undefined && isOpponentRevealed(revealedMask, i);
    const hole = opponentHoles?.[i];

    if (revealed && hole) {
      return (
        <button
          key={i}
          type="button"
          data-testid={`opponent-seat-${i}`}
          disabled
          aria-label={`Opponent ${i + 1} hole cards: ${hole[0]} ${hole[1]} (revealed)`}
        >
          {hole[0]} {hole[1]}
        </button>
      );
    }

    return (
      <button
        key={i}
        type="button"
        data-testid={`opponent-seat-${i}`}
        disabled={opponentHoles === undefined}
        onClick={() => reveal(i)}
        aria-label={`Reveal Opponent ${i + 1} hole cards`}
        title="Click to reveal this opponent's hole cards"
      >
        Hidden
      </button>
    );
  })}
</div>
```
**Apply to `Seat`:** the `data-testid={`opponent-seat-${i}`}` contract, the `disabled`/`onClick={() => reveal(i)}`/`aria-label` triplet, and the reveal-vs-hidden branch MUST be preserved verbatim in whatever markup replaces the plain `<button>Hidden</button>` text with face-down `<CardBack />` art (D-02) — only the visual payload inside the button/seat changes, not the interaction contract. `HandDisplay.tsx` becomes the data-source wrapper that maps `OPPONENT_COUNT` seats + the hero seat into `<Seat />` instances, exactly mirroring its current `Array.from({ length: OPPONENT_COUNT }, ...)` shape.

---

### `src/ui/PlayingCard.tsx` (component, transform) — NEW

**Analog:** `src/ui/CardPicker.tsx` (rank/suit → `Card` construction using `@poker-apprentice/types`)

**Imports pattern** (`src/ui/CardPicker.tsx` lines 1-6):
```tsx
import { useRef, useState } from 'react';
import type { Card, Suit } from '@poker-apprentice/types';
import { ALL_RANKS, ALL_SUITS } from '@poker-apprentice/types';
```

**Suit/rank → card-code construction loop** (`src/ui/CardPicker.tsx` lines 77-96):
```tsx
{ALL_SUITS.map((suit) => (
  <div key={suit}>
    <h3>{SUIT_LABEL[suit]}</h3>
    {ALL_RANKS.map((rank) => {
      const card = `${rank}${suit}` as Card;
      ...
```
**Apply to `PlayingCard`:** RESEARCH.md's Code Examples section already provides the concrete `cardAssetPath()` + `SUIT_TO_ASSET`/`RANK_TO_ASSET` mapping tables using `getRank`/`getSuit` from `@poker-apprentice/types` — follow that exactly (RESEARCH Pitfall 5 flags the `'T'`→`"10"` and lowercase→uppercase suit transposition as the most likely bug source). `PlayingCard` is the ONLY component permitted to construct a `/cards/...` asset path (D-03) — `Seat`/`TableScene`/`HandDisplay`/`BoardDisplay` must call into it rather than hand-composing paths, matching how `CardPicker` is the only component that hand-composes `Card` codes today.

**Static asset reference convention** (new — no exact precedent in `src/`, but matches the existing `public/favicon.svg`, `public/icons.svg` pattern of referencing `public/` assets by absolute path):
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
Use the same `/cards/{SUIT}-{RANK}.svg` absolute-path convention via `<img src={...}>`, per RESEARCH Pitfall 4 (do NOT inline all 56 as React components).

---

### `src/ui/CardBack.tsx` (component, transform) — NEW

**Analog:** `src/ui/DealButton.tsx` (structural shape only — smallest existing presentational leaf component)
```tsx
export function DealButton() {
  const deal = useGameStore((state) => state.deal);
  return (
    <button type="button" onClick={deal}>
      Deal
    </button>
  );
}
```
**Match quality: partial.** No existing component in this codebase is a pure visual leaf with zero store reads — `DealButton` is the closest by *size/shape* (single-element function component, no children logic), not by *purpose*. `CardBack` should follow this file's minimalism (one function, one returned element, no local state) but reads no store at all; render either the vendored `back.svg` via `<img>` (same convention as `PlayingCard`) or a CSS-pattern `<div>`, per D-02/Open Question 1 in RESEARCH.md.

---

### `src/ui/OddsPanel.tsx` (component, transform) — NEW

**Analog:** `src/App.tsx` lines 105-108 — this grouping already exists and is being extracted verbatim.
```tsx
<div className="phase2-section">
  <WinTieLossDisplay />
  <OddsTable />
</div>
```
**Apply:** `OddsPanel` wraps exactly these two existing, unchanged components (per RESEARCH's Recommended Project Structure: "WinTieLossDisplay UNCHANGED", "OddsTable UNCHANGED"). D-05 requires this panel to sit outside the felt DOM subtree — `App.tsx` mounts `<TableScene />` and `<OddsPanel />` as siblings, not nested.

---

### `src/ui/HandDisplay.tsx` (component, transform) — MODIFIED IN PLACE

**Analog:** itself (current Phase 1-2 version, full file already read above)

**Contract to preserve exactly** (testids + interaction semantics, `src/ui/HandDisplay.tsx` lines 1-20):
```tsx
import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';
import { isOpponentRevealed } from '../engine/conditioning';

export function HandDisplay() {
  const heroHole = useGameStore((state) => state.runout?.heroHole);
  const opponentHoles = useGameStore((state) => state.runout?.opponentHoles);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const reveal = useGameStore((state) => state.reveal);

  return (
    <div>
      <div data-testid="hero-hole">
        {heroHole?.map((card) => <span key={card}>{card}</span>)}
      </div>
      <div data-testid="opponents">
        ...
```
**Apply:** keep every hook call and the `hero-hole`/`opponents`/`opponent-seat-{i}` testids; replace the `<span>{card}</span>` hero rendering with `<PlayingCard card={card} faceUp />` (deal-animated via `Seat`/`TableScene` wiring) and replace the opponent button internals per the `Seat` pattern above. This file becomes the seat-DATA-source (still owns `reveal`, `revealedMask`, `opponentHoles` reads) while `Seat`/`PlayingCard`/`CardBack` own the visuals.

---

### `src/ui/BoardDisplay.tsx` (component, transform) — MODIFIED IN PLACE

**Analog:** itself (current Phase 1-2 version, full file already read above)
```tsx
import { useGameStore } from '../state/gameStore';
import { STREET_BOARD_COUNT } from '../engine/streets';

export function BoardDisplay() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);

  const visibleBoard = runout ? runout.board.slice(0, STREET_BOARD_COUNT[street]) : [];

  return (
    <div>
      <h2>Board</h2>
      {visibleBoard.length === 0 ? (
        <div data-testid="board-empty-state">No community cards yet</div>
      ) : (
        <div data-testid="board-cards">
          {visibleBoard.map((card) => (
            <span key={card}>{card}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```
**Apply:** preserve `board-empty-state`/`board-cards` testids and the `STREET_BOARD_COUNT[street]`-driven slice logic (this is the single source of truth for "how many board cards are visible" — do not duplicate it in `TableScene`). Replace `<span key={card}>{card}</span>` with `<PlayingCard card={card} faceUp />`, and key each rendered card by `` `${card}-${dealNonce}` `` per RESEARCH's Anti-Patterns section (re-deal must fully remount, not retarget). The street-advance animation (only the NEWLY visible cards animate, per D-08) means this component must diff old vs. new `visibleBoard.length` — there is no existing precedent for that diff in this file; it is new logic layered onto the existing slice.

---

### `src/App.tsx` (controller/root, request-response) — MODIFIED (D-11/D-12 animation gate)

**Analog:** itself (current Phase 1-2 effect, full file already read above)

**Imports pattern** (`src/App.tsx` lines 1-13):
```tsx
import { useEffect, useState } from 'react';
import './App.css';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { startSimulation, cancelSimulation } from './state/simulationService';
import { deriveConditionedState } from './engine/conditioning';
```

**Both branches of the odds effect that must gate on `pendingAnimationCount`** (`src/App.tsx` lines 27-73):
```tsx
useEffect(() => {
  if (!runout) return;

  // Cache gate (D-10/D-12): consult the settled-odds cache BEFORE ever touching the worker.
  const cached = useOddsStore.getState().getCached(street, revealedMask);
  if (cached) {
    useOddsStore.getState().applySnapshot(cached);
    return;
  }

  let ignore = false;
  useOddsStore.getState().reset();

  const conditioned = deriveConditionedState(runout, street, revealedMask);
  void startSimulation(
    conditioned,
    (snapshot) => {
      if (ignore) return;
      setErrorMessage(null);
      useOddsStore.getState().applySnapshot(snapshot);
      useOddsStore.getState().cacheIfSettled(street, revealedMask, snapshot);
    },
    (message) => {
      console.error('[simulation]', message);
      if (!ignore) setErrorMessage(message);
    },
  );

  return () => {
    ignore = true;
    void cancelSimulation();
  };
}, [runout, street, revealedMask, dealNonce]);
```
**Apply exactly per RESEARCH Pattern 4 / Pitfall 1:** add `const pendingAnimationCount = useUiStore((s) => s.pendingAnimationCount);` and insert `if (pendingAnimationCount > 0) return;` as the FIRST line inside the effect body — before the cache lookup, not after it. Add `pendingAnimationCount` to the dependency array. This is the single highest-risk integration point in the whole phase (RESEARCH Pitfall 1: the cache-hit branch has no existing timing dependency and is the branch most likely to be left un-gated).

**Composition section to split into `TableScene` + `OddsPanel`** (`src/App.tsx` lines 75-110) — see `TableScene`/`OddsPanel` sections above.

---

### `src/test/setup.ts` (test config) — MODIFIED (add `matchMedia` polyfill)

**Analog:** itself — the existing `<dialog>` polyfill is the exact structural precedent (guard on `typeof X !== 'undefined'` because this file also loads for `@vitest-environment node` suites with no DOM globals).

**Full existing pattern** (`src/test/setup.ts`, entire file, 25 lines):
```ts
import '@testing-library/jest-dom/vitest';

// jsdom@30.0.1 (this project's pinned version) does not implement HTMLDialogElement.showModal()
// or .close() — calling either throws "not a function" at runtime. ...
if (typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
}
```
**Apply verbatim per RESEARCH's Code Examples section** — append the `window.matchMedia` polyfill guarded the same way:
```ts
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
This MUST land before any test renders a component using `useReducedMotion()`/`MotionConfig` (RESEARCH Pitfall 2, verified via direct `jsdom@30.0.1` instantiation — not speculative).

---

### `package.json` (config) — MODIFIED (add `motion` dependency)

**Analog:** itself — existing `dependencies` block is alphabetically ordered.
```json
"dependencies": {
  "@poker-apprentice/hand-evaluator": "^4.3.0",
  "comlink": "^4.4.2",
  "pure-rand": "^8.4.2",
  "react": "^19.2.8",
  "react-dom": "^19.2.8",
  "zustand": "^5.0.15"
}
```
**Apply:** insert `"motion": "^13.1.1"` between `"comlink"` and `"pure-rand"` to preserve alphabetical order; run `npm install motion` directly (RESEARCH: slopcheck's own install step failed in the sandboxed research environment — do not rely on it, run plain `npm install`).

---

### `index.html` (config) — MODIFIED (D-14 cosmetic debt)

**Analog:** itself, entire file (14 lines):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>scaffold-tmp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
**Apply:** change `<title>scaffold-tmp</title>` → `<title>Monte Carlo Poker Simulator</title>`. `public/favicon.svg` already exists and is already referenced — D-14's "simple favicon replaces the Vite default" may already be satisfied; verify its content is not still the literal Vite logo before treating this as done. Confirmed dead scaffold files to remove if unreferenced: `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png` (all three exist under `src/assets/`, none read/imported by any file examined in this pattern map — grep for imports of `assets/` before deleting, per D-14's "if nothing references them" condition).

---

### CSS (felt palette + layout) — `src/App.css` extension

**Analog:** `src/App.css` Phase 2 conformance section (lines 186-323) — the established convention of testid-scoped selectors + the `index.css` custom-property system.

**Custom-property tokens available** (`src/index.css` lines 1-17):
```css
:root {
  --text: #6b6375;
  --bg: #fff;
  --border: #e5e4e7;
  --accent: #aa3bff;
  --accent-bg: rgba(170, 59, 255, 0.1);
  --destructive: #b91c1c;
  ...
}
```

**Testid-scoped selector + comment-block convention** (`src/App.css` lines 243-258):
```css
/* Minimum 44x44px hit area (an accessibility touch-target floor, not a
 * visual design choice) on every interactive control introduced this phase,
 * achieved via padding rather than enlarging visible text. */
[data-testid^='picker-slot-'],
[data-testid^='picker-clear-'],
...
{
  min-width: 44px;
  min-height: 44px;
  padding: 8px 12px;
  font-family: inherit;
  font-weight: 400;
}
```
**Apply:** extend `:root` with felt-palette custom properties (e.g. `--felt-green`, `--felt-green-dark`) alongside the existing tokens rather than hardcoding hex values inline; continue the testid-scoped selector + explanatory-comment-block convention for new felt/seat/card selectors (`.felt`, `[data-testid^='opponent-seat-']`, etc.), and keep the 44px hit-area rule applying to any new/relocated interactive controls (Set Up Scenario trigger, relocated Rewind/Advance). Per RESEARCH Pattern 1, use `position: absolute` + percentage `top`/`left` for seat placement — do NOT use CSS Grid for the oval layout.

---

### Component tests for new UI (`src/ui/*.test.tsx`) — NEW

**Analog:** `src/ui/CardPicker.test.tsx` (lines 1-26)
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardPicker } from './CardPicker';
import { usePickerStore } from '../state/pickerStore';

describe('CardPicker', () => {
  beforeEach(() => {
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
  });

  it('renders a card-picker root preceded by an h2 "Card Picker" heading', () => {
    render(<CardPicker />);
    expect(screen.getByRole('heading', { level: 2, name: 'Card Picker' })).toBeInTheDocument();
    expect(screen.getByTestId('card-picker')).toBeInTheDocument();
  });
```
**Apply:** `PlayingCard.test.tsx`, `Seat.test.tsx`, `uiStore.test.ts` all follow this `render` + `screen.getByTestId` + direct store `setState` reset shape. For animation-completion assertions specifically, CONTEXT.md's Established Patterns note is load-bearing: **drive completion via the store flag/callback injection, not real timers** — e.g. call `useUiStore.getState().endAnimation()` directly in the test rather than waiting on a real Motion animation frame, combined with RESEARCH Pitfall 3's guidance to `await waitFor(...)` (already imported via `@testing-library/react` conventions used elsewhere) before asserting post-animation DOM state.

---

### `src/App.test.tsx` / `src/App.acceptance.test.tsx` (modified — animation-gate regression coverage)

**Analog:** themselves — the existing `vi.mock` factory + `resetStores()` pattern is the exact template for adding animation-gate coverage without touching the worker boundary.

**Explicit mock-factory pattern** (`src/App.test.tsx` lines 12-29):
```tsx
// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}
```
**Apply:** `resetStores()` gains a `useUiStore.setState({ pendingAnimationCount: 0 })` line (or the store's equivalent reset action). New tests assert `startSimulation` is NOT called while `pendingAnimationCount > 0` (set it directly via `useUiStore.getState().beginAnimation()` before a street-advance click, then assert zero new calls; call `endAnimation()` and assert the call fires) — this directly operationalizes RESEARCH Pitfall 1's warning sign ("a test that rewinds through several already-visited streets in quick succession and asserts odds never flash a wrong value before settling").

---

## Shared Patterns

### Zustand curried store shape
**Source:** `src/state/gameStore.ts` lines 36-40, `src/state/oddsStore.ts` lines 79-85
**Apply to:** `uiStore.ts` (new)
```typescript
export const useGameStore = create<GameState>()((set, get) => ({
  // ...fields
  someAction: () => set({ ... }),
}));
```

### Testid contract preservation
**Source:** `.planning/phases/03-casino-table-ui-animation/03-CONTEXT.md` D-05 — full list: `hero-hole`, `opponents`, `opponent-seat-{i}`, `board-cards`, `trial-counter`, `win-pct`, `tie-pct`, `lose-pct`, `category-table`, `category-pct-{n}`, `street-label`, `empty-hand-state`, `simulation-error`
**Apply to:** `HandDisplay.tsx`, `BoardDisplay.tsx`, `Seat.tsx`, `OddsPanel.tsx`, `App.tsx`, `StreetControls.tsx` (unchanged) — every re-skinned component must keep emitting these exact `data-testid` values on the same logical elements (button vs. span vs. div may change, the testid string and its target semantics may not).

### Explicit `vi.mock` factory for `simulationService`
**Source:** `src/App.test.tsx` lines 12-21, `src/App.acceptance.test.tsx` lines 12-18 (identical in both files)
**Apply to:** any new/modified test file that renders `<App />` or a component tree reaching the worker boundary — never bare-automock `simulationService`.

### `@vitest-environment node` isolation for non-DOM suites
**Source:** comment in `src/test/setup.ts` lines 10-12 referencing `src/engine/*.test.ts` and `src/worker/simulationApi.test.ts`
**Apply to:** any new `matchMedia`/DOM-dependent polyfill added to `src/test/setup.ts` — guard with `typeof window !== 'undefined'` exactly like the existing `HTMLDialogElement` guard, since engine/worker test suites still run this same setup file with zero DOM globals.

### CSS custom-property token system (no second styling system)
**Source:** `src/index.css` lines 1-32 (`--bg`, `--text`, `--border`, `--accent`, `--accent-bg`, `--destructive`), `src/App.css` lines 186-323 (testid-scoped selectors, spacing/hit-area rules)
**Apply to:** all new felt/seat/card CSS — extend `:root` with new felt-specific tokens (e.g. `--felt-green`) rather than hardcoding colors, and keep using `[data-testid='...']`/`[data-testid^='...']` selectors rather than introducing class-based BEM or CSS Modules.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ui/CardBack.tsx` | component | transform | No existing component in `src/` is a pure visual leaf with zero store reads — `DealButton.tsx` is the closest by shape/size only (see Pattern Assignments above for the partial match and rationale). |
| Motion animation-completion test helper (e.g. a `nextFrame()`/`await waitFor` wrapper) | test utility | — | Motion is not yet installed in this codebase (confirmed absent from `package.json`); RESEARCH.md's Pitfall 3 and Code Examples sections are the only available guidance (motion.dev docs, not an in-repo precedent) — planner should follow RESEARCH's `await waitFor(...)` recommendation and CONTEXT.md's "drive completion via store flag / callback injection, not timers" guidance rather than a fabricated in-repo pattern. |

## Metadata

**Analog search scope:** `src/App.tsx`, `src/App.test.tsx`, `src/App.acceptance.test.tsx`, `src/state/*.ts(.test)`, `src/ui/*.tsx(.test)`, `src/test/setup.ts`, `src/engine/cards.ts`, `src/App.css`, `src/index.css`, `index.html`, `package.json`, `public/*`, `src/assets/*`
**Files scanned:** 24 source/test files + 3 config files + 2 CSS files + directory listings for `src/assets/` and `public/`
**Pattern extraction date:** 2026-08-24
**Non-code additions (no pattern applicable):** `public/cards/*.svg` (vendored CC0 assets, ~572 KB total per RESEARCH.md) and `public/cards/LICENSE` — these are downloaded/committed static files, not authored code; RESEARCH.md's Standard Stack → Card Art section is the authoritative source for exactly which files to vendor and from where (`letele/playing-cards`, CC0-1.0).
