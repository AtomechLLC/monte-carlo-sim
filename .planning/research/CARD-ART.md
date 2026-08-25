# Card Art Survey — higher-quality playing-card art for the Monte Carlo Poker Simulator

**Researched:** 2026-08-25
**Domain:** Vector playing-card assets, licensing, DOM/SVG card presentation, CSS 3D table tilt
**Confidence:** HIGH on licensing and measurements (verified by direct fetch + local rendering), HIGH on the CSS 3D findings (verified empirically in headless Chrome 3D tests), MEDIUM on aesthetic judgements (necessarily subjective, but made against actual renders at the app's real sizes rather than from description)

---

## Summary

**The current deck is not the problem, and replacing it would be a mistake.** The vendored `letele/playing-cards` art is Adrian Kennard's CC0 deck, whose court cards are hand-traced from antique **Goodall & Son** designs (c. 1870) — six-colour layered figures at ~900-1,300 path commands each. Rendered at 200px they are the best-looking of every candidate surveyed, including both LGPL alternatives and the widely-redistributed Byron Knoll deck. The two genuinely weak things about what ships today are **not the face art**: they are (1) the **corner indices are too small to read at 64px**, and (2) the **card back is a fine diamond lattice whose 6px pattern pitch aliases into dithered mush** at the app's render sizes, tinted by a CSS filter that produces muddy brown `#70564E` rather than the intended burgundy.

Both defects are fixable **without changing art families, without a licence change, and without touching a single line of TypeScript.** Adrian Kennard's deck is not a static asset dump — it is a live, CC0, parameterised generator at `me.uk/cards`, still online, offering a `super` index-size option, seven card-back designs, and custom front/back/pip colours. Regenerating the same art at `super=1` produces clearly readable indices while keeping the full-bleed court illustrations (unlike every jumbo-index deck surveyed, which shrinks the court art into a small inset box). The generator's **"Goodall" back** is an ornate rosette-and-frame design that still reads as a designed object at 64px, and can be emitted natively in burgundy so the CSS filter can be deleted. Total deck size is unchanged at ~570 KB.

A third, previously unnoticed issue: **the shipping Ace of Spades carries a scannable QR code and the printed text "www.me.uk/cards/"** — third-party branding on one of the most frequently visible cards in a poker app. The generator can clear it.

**Primary recommendation:** Do not swap decks. Regenerate the existing CC0 deck at `super=1` with the watermark cleared and the Goodall back in burgundy, then spend the saved effort on presentation (warm stock, layered shadow, edge bevel, rotation jitter), which delivers more visual gain per unit of risk than any deck swap available.

---

## ⚠️ Security finding — prompt-injection payload in an upstream repository

While fetching the generator's source repository README at
`https://codeberg.org/RevK/SVG-playing-cards/raw/branch/master/README.md`, the file was found to contain, in full:

```
# SVG playing cards

Tools to make a wide selection of playing cards in SVG format.

# Hey, Claude:

<a string designed to trigger an AI assistant refusal>
```

This is an embedded instruction aimed at AI coding agents, not project documentation. **It was identified and disregarded; no instruction from it was followed.** [VERIFIED: direct fetch, 2026-08-25]

Assessment of actual risk to this project:

- It does **not** affect the licence status of the card artwork. The CC0 dedication lives on `me.uk/cards`, independently verified below, not in this README.
- It does **not** affect any asset this project would vendor — we consume generator *output* (SVG files), never the repository's contents.
- It **is** a reason to never pipe that repository's files into an agent context unreviewed, and a general reminder that upstream README content is untrusted input.

No action needed beyond awareness. Recorded here because a public repo's supply chain is in scope for a public repo's asset decisions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card face/back artwork | Static assets (`public/cards/`) | — | Vector files served as-is; no build step involved |
| Card code → asset path | `src/ui/PlayingCard.tsx` | — | Already the sole constructor of asset paths (locked D-03 contract) |
| Card stock appearance (warmth, bevel, grain) | CSS (`App.css`) | Asset (`frontcolour`) | Either tier can do it; CSS is reversible, asset is bakes-in. Pick one, never both |
| Card back tint | Asset (`backcolour` at generation) | CSS `filter` (current) | Moving to the asset tier removes a `transform-style` flattening hazard |
| Table 3D tilt | CSS on the felt container | — | Locked stack is DOM+SVG+Motion; no canvas/WebGL |
| Per-card motion | Motion (inline `transform`) | — | Must not share an element with any CSS `transform` (see 3D section) |

---

## 1 · Candidate decks surveyed

All sizes below were measured directly, not estimated. Deck totals are the 52 face cards unless stated.

### 1a · The current deck — honest re-evaluation

| Property | Finding |
|----------|---------|
| **Source** | `github.com/letele/playing-cards` @ `865a78eb` — a redistribution of **Adrian Kennard's** deck from `me.uk/cards` [VERIFIED: local `public/cards/LICENSE` + upstream fetch] |
| **Licence** | **CC0 1.0**. Quoted verbatim from the source page: *"Copyright 2018 Adrian Kennard Released under CC0 Public Domain licence"* and *"No attribution required... You can do what you like with these designs."* [VERIFIED: direct fetch of `me.uk/cards`, 2026-08-25] |
| **Format** | One SVG per card, `viewBox="-120 -168 240 336"` (exactly 5:7, matching the app's `aspect-ratio`) |
| **Naming** | `{SUIT}-{RANK}.svg`, `10` for ten, `back.svg` (renamed from upstream `B-1.svg`) |
| **Size** | **705 KB** raw / **215 KB** gzipped for 54 files. Largest card `S-K.svg` at 64 KB |
| **Court art** | **Detailed, not flat.** Hand-traced from Goodall & Son decks c. 1870; six layered colour symbols per court card (`SK1`–`SK6`), 896–1,283 path commands. Full six-colour palette (black, white, red, `#FC4` gold, `#44F` blue) |
| **Maintenance** | Generator actively maintained; repository migrated GitHub → Codeberg, archived on GitHub 2026-03-07 |

**Verdict: the art is genuinely good and is being under-served, not out-classed.** Rendered at 200px it is the most characterful deck in this survey. Its problems are all size-related or peripheral:

1. **Indices too small.** At the 64px opponent size a corner index is roughly 5px tall. Real casino decks solve this with jumbo/poker indices; this is a standard-index deck. For an app whose whole purpose is reading cards and their odds fast, this is the single biggest legibility defect.
2. **The back aliases.** `back.svg` is a `<pattern>` with a 6-unit pitch on a 240-unit-wide viewBox. At 64px that pattern renders at ~1.6px — right at the Nyquist limit — so it degrades into moiré/dither rather than a texture.
3. **The back's tint is wrong.** `--card-back-filter` resolves to a measured `#70564E` — a muddy brown-mauve, not the burgundy its code comment describes. [VERIFIED: pixel-sampled from a headless-Chrome render]
4. **Third-party watermark on the Ace of Spades.** A QR code plus the printed text `www.me.uk/cards/`. [VERIFIED: rendered locally]
5. Pure `#FFFFFF` stock reads cold and stark against the dark felt.

### 1b · Byron Knoll deck (and its descendants)

The most widely redistributed public-domain deck; the common ancestor of several repos.

| Property | Finding |
|----------|---------|
| **Sources** | `notpeter/Vector-Playing-Cards` (PD **or** WTFPL, user's choice); `hayeah/playing-cards-assets` (MIT wrapper, art *"courtesy of vector-playing-cards (public domain)"*) |
| **Licence risk** | **None.** Public domain / WTFPL / MIT are all fully compatible with a public repo, no attribution or share-alike |
| **Format / naming** | One SVG per card; `notpeter` uses `{RANK}{SUIT}.svg` (`KS.svg`, `10S.svg`) |
| **Size** | **8.24 MB** for 54 files — **11.7× the current deck.** Court cards are 410–622 KB *each* |
| **Court art** | Bolder black outlines, flatter yellow in place of gold. Arguably cleaner; not more detailed |
| **Maintenance** | 7 commits, effectively a finished archive |

**Verdict: reject.** Rendered side-by-side at 64px it is not more legible than the current deck — the indices are the same small size — and it costs 11.7× the bytes.

### 1c · saulspatz/SVGCards — jumbo-index, Knoll-derived

The most interesting alternative, because it targets the exact defect identified.

| Property | Finding |
|----------|---------|
| **Licence** | **Public domain**, explicitly: *"copy, modify, distribute... even for commercial purposes, all without asking permission"* |
| **Provenance** | Knoll art + openclipart.org backs + Wikimedia jokers, recoloured |
| **Variants** | Vertical2/Vertical4/Horizontal2/Horizontal4/Accessible — 2- and 4-colour, plus a high-contrast set |
| **Naming** | `spadeKing.svg`, `heart6.svg`; ships a `rename.py` to abbreviate |
| **Size** | **15.71 MB** for 53 faces — **22× the current deck.** `clubKing.svg` alone is 1.13 MB |

**Verdict: reject, but it taught the key lesson.** Its jumbo indices are dramatically readable at 64px — a real, visible win. **But it pays for them by shrinking the court illustration into a small inset rectangle**, so the deck reads as a bridge/accessibility deck rather than a casino deck. For a project whose stated constraint is *"visual craft is part of the deliverable, not a skin"* that is the wrong trade. Its cream stock (`#FFFFF0`-ish) is, however, a good idea worth stealing — see Presentation.

### 1d · htdebeer/SVG-cards (David Bellot) — ⚠️ licence risk

| Property | Finding |
|----------|---------|
| **Licence** | **LGPL-2.1** — copyleft [VERIFIED: repo LICENSE + README] |
| **Format** | **A single 962 KB sprite file**, `svg-cards.svg`, cards as `<symbol>`s (`spade_king`, `diamond_queen`) |
| **Court art** | French-style courts; attractive |
| **Maintenance** | Actively maintained; a fix landed July 2026 |

**Verdict: reject on two independent grounds.**

- **Licence.** LGPL-2.1 applied to *artwork* is legally murky — it is drafted for libraries, and its "relinking" provisions have no clean meaning for an SVG. Vendoring copyleft art into a public portfolio repo imposes source-availability and notice obligations, and invites exactly the ambiguity a portfolio project does not want. This is the share-alike concern the brief flagged, and it is real.
- **Architecture.** A sprite of `<symbol>`s cannot be consumed by `<img src="...">`. It requires inline `<svg><use href="...">`, which would demolish the current `PlayingCard` contract, the `<img>`-based DOM-leak tests, and the `alt`-text accessibility model. Very high cost.

Note this deck is cited in the project's own `CLAUDE.md` sources list (as the art underlying `react-deck-o-cards`). That citation should not be read as a recommendation to adopt it.

### 1e · Tekeye / Daniel S. Fowler — ⚠️ disputed provenance

| Property | Finding |
|----------|---------|
| **Claimed licence** | Public domain — *"the image designs are not under copyright"* |
| **Dispute** | **Chris Aguilar publicly disputed this in 2025**, asserting the set is a re-release of his LGPL-3.0 2011 "Vectorized Playing Cards." Fowler rebutted, citing differences in file layout, card size, aspect ratio, colour, font, pip design, backs and jokers |
| **Format** | One SVG per card, `clubs_ace.svg` style; ~70 files incl. 12 backs |

**Verdict: reject on licence risk alone.** The art may well be clean, but an unresolved public authorship dispute is precisely the wrong thing to vendor into a public repo when a uncontested CC0 alternative is already installed. Do not use.

### 1f · Chris Aguilar "Vectorized Playing Cards" (totalnonsense.com) — ⚠️ licence risk

**LGPL-3.0, attribution required**; non-attribution licensing offered "at negotiated rates." Distributed as a single file with all 52 faces as extractable objects. Same copyleft objection as 1d, plus a manual extraction step. **Reject.**

### 1g · Deck comparison summary

| Deck | Licence | Risk | 52-face size | Indices at 64px | Court art | Verdict |
|------|---------|------|--------------|-----------------|-----------|---------|
| **Kennard/RevK (current)** | CC0 | **None** | **705 KB** | Poor | **Best** | **Keep — regenerate** |
| Kennard @ `super=1` | CC0 | **None** | **570 KB** | **Good** | **Best** | ✅ **Recommended** |
| Byron Knoll | PD / WTFPL / MIT | None | 8.24 MB | Poor | Good | Reject — 11.7× size, no gain |
| saulspatz jumbo | PD | None | 15.71 MB | **Excellent** | Weak (boxed) | Reject — 22× size, art loss |
| htdebeer / Bellot | **LGPL-2.1** | **Copyleft + sprite** | 962 KB sprite | Fair | Good | Reject |
| Tekeye / Fowler | PD **(disputed)** | **Authorship dispute** | n/a | Fair | Good | **Reject** |
| Aguilar | **LGPL-3.0** | **Copyleft + attribution** | n/a | Fair | Good | Reject |

---

## 2 · Recommendation — regenerate, don't replace

### The decisive finding

`me.uk/cards` is a **live CGI generator**, not an asset archive, and it is CC0. [VERIFIED: direct fetch, 2026-08-25]

Verified parameters:

| Parameter | Values | Relevance |
|-----------|--------|-----------|
| `super` | `0` / `1` / `2` | **Index size** — the headline fix |
| `back` | Diamond, **Goodall**, Arrows, Maze, Illusion, Marked, Plain | **Card back design** |
| `frontcolour` / `backcolour` | any hex | **Native stock + back tint** |
| `blackcolour` / `redcolour` | any hex | Pip colours |
| `fourcolour` | on/off | 4-colour deck (♦ blue, ♣ green) |
| `qr`, `ace1`, `ace2` | free text | **Ace-of-Spades watermark — can be cleared** |
| `right`, `toponly`, `splitindex` | on/off | Index placement |
| `ace` | Fancy / Large / Goodall / Plain / None | Ace-of-spades style |
| `zip=...` | submit | **Bulk SVG download** |

### Measured results

| Variant | 56-file total | Indices at 64px | Court art |
|---------|--------------|-----------------|-----------|
| `super=0` (today) | 569 KB | Unreadable | Full-bleed |
| **`super=1`** | **567 KB** | **Clearly readable** | **Full-bleed, intact** |
| `super=2` | 567 KB | Very large | Noticeably shrunk; pip layout goes asymmetric |
| `fourcolour` | 569 KB | as `super=0` | Full-bleed |

`super=1` is the sweet spot, and **costs nothing** — it is 2 KB *smaller* than what ships. [VERIFIED: generated and rendered locally at 64/76/88px]

### The trade-off, stated plainly

The brief asks whether the visual gain justifies touching the asset pipeline, the `PlayingCard` mapping, the `cardAssetPath` on-disk test, and the DOM-leak filename assertions. **Answer: the cost is far lower than assumed, because the naming scheme can be preserved by a pure rename.**

The generator's zip emits `{RANK}{SUIT}.svg` — `KS.svg`, `TS.svg`, `2C.svg`, `1B.svg`. The app expects `{SUIT}-{RANK}.svg` with `10` for ten. A one-shot rename bridges them:

```
KS.svg  → S-K.svg          TS.svg → S-10.svg
QH.svg  → H-Q.svg          2C.svg → C-2.svg
1B.svg  → back.svg
```

Consequently:

| Artefact | Change required |
|----------|-----------------|
| `src/ui/PlayingCard.tsx` (`SUIT_TO_ASSET`, `RANK_TO_ASSET`, `cardAssetPath`) | **None** |
| `src/ui/CardBack.tsx` | **None** |
| `PlayingCard.test.tsx` (15 path assertions + the 52-file `existsSync` test) | **None** |
| `Seat`/`FlipCard`/`TableScene`/`copyCueRender`/`App.*` filename assertions (~11 refs) | **None** |
| `public/cards/*.svg` | Replaced (52 + back) |
| `public/cards/LICENSE` | Provenance block updated (still CC0) |
| `depthTypography.guard.test.ts` lines ~660–690 | **Delete/replace** — only if the CSS back-filter is dropped (recommended) |

**Total code change: one test block, and only as a consequence of the back-tint improvement.** Every one of the ~26 asset-filename assertions the brief worried about survives untouched. That changes the calculus entirely: this is not a risky pipeline migration, it is an asset refresh plus a rename script.

### Recommended generation command

```
https://www.me.uk/cards/makeadeck.cgi
  ?super=1            # readable indices, court art intact
  &qr=&ace1=&ace2=    # remove the QR + "www.me.uk/cards" watermark
  &back=Goodall       # ornate back (see §3)
  &backcolour=%236E1F2B   # burgundy, native — lets the CSS filter be deleted
  &zip=Download+zip+file+of+SVG+for+web+use
```

On the watermark: the licence says *"I would appreciate it if the link on the Ace of Spades was left intact, that is not a requirement."* Removing it is explicitly permitted. The courteous course — and the one recommended — is to remove the on-card watermark while **keeping** the existing attribution block in `public/cards/LICENSE`, which already credits Adrian Kennard by name.

### Should presentation come first instead?

The brief asks whether presentation work would deliver more for less risk. **Both, in this order:**

1. **Presentation first** (§4) — zero asset risk, largest per-unit visual gain, and it is what makes any deck look premium.
2. **Regeneration second** — because it now costs one test block, it is worth doing; the index legibility fix is a *functional* improvement for an odds tool, not just cosmetic, and it cannot be achieved with CSS at any price.

The one thing presentation **cannot** fix is index size. That is baked into the vector geometry.

---

## 3 · The card back

### Options surveyed

All seven generator backs were rendered at 200px raw and at 64px under the app's current filter.

| Back | Size | At 64px | Assessment |
|------|------|---------|------------|
| **Diamond** (current) | 0.5 KB | Dithered mush | Pattern pitch aliases; no composition |
| **Goodall** | 660 KB | **Reads as a designed object** | **Ornate rosette medallion + corner star medallions + engraved frame.** The only back with real composition rather than an all-over pattern |
| Arrows | 170 KB | Noisy speckle | Multi-colour confetti; fights the palette |
| Maze | 6 KB | Busy but structured | Reads as a maze, not a casino back |
| Illusion | 2.7 KB | Bold checker | Op-art; clean and cheap but modern, not casino |
| Marked | 56 KB | Noisy | A marked-deck novelty; inappropriate here |
| Plain | 0.3 KB | Flat colour | Too plain |

**Goodall is the clear winner** and is the aesthetic sibling of the court cards already in use — both traced from the same 1870 Goodall & Son source. Verified empirically: at 64px under the burgundy tint the medallion structure and frame remain legible, where the current Diamond back does not survive.

### The size problem, and how to solve it

Goodall's raw 660 KB is one giant traced `<path>` at 7-decimal precision, with only two colours (`#0fc` and `black`). Measured reductions:

| Treatment | Raw | Gzipped |
|-----------|-----|---------|
| As generated | 660 KB | 295 KB |
| Rounded to 3dp | 515 KB | 212 KB |
| **Rounded to 2dp** | **436 KB** | **167 KB** |
| Rounded to 1dp | 353 KB | 119 KB |

At 2dp — visually lossless at 64–88px, where one SVG unit is ~0.27px — the back costs ~167 KB gzipped. For context the entire current 54-file deck is 215 KB gzipped.

**Recommendation, in priority order:**

1. **Generate Goodall natively in burgundy** via `backcolour=%236E1F2B`, then run it through SVGO with `floatPrecision: 2`. Expect ~430 KB raw / ~167 KB gz for the app's single most-frequently-rendered asset (every face-down card, every seat, the deck stack).
2. **Delete `--card-back-filter` and the `.card-back { filter: ... }` rule.** Three separate wins: the tint becomes correct instead of muddy `#70564E`; one render-time filter disappears from every face-down card; and — see §5 — a `filter` is on the CSS spec's list of properties that force `transform-style: flat`, so removing it eliminates a real 3D hazard before it can bite. Cost: the `depthTypography.guard.test.ts` describe block at ~line 660 must go, since it exists specifically to pin `sepia()` in that filter.
3. **Budget alternative, if 167 KB is judged too expensive:** hand-author a back. A procedural guilloche/rosette using a `<pattern>` for the field, two or three `<circle>`/`<path>` rosettes and a double-rule border lands at **2–4 KB**, and — authored with `fill="currentColor"` — can be tinted straight from a palette token with no filter at all. This is genuinely viable and gives full palette control; it just costs design time and will not match the antique register of the court cards as convincingly as Goodall does.

The recommended path is (1) + (2). The 167 KB buys the app's most-seen asset, is cached after first paint, and is a one-time cost on a static site.

---

## 4 · Presentation techniques (deck-independent)

Six treatments were rendered on the same asset, at the real 88px hero size, on the real felt gradient. Findings ranked by measured impact:

| Rank | Technique | Impact | Cost |
|------|-----------|--------|------|
| **1** | **Warm stock tint** | **Largest single gain.** An ivory/cream card reads as card *stock*; pure `#FFFFFF` reads as a white rectangle punched out of the felt | 1 pseudo-element or 1 generator param |
| **2** | **3-layer directional shadow** | Card visibly sits *on* the table instead of floating. Extends the existing `--elev-rest` with a third, longer cast layer | 1 CSS token |
| **3** | **Edge bevel** | `inset 0 1px 0 rgba(255,255,255,.9)` + `inset 0 -1px 2px rgba(0,0,0,.28)` + a hairline rim. Gives the card a physical edge and **replaces** the near-invisible `1px rgba(0,0,0,.15)` border | 1 pseudo-element |
| **4** | **Per-card rotation jitter (±1–3°)** | Row reads hand-dealt rather than machine-aligned. Must be deterministic per slot (the existing plan already forbids `Math.random`) | 1 inline style |
| **5** | Corner radius / border | Current 6px is correct for these sizes; no change needed | — |
| **6** | **Paper grain (feTurbulence)** | **Skip it.** At 64–88px the grain is invisible; all it does is slightly grey the stock. It is the weakest of the six and it drags in `mix-blend-mode`, which is a 3D hazard (below) | Not worth it |

**Do not stack warmth mechanisms.** Applying the generator's `frontcolour` *and* a CSS tint layer produced a distinctly over-yellow card. Choose one tier — CSS is recommended, because it is reversible without regenerating 52 files.

### Conflicts with this project's existing contracts

| Technique | Conflict | Mitigation |
|-----------|----------|------------|
| Grain / tint via `mix-blend-mode` | **On MDN's grouping-property list** — forces `transform-style: flat`, collapsing the reveal flip | Never apply to `.flip-card-inner` or any ancestor of it. Leaf card element only |
| `isolation: isolate` (needed to scope blend modes) | Same list, same consequence | Same rule |
| Card-back `filter` | Same list | Delete it entirely (§3) |
| Bevel via `::after` overlay | Overlay sits above the `<img>`; must be `pointer-events: none` | Trivial |
| Rotation jitter as CSS `transform` | **Collides with Motion**, which writes `transform` wholesale to inline style — see §5 finding C | Put jitter on a *wrapper*, Motion's transform on the inner element |
| Any new animation | `prefers-reduced-motion` + the animation gate are load-bearing | All five recommended techniques are **static** — no gate interaction. This is the point: they are pure presentation |
| `.card-in-flight` elevation | Already transitions `box-shadow` only | A richer rest shadow composes cleanly; keep the single-property transition |

All five recommended techniques are static styling. **None touches the animation gate, `prefers-reduced-motion`, or TBL-04's "odds never move while cards fly" invariant.**

---

## 5 · CSS 3D feasibility

Every claim in this section was verified empirically in headless Chrome (Chromium, `--force-device-scale-factor` 2.5–3), not merely cited.

### Finding A — do **not** billboard the cards

Counter-rotating cards to face the viewer (`rotateX(-30deg)` against a `rotateX(30deg)` plane) is the standard fix for *labels* in 3D, and the brief asks whether it is the usual solution here. **Tested: it is the wrong choice for a poker table.**

Billboarded cards read as *standing upright on the felt* — like place-cards propped on a table. Cards that simply inherit the plane's tilt read as *lying on the table*, which is both physically correct and better-looking. At a 26–30° tilt the foreshortened court art remains perfectly legible.

**Recommendation: let cards inherit the tilt. Do not billboard.** [VERIFIED: rendered A/B]

### Finding B — use `transform-style: flat`, not `preserve-3d`

The critical result. Behaviour of `z-index` inside a tilted plane, measured by pixel-sampling overlap regions:

| Configuration | Result |
|---------------|--------|
| Children have **no** 3D transform, plane `preserve-3d` | `z-index` honoured ✅ |
| Children have **no** 3D transform, plane `flat` | `z-index` honoured ✅ |
| Low-`z-index` child has `translateZ(40px)`, plane **`preserve-3d`** | **3D depth BEATS `z-index`** ❌ — `z-index:2` painted over `z-index:50` |
| Low-`z-index` child has `translateZ(40px)`, plane **`flat`** | `z-index` honoured ✅ |

**The hazard is precise:** in a `preserve-3d` context, any child with a non-zero Z position is sorted by 3D depth, and that sorting **overrides `z-index` entirely**. This app has a documented stacking scale — `--z-community: 1`, `--z-seat: 2`, `--z-in-flight: 50` — whose stated purpose is that *"every animating card uses `--z-in-flight` so it is never occluded by a settled seat/board card."* The moment the felt becomes `preserve-3d` **and** anything gains a `translateZ` (very tempting for a card-lift effect), that guarantee silently breaks with no error.

Because the table tilt needs no per-card 3D transforms, `flat` costs nothing: rendering the plane `flat` vs `preserve-3d` was **visually identical** when children are 2D.

### Finding C — Motion overwrites CSS `transform` on the same element

Motion writes `transform` directly to an element's inline style. Any CSS `transform` on that same element — a counter-rotation, a rotation jitter, a lift — is destroyed the instant Motion animates it. Verified: a card with an inline `translateY(...) scale(...)` inside a tilted plane lost its counter-rotation entirely, while the same card with the counter-rotation moved to a **wrapper** kept both.

**Rule: one transform owner per element.** Structural transforms (tilt, jitter, billboard) go on wrapper elements; Motion owns the leaf. This applies to the rotation-jitter recommendation in §4 too.

### Finding D — the existing reveal flip survives the tilt

`.flip-card` (`perspective: 1000px`) + `.flip-card-inner` (`preserve-3d`) + `.flip-card-face` (`backface-visibility: hidden`) was tested nested inside a tilted plane at rest, mid-flip (60–70°), and fully flipped. **It renders correctly in all three states**, under both a `preserve-3d` plane and a `flat` plane, because `.flip-card` establishes its own local 3D context. No change to `FlipCard.tsx` or its CSS is required. [VERIFIED: rendered]

### Finding E — rasterisation crispness is a non-issue for a *static* tilt

Rendered at `rotateX(30deg)`, with and without `will-change: transform`, against an untilted control: **no visible blur** in any case. SVG served via `<img>` rasterises at the composited size.

The documented Chromium problem is narrower than folklore suggests: Chromium snaps a layer's composited transform to whole pixels and fixes a raster translation at layer-creation time; when the transform then *animates*, the original raster scale is retained to avoid re-tiling, so content blurs **during** the animation. Since Chrome 53 content is re-rastered on scale change **unless** `will-change: transform` is set — that property means "animate this fast," and pins the raster scale.

**Implication:** a **static** felt tilt is safe; do **not** put `will-change: transform` on the tilted plane, because that is what would pin it at a stale raster scale. If the tilt is ever animated (e.g. an intro), expect transient softness and remove `will-change` in a `requestAnimationFrame` callback to force a re-raster.

### Recommended 3D architecture

```css
/* Outer felt container owns the camera. Never transformed itself. */
.felt {
  perspective: 1200px;
  perspective-origin: 50% 40%;
}

/* Inner plane carries the tilt. transform-style: flat is LOAD-BEARING —
   it is what keeps the --z-* stacking scale authoritative (Finding B). */
.felt-plane {
  position: absolute;
  inset: 0;
  transform: rotateX(26deg);
  transform-style: flat;   /* NOT preserve-3d */
  /* no will-change (Finding E) */
}
```

Verified working end-to-end: plane tilt + a correctly-rendering reveal flip + an intact `z-index: 50` overlap, simultaneously.

**Guard rails for the implementing phase:**

- `transform-style: flat` on `.felt-plane` needs a comment and ideally a guard test — it looks like a no-op default and will be "cleaned up" by a future reader, silently breaking the in-flight stacking guarantee.
- No `translateZ` on any card while the plane is `flat` (it does nothing useful) — and none at all if anyone later switches the plane to `preserve-3d`.
- Tilt beyond ~30° starts to compress the court art badly. 24–28° is the usable band.
- The felt's existing `border-radius: 50%/28%` oval + `inset` rail shadow survive the tilt fine.
- A tilted plane changes hit-test geometry: pointer coordinates map through the transform. Seat buttons and card slots remain clickable (the browser handles this), but any **manual** geometry maths in `tableGeometry.ts` that assumes an untransformed plane should be re-checked.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Larger card indices | Overlaying CSS/HTML rank glyphs on the card | `super=1` generator param | Overlays fight the art, break `alt` text, and duplicate information already in the SVG |
| Card back recolour | CSS `filter` chains | `backcolour` at generation | Filters are lossy, produce muddy results, cost render time, and force `transform-style: flat` |
| Card stock warmth | Editing 52 SVGs by hand | One CSS tint layer, or `frontcolour` | Both are one change; hand-editing is 52 chances to break something |
| Deck file renaming | Manual copying | A scripted rename | 52 files, mechanical, must be exact |
| SVG size reduction | Hand-editing path data | SVGO with `floatPrecision` | Measured 34% raw / 43% gz reduction on the Goodall back |
| 3D table | Canvas/WebGL rewrite | CSS `perspective` + `rotateX` | Excluded by the locked stack, and unnecessary — verified working in CSS |

---

## Common Pitfalls

### Pitfall 1 — assuming the current deck is the weak link
**What goes wrong:** A deck swap is scoped, 52 files churn, tests are rewritten — and the result looks no better, because the actual defects were index size, back pattern pitch and stock colour.
**Warning sign:** Nobody has rendered the current deck at 200px. Do that first.

### Pitfall 2 — `preserve-3d` silently voiding the z-index scale
**What goes wrong:** The felt gets `preserve-3d` (it looks like the "correct" 3D value), a card later gets `translateZ` for a lift effect, and in-flight cards begin rendering *behind* settled cards. No error, no test failure unless one exists specifically for it.
**How to avoid:** `transform-style: flat` on the tilted plane, commented and guard-tested.

### Pitfall 3 — Motion and CSS fighting over `transform`
**What goes wrong:** Rotation jitter or a counter-rotation is written in CSS on the same element Motion animates; it vanishes the moment the animation runs, intermittently and confusingly.
**How to avoid:** One transform owner per element. Wrapper for structure, leaf for Motion.

### Pitfall 4 — `mix-blend-mode` / `filter` / `isolation` collapsing the flip
**What goes wrong:** A paper-grain or tint overlay is added to a card container that happens to be inside the flip; the 3D reveal flattens into a squash.
**How to avoid:** Check any new property against MDN's grouping-property list before applying it anywhere inside `.flip-card`.

### Pitfall 5 — pattern pitch below the render scale
**What goes wrong:** A back pattern authored at print scale (6 units on a 240-unit card) aliases into moiré at 64px. This is the current back's exact failure.
**How to avoid:** Any repeating motif needs a pitch of ≥ 12 SVG units (~3px at 64px) to survive. Prefer composition (medallion + frame) over all-over fine texture.

### Pitfall 6 — shipping third-party branding
**What goes wrong:** The Ace of Spades carries a QR code and an external URL into a portfolio app.
**How to avoid:** Clear `qr`/`ace1`/`ace2`; keep attribution in `LICENSE`, not on the card face.

---

## Top recommendations

| Area | Recommendation | Confidence |
|------|---------------|------------|
| **Deck** | **Keep the Kennard/RevK CC0 art. Regenerate at `super=1` with `qr`/`ace1`/`ace2` cleared**, rename `{RANK}{SUIT}` → `{SUIT}-{RANK}`. Same licence, same art, readable indices, no watermark, ~570 KB (2 KB smaller than today), **zero production-code changes and zero test changes**. Reject every alternative deck: both LGPL options on licence risk, Tekeye on a live authorship dispute, and both public-domain Knoll decks on 11.7×/22× size for no legibility gain | HIGH |
| **Back** | **Replace Diamond with `back=Goodall`, generated natively burgundy via `backcolour`,** SVGO'd at `floatPrecision: 2` (~436 KB raw / ~167 KB gz). **Delete `--card-back-filter` and the `.card-back` filter rule** — fixes the muddy `#70564E` tint, removes a render-time filter, and eliminates a `transform-style` flattening hazard. Costs one guard-test block. Budget alternative: hand-author a 2–4 KB procedural rosette using `currentColor` | HIGH |
| **Presentation** | **Warm ivory stock tint → 3-layer directional shadow → edge bevel → ±1–3° deterministic rotation jitter.** In that order; the first two carry most of the gain. **Skip paper grain** — invisible at 64–88px and it drags in `mix-blend-mode`. All four are static: no animation-gate or `prefers-reduced-motion` interaction. Use one warmth mechanism, not two | MEDIUM (aesthetic, but judged against real renders) |
| **3D** | **`perspective` on `.felt`, `rotateX(24–28°)` on an inner plane with `transform-style: flat`.** Do **not** use `preserve-3d` at table level (it lets 3D depth override the `--z-in-flight` guarantee). Do **not** billboard the cards — inheriting the tilt looks better and is physically right. Do **not** set `will-change: transform` on the plane. The existing `FlipCard` works unchanged. Keep structural transforms on wrappers, Motion on leaves | HIGH (empirically verified) |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Aesthetic rankings (Goodall back "best", `super=1` the sweet spot, grain not worth it) are my judgement from renders at real sizes, not measured fact | §3, §4 | Taste may differ; all are cheap to A/B before committing |
| A2 | SVGO at `floatPrecision: 2` will reproduce the ~34%/43% reduction I measured with a regex rounding approximation | §3 | Size estimate may shift ±10%; verify by running SVGO |
| A3 | The `me.uk/cards` CGI remains available when regeneration happens | §2 | Mitigate by downloading the zip **and** archiving it; the generator source is also on Codeberg (GPL-3.0 tool, CC0 output) |
| A4 | Chromium-only 3D testing. Firefox/Safari not verified — Firefox has open `preserve-3d` bugs (bugzilla 725299, 2034283) | §5 | The recommendation *avoids* `preserve-3d` at table level, which sidesteps the riskiest area. Still worth a cross-browser check |
| A5 | Byron Knoll deck court art judged "no more legible" from a 64px render of 5 sample cards, not all 52 | §1b | Low — the index geometry is uniform across a deck |

## Open Questions

1. **Four-colour deck?** `fourcolour=on` (♦ blue, ♣ green) is free and makes suit identification instant — arguably valuable for a probability-teaching tool. But it trades away casino authenticity. **Recommendation: a user preference toggle, not a default** — and note it would need a second 52-file deck directory plus a change to `cardAssetPath`, which *would* break the zero-code-change property. Defer.
2. **Hit-testing under tilt.** `tableGeometry.ts` computes seat/card positions. Whether any of it assumes an untransformed plane needs checking before the tilt lands.
3. **Card size.** 64px opponent cards are small for this art regardless of index size. If layout permits 72–80px, that compounds with every recommendation here at zero asset cost.

## Sources

### Primary (HIGH confidence)
- `https://www.me.uk/cards/` — CC0 dedication quoted verbatim; full parameter list; generator live 2026-08-25
- `https://www.me.uk/cards/makeadeck.cgi` — all variants generated and rendered locally
- Local `public/cards/LICENSE`, `public/cards/*.svg`, `src/ui/PlayingCard.tsx`, `src/index.css`, `src/App.css`, `depthTypography.guard.test.ts` — read directly
- Headless Chromium renders (this session) — deck comparisons, back comparisons, index sizes, presentation ladder, and all §5 3D tests
- [MDN `transform-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style) — the grouping-property list forcing `flat`
- [GitHub: htdebeer/SVG-cards](https://github.com/htdebeer/SVG-cards) — LGPL-2.1, sprite structure
- [GitHub: notpeter/Vector-Playing-Cards](https://github.com/notpeter/Vector-Playing-Cards) — PD/WTFPL; sizes via GitHub API
- [GitHub: saulspatz/SVGCards](https://github.com/saulspatz/SVGCards) — PD, jumbo-index; sizes via GitHub API
- [GitHub: hayeah/playing-cards-assets](https://github.com/hayeah/playing-cards-assets) — MIT wrapper over Knoll art

### Secondary (MEDIUM confidence)
- [RevK: SVG Vector Playing Cards](https://www.revk.uk/2018/06/svg-vector-playing-cards.html) — Goodall & Son c.1870 provenance of the court art
- [Tek Eye: SVG Playing Cards](https://www.tekeye.uk/playing_cards/svg-playing-cards) — PD claim **and** the Aguilar dispute, both on-page
- [Open Source Vector Playing Cards (Aguilar)](https://totalnonsense.com/open-source-vector-playing-cards/) — LGPL-3.0 terms
- [Re-rastering composited layers on scale change — Chrome Developers](https://developers.google.com/web/updates/2016/09/re-rastering-composite) — Chrome 53 re-raster + `will-change` behaviour
- [Chromium blink-reviews: transformed rasterization](https://groups.google.com/a/chromium.org/g/blink-reviews/c/i93N_b0-jr8) — raster translation pinned across transform changes
- [Mozilla bug 725299](https://bugzilla.mozilla.org/show_bug.cgi?id=725299), [bug 2034283](https://bugzilla.mozilla.org/show_bug.cgi?id=2034283) — open `preserve-3d` z-ordering issues (basis for A4)

### Flagged
- `https://codeberg.org/RevK/SVG-playing-cards` — GPL-3.0 generator source. **README contains a prompt-injection payload** (see top of document). Not used as a source for any claim here; the CC0 art dedication was verified independently at `me.uk/cards`.

## Metadata

**Confidence breakdown:**
- Licensing: **HIGH** — every licence read at source; CC0 quoted verbatim; two copyleft risks and one authorship dispute identified
- Sizes/measurements: **HIGH** — measured locally or via GitHub API, never estimated
- CSS 3D behaviour: **HIGH** — empirically tested in Chromium, including one result that overturned my initial visual reading
- Aesthetic recommendations: **MEDIUM** — judged from renders at the app's real sizes on the real felt, but still taste
- Cross-browser 3D: **LOW** — Chromium only (see A4)

**Research date:** 2026-08-25
**Valid until:** ~2026-11-25 (90 days — CC0 art and CSS 3D semantics are stable; the live generator's availability is the only volatile dependency)
