---
quick_id: 260825-vis45
slug: depth-typography
date: 2026-08-25
status: complete
tasks: complete
---

# Quick Task Summary — Depth & Typography (visual steps iv and v)

> Transcribed by the orchestrator: the executing subagent is blocked by the harness from writing
> any file whose name contains "summary".

**One-liner:** The table gained lighting and weight, the app gained a real typeface pairing and a
wordmark — and looking at the running result turned up a five-phase-old bug in the card art.

## Step (iv) — depth

- **Three-level elevation scale** as documented tokens (`--elev-rest`, `--elev-raised`,
  `--elev-in-flight`, plus `--elev-settle: 180ms`). Each level is a two-part shadow — a tight
  contact shadow saying where the object touches, and a long cast shadow saying how far it sits
  above. That ratio is what reads as height; a single blurred blob never does.
- **The felt is lit**: overhead lamp highlight from top-centre, rim vignette, drawn rail on the
  existing `--felt-rail` token. Geometry unchanged — this is lighting and framing, not re-layout.
- **Cards lift in flight** via the shipped `.card-in-flight` hook, settling on landing. No
  timing, duration, gate logic, or Motion choreography was touched; `AnimatedCard`'s three
  duration constants are now pinned verbatim so that stays true.
- Retired `--shadow`, the scaffold's one-off drop shadow (no consumers left).

## Step (v) — typography

- **Two self-hosted families, no CDN**: Bodoni Moda Variable (display) + IBM Plex Sans (400/600).
  woff2 total **72.7 kB — 24% of the 300 KB budget**; dist grew 854 → 975 kB (+14.1%).
- `--heading` renamed to `--display`, which now names a *role* fenced to h1/h2 only. A didone's
  character is hairline-to-stem contrast, which stops resolving below ~20px, so it never touches
  body copy, a control, or a number.
- The h1 is a Bodoni wordmark; its text is byte-identical (no rewording).
- Type discipline held at exactly 4 sizes / 2 weights — and a phantom fifth size was removed:
  `index.css`'s `h2 { 24px }` had been dead since Phase 2 overrode it unconditionally at 20px.

## Card-back fix (found by looking, not by reading)

`public/cards/back.svg` is pure black-on-white. `hue-rotate` is a rotation in colour space, so on
a fully desaturated source **it does nothing** — the Phase 3 filter
`hue-rotate(200deg) saturate(1.4) brightness(0.95)` never tinted anything in its life; the blue
back it was written to produce never appeared, it was only dimmed. Introducing a hue with
`sepia(1)` first gives the rotation something to rotate. The back is now burgundy, which reads as
a real casino deck against the felt and shares the warm end of the palette with the brass.
Guarded, with a demonstrated negative control (reverting to the historic form fails the pin).

## Verification

- Suite **1076 passed / 71 files**; `tsc -b`, `eslint`, `npm run build` all clean.
- Contrast re-measured by compositing the new lamp gradient over the felt at each badge's real
  position: worst real case (opponent-1 seat badge) **14.38:1**, absolute worst case (a badge at
  the lamp core) **12.12:1** — all AAA. Palette unchanged and re-verified: text 7.26:1, headings
  16.57:1, accent 7.93:1, destructive 5.99:1.
- The new 59-test guard was verified falsifiable against **eight** mutations, plus the
  card-back control above.
- Live browser (orchestrator): all three `@font-face` resources report `loaded` — the pairing is
  genuinely self-hosted, not silently falling back; h1 renders Bodoni at 32px/2.24px tracking.

## Deviations

1. `@fontsource-variable/bodoni-moda@5` ships no `latin.css`; every entry point pulls four
   subsets (75.6 kB in dist to serve 25.9 kB). `src/fonts.css` carries upstream's own latin
   `@font-face` verbatim instead — honouring the brief's stated reason (keep the bundle small)
   over its suggested filename.
2. Two legacy `.woff` files (46 kB) come from fontsource's own `src` list and cannot be dropped
   while importing the package CSS. No woff2-capable browser will request them.
3. One unplanned fix: the seat-hover rule out-specified the in-flight lift, so a pointer resting
   over a seat during a deal drew an airborne card as merely *raised*. Fixed by excluding
   `.card-in-flight` from the hover selector outright, so the two states cannot contend.
4. **Two new runtime dependencies** — the font packages. Flagged deliberately: this project has
   otherwise held a zero-new-dependency line. Both are OFL-1.1 and vendored into the bundle.
5. The executor could not verify visually (no browser tooling). The orchestrator did, and that
   pass is what surfaced the card-back bug.
