# Control-bar reorganization — group the simulator's controls by purpose

**User's words:** "the controls for running the simulator are haphazard, please reorganize the UI."

## The problem

Hold'em's control bar is one flat, undifferentiated flex row of five unrelated things:

```
[Hold'em|Blackjack] [Deal] [Set Up Scenario] [Rewind|Pre-Flop|Advance] [1 deck|2 decks]
```

…with a stray visible `<h2>Street</h2>` floating above the transport (rendered inside
`StreetControls`). Nothing groups by purpose, so *choosing a game*, *starting a hand*, and
*stepping through streets* all look like the same kind of action. Blackjack's bar has the same
shape (`[switcher] [Deal] [Hit] [Stand] [1 deck|2 decks]`).

## The reorganization

Group by what a control **does**. Two rows, in both games.

**Row 1 — session/context** (`.control-bar__row--session`, `justify-content: space-between`).
`GameModeSwitcher` left, `DeckCountToggle` pushed right. Both answer "what am I playing", and
both persist across hands.

**Row 2 — the hand** (`.control-bar__row--hand`).
A `.control-group--hand-actions` cluster (Hold'em: Deal + Set Up Scenario; Blackjack: Deal +
Hit + Stand), then — Hold'em only — a decorative CSS separator, then the street transport
group (`Rewind` · street label · `Advance`). All "act on the current hand".

### Target DOM

Hold'em:

```html
<div class="control-bar">
  <div class="control-bar__row control-bar__row--session">
    <div data-testid="game-mode-switcher" role="group" aria-label="Game mode">…</div>
    <div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count">…</div>
  </div>
  <div class="control-bar__row control-bar__row--hand">
    <div class="control-group control-group--hand-actions">
      <button type="button">Deal</button>
      <button type="button" data-testid="set-up-scenario-button" …>Set Up Scenario</button>
    </div>
    <div class="control-group control-group--street" role="group"
         aria-labelledby="street-controls-heading">
      <h2 id="street-controls-heading" class="visually-hidden">Street</h2>
      <button type="button" data-testid="rewind-button">Rewind</button>
      <span data-testid="street-label">Pre-Flop</span>
      <button type="button" data-testid="advance-button">Advance</button>
    </div>
  </div>
</div>
```

Blackjack: identical row 1 (with the blackjack prefix); row 2 holds one
`.control-group--hand-actions` with Deal / Hit / Stand and therefore draws no separator — the
separator rule is `.control-group + .control-group`, so it is self-limiting.

### Ownership move (Blackjack)

Row 1 must hold the switcher **and** the deck toggle, but the switcher is rendered by
`BlackjackGame.tsx` while the deck-toggle wire is pinned to `BlackjackControls.tsx` (Phase 8
SC1: that file must import *and* render `<DeckCountToggle`, and must keep the literal
`blackjack-deck-toggle` prefix). Portals aside, the only way to put both in one row is for
`BlackjackControls` to render both rows. So `BlackjackControls` becomes "the blackjack control
bar" and imports `GameModeSwitcher`; `BlackjackGame`'s bar collapses to
`<div className="control-bar"><BlackjackControls /></div>`.

This is safe against every pin on that file: the D-05 sweep forbids the tokens `gameStore` /
`oddsStore` / `pickerStore` / `uiStore`, and `GameModeSwitcher` contains none of them. The
component still reads only `useBlackjackStore`.

## Constraints this must not break

| Constraint | Where it lives | How it is honoured |
|---|---|---|
| No `role="group"` in `HoldemGame.tsx` / `BlackjackControls.tsx`, any quoting style | `App.modeShell.guard.test.ts` SC1 | The only new `role="group"` goes in `StreetControls.tsx`, which is not in that pin's file list. Row/group wrappers elsewhere are plain divs with classes — an unnamed `group` role adds nothing anyway. |
| No new `aria-label="Deck count"` / the bare literal `Deck count` at either call site | same | Not added anywhere. |
| Every contractual `data-testid` keeps its exact name and element type | `holdemTestids.ts`, `blackjackTestids.ts`, both DOM-absence sweeps | Zero testids added, removed, renamed, or moved to a different tag. |
| Nine-state deck-toggle DOM golden | `App.deckToggleDom.golden.test.tsx` | It serializes the toggle's own `outerHTML` only — nesting it deeper is invisible to it. |
| Five frozen v1 suites + three golden files | — | Untouched. |
| Type scale: 4 sizes / 2 weights; accent budget = 2 rules | `depthTypography.guard.test.ts` | New CSS declares no `font-size`, one `font-weight: 400` (already in the set), and no `--accent`. |
| 44px hit-area floor + `--elev-raised` / `--elev-rest` on every bar button | `App.css` `.control-bar > button` | Retargeted — see below. |
| `prefers-reduced-motion` | — | Nothing new animates. |

