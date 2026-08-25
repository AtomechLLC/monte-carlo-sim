# Quick Plan — Felt & Brass steps (iv) DEPTH and (v) TYPOGRAPHY

**Branch:** `main` (direct, no worktree)
**Baseline:** `2302bf0`, 70 files / 1017 tests green
**Typecheck gate:** `npx tsc -b` (NOT `--noEmit` — vacuous under this solution-style tsconfig)

## Objective

Two passes that finish the "Felt & Brass" direction:

**(iv) Depth** — the table stops being a flat green ellipse with cards printed on it and
becomes a lit object in a room. One documented three-level elevation scale replaces every
ad-hoc shadow; the felt gets an overhead lamp, a rim it falls into, and a rail with a
varnish highlight; a card in flight is genuinely *in the air* and settles when it lands.

**(v) Typography** — two self-hosted families (no CDN; the app must work offline). A Didone
(Bodoni Moda) carries the display role only, and IBM Plex Sans carries everything else. The
h1 becomes a wordmark. The 4-size/2-weight discipline is made *provable*, not merely stated.

## Design decisions

1. **Three elevation levels, and only three.** An object on this table is either lying on it
   (rest), lifted off it (raised), or in the air between two places (in-flight). There is no
   fourth thing a shadow means here, so there is no fourth token. Each level is a TWO-part
   shadow — a tight contact shadow saying where the object touches, and a long soft cast
   shadow saying how far it is from what it sits on. Raising an object lengthens and softens
   the cast shadow while the contact shadow barely moves: that ratio *is* the perception of
   height, and a single blurred blob never reads as one.

2. **Depth spends no accent.** Pure black at partial alpha throughout — depth is the absence
   of the overhead lamp, not a colour. The brass budget stays exactly the three reserved
   Hold'em uses (street label, filled picker slot, enabled Advance).

3. **`--shadow` is retired.** The Vite scaffold's one-off drop shadow lost its last consumer
   in the Phase 2 cleanup. The elevation scale is what a shadow in this app now means.

4. **The lamp hangs above the top of the table.** A single warm radial highlight centred just
   off the top edge, over the *unchanged* `--felt`/`--felt-dark` radial. Felt geometry and
   both felt values are untouched — this is lighting and framing, not a re-layout. The
   highlight raises the luminance behind the opponent-1 seat badge, so that badge's contrast
   is re-measured (below) rather than assumed.

5. **The rail is drawn, not just filled.** The shipped flat `inset 0 0 0 12px var(--felt-rail)`
   ring stays the rail body (same token, 14px so the varnish reads), but gains a light band
   along the upper rim and a shade along the lower one — painted BEFORE the ring in the
   box-shadow list, because a box-shadow list paints first-on-top. Below the rail the felt
   falls into an inset vignette, and the whole table casts onto the room.

6. **The lift is CSS-only and rides an existing hook.** `.card-in-flight` already exists
   (AnimatedCard applies it while `useAnimationGate` reports `pending`). The elevation is
   attached to the `.playing-card` INSIDE that wrapper — the card element is the thing with
   the 6px radius, so the shadow follows the card's corners rather than the wrapper's square
   box. A `transition: box-shadow` on `.playing-card` gives the settle for free when the
   class is removed. Zero TSX, zero timing, zero gate logic touched.

7. **Reduced motion removes the settle, never the state.** A lifted card is still drawn
   lifted; it just arrives at its shadow instantly. (In practice the reduced-motion path
   never applies `.card-in-flight` at all — the opt-out is for the hover lift and for
   correctness of the rule, not theatre.)

8. **Latin subsets only, verified against `node_modules`.** `@fontsource/ibm-plex-sans` ships
   `latin-400.css` / `latin-600.css` — imported as-is. `@fontsource-variable/bodoni-moda@5.3.0`
   ships NO `latin.css`: its entry points (`wght.css`, `standard.css`, `opsz.css`) each pull
   four subsets (math + symbols + latin-ext + latin = 75.6 kB of woff2) where only latin is
   ever downloaded. So Bodoni gets a hand-rolled single `@font-face` in `src/fonts.css`
   pointing at the one latin variable file (25.9 kB), copying upstream's own `unicode-range`
   and `font-display` verbatim. Deviation from the brief's suggested filename, in service of
   the brief's stated reason ("so the bundle stays small").

9. **Bodoni is a display face and is fenced as one.** `--display` reaches exactly `h1` and
   `h2`; `h2` renders at 20px everywhere, which is the stated floor. The dead
   `font-size: 24px` on index.css's `h2` (App.css has overridden it to 20px since Phase 2) is
   set to 20px and its now-redundant media override dropped — so the document scale is
   literally {32, 20, 16, 14} at source level and a guard can *prove* it instead of asserting
   it in prose.

10. **The wordmark is tracking, not decoration.** Bodoni at the shipped 32/600, opened up with
    `letter-spacing: 0.07em` and re-centred with a matching `text-indent` (tracking adds a
    trailing space that centring otherwise counts). Text content byte-identical. No accent
    colour — the wordmark is not one of the three reserved brass uses.

## Tasks

- **T1** — `src/index.css`: the three elevation tokens (`--elev-rest`, `--elev-raised`,
  `--elev-in-flight`) + `--elev-settle` duration, replacing the retired `--shadow`.
  `commit: feat(ui)`
- **T2** — `src/App.css`: apply the scale. `.playing-card` → rest (replacing the hardcoded
  `0 2px 6px rgba(0,0,0,0.35)`); `.card-in-flight .playing-card` → in-flight; hovered/focused
  clickable seats → raised; odds panels, picker dialog, segmented controls and the actionable
  control buttons → raised; disabled controls drop to rest; `.bj-ev-tile` → rest. Plus the
  reduced-motion opt-out. `commit: feat(ui)`
- **T3** — `src/App.css`: the felt — overhead lamp, rim vignette, drawn rail, room cast
  shadow. `commit: feat(ui)`
- **T4** — `npm install @fontsource-variable/bodoni-moda@5 @fontsource/ibm-plex-sans@5`,
  `src/fonts.css`, imports in `src/main.tsx`. `commit: feat(ui)`
- **T5** — `src/index.css`: `--display`/`--sans` stacks (retiring `--heading`), the h1
  wordmark, h2 retuned tracking + the 20px normalisation. `commit: feat(ui)`
- **T6** — `src/ui/depthTypography.guard.test.ts`: token presence, the in-flight elevation,
  the transition shape, the reduced-motion block, the felt's lighting layers, the font stacks,
  the latin-only imports, and the 4-size/2-weight sweep. `commit: test(ui)`

## Constraints honoured

- No frozen v1 suite, golden file, or exact-copy test touched.
- Every contractual `data-testid` keeps its name; no DOM restructuring; no new class names.
- No TSX edited except `src/main.tsx` (font imports only).
- Animation gate, TBL-04, Motion choreography, all durations: untouched.
- Accent budget unchanged; depth uses shadow/tint only.
- The `shareBars` and `modeShell` CSS source-pins are extended-or-untouched, never weakened.

## Verification

`npx vitest run` (1017 + additions, zero failures) · `npx tsc -b` · `npx eslint .` ·
`npm run build`, with the dist woff2 total confirmed under 300 kB.