### The `.control-bar > button` retarget (the real hazard)

Three rules key on the **direct child** selector `.control-bar > button`: hit-area, raised
elevation, and disabled-flat elevation. Nesting buttons inside rows/groups orphans all three.

A naive widening to the descendant selector `.control-bar button` is **wrong**: it would also
reach the segmented controls' segments, whose own rule sets `padding: 8px 16px`. At (0,1,1) vs
the segments' (0,1,0) the widened rule would win and silently reflow both segmented controls,
and it would additionally hang `--elev-raised` on each *segment* when the shipped design raises
the segmented *wrapper*.

Correct retarget — re-anchor on the new structural parents:

```css
.control-bar__row > button,
.control-bar__row .control-group > button { … }
```

A segment is a child of the segmented **wrapper** div (`[data-testid='holdem-deck-toggle']`),
which is neither a row nor a group, so segments provably do not match. Rewind/Advance now match
this rule as well as their own testid-scoped one — the declarations are byte-identical
(`min-width/min-height/padding/font-family/font-weight`), so nothing moves.

### Street-label spacing

`[data-testid='street-label'] { margin-inline: 8px; }` exists because the transport used to be a
plain block with inline children. The transport is now a flex `.control-group` with `gap: 8px`;
keeping both would double the label's gutters to 16px. The margin rule is retired and the flex
`gap` becomes the single mechanism — the shipped 8px rhythm is preserved exactly.

## Pins retargeted (never deleted, always with a comment)

1. **`App.holdemDeckToggle.test.tsx`** — "the toggle is the LAST control-bar child (Phase 8
   UI-SPEC A2)". Obsolete *by intent*: the user asked for the reorganization, and A2's substance
   ("the deck toggle sits at the end of the context cluster") now reads as "last child of the
   session row". Retargeted to `.control-bar__row--session`'s `lastElementChild`, with a comment
   recording why.

No other pin needs retargeting. (Checked: `App.deckToggleConsolidation.test.tsx` asserts the
toggle's *semantics*, never its position; `depthTypography.guard.test.ts` pins no `.control-bar`
rule.)

## Tasks

1. `docs(quick)` — this plan.
2. `refactor(ui)` — `StreetControls`: `.control-group control-group--street`, `role="group"` +
   `aria-labelledby`, and the `<h2>` becomes `.visually-hidden` (present in the a11y tree, not
   deleted).
3. `refactor(ui)` — `HoldemGame`: two purpose-grouped rows.
4. `refactor(ui)` — `BlackjackControls` + `BlackjackGame`: the same two rows.
5. `style(ui)` — `App.css`: `.control-bar` becomes a column of rows; `.control-bar__row`,
   `.control-group`, the decorative separator; the three `.control-bar > button` retargets; the
   street-label margin retirement.
6. `test(ui)` — retarget the A2 placement pin.
7. `test(ui)` — new `App.controlBarGrouping.test.tsx`: rows exist and are ordered; each control
   sits in the right group in both games; the `Street` h2 is present-but-hidden and names its
   group; no separator element, no separator glyph, nothing extra focusable; and — reading the
   real selector lists out of `App.css` and running `Element.matches()` against the live DOM —
   every bar button still matches the hit-area and elevation rules while no segment and no
   picker button does.

## Gates

`npx vitest run` (1078 + additions, zero failures) · `npx tsc -b` (the real typecheck gate;
`--noEmit` is vacuous in this project layout) · `npx eslint .` · `npm run build`.
