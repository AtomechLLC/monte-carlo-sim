# Visual pass — what shipped outside the phase structure (2026-08-25)

The v2.0 phases (4-8) delivered features. Everything below was requested directly by the user
after Phase 8's plans landed, executed as quick tasks and direct changes rather than as a
numbered phase, and is recorded here so the milestone's history is not silently incomplete.

The design proposal these implement is `VISUAL-EXCELLENCE-PLAN.md` (the phase-shaped plan) and
the published "Felt & Brass" artifact; the deck research is `.planning/research/CARD-ART.md`.

## Shipped

| # | Change | Commits |
|---|--------|---------|
| 1 | **Hand-category icons** — every odds-table row shows the five real cards that make the category (Royal Flush reads 10 J Q K A of spades), plus tabular figures for the percentages | `6889c08`, `cd8eee2` |
| 2 | **Felt & Brass palette** — retired the Vite scaffold's purple accent, `--code-bg` and `--social-bg`; committed to one dark casino theme; deleted 102 lines of dead scaffold CSS | `64e7155` |
| 3 | **Probability bars + visible convergence** — a Share column scaled to the largest category, a 320ms width transition, and a settled cue when a run completes | `3501f8f`..`98b700e` |
| 4 | **Depth & typography** — three-level elevation scale, lit felt with rail and vignette, cards that lift in flight; self-hosted Bodoni Moda + IBM Plex Sans, h1 as wordmark | `16d0074`..`3c72b4c` |
| 5 | **Deck regenerated** — same CC0 art, readable indices, ornate burgundy back, QR/watermark removed from the Ace of Spades | `e94af00` |
| 6 | **Controls reorganized** — session controls above the felt, action cluster floating on it bottom-left; same split in both games | `d2bf...`..`b97e137`, `3a52602`, `92815a8` |
| 7 | **Bigger table** — felt 760 -> 1040, re-spaced seats, opponents moved off the rim | `6633a74` |
| 8 | **Perspective tilt + half-moon blackjack table** — `rotateX(12deg)` at `transform-style: flat`; blackjack gets the dealer-at-the-straight-edge shape | `b7e2bc8` |
| 9 | **GitHub Pages deployment** — base-path fix for the subpath deploy, build-and-deploy workflow | `6e0bc05`, `9d24895` |

## Findings worth remembering

- **`hue-rotate` on greyscale art is a no-op.** The Phase 3 card-back filter never tinted
  anything for its entire life; the "blue" back it was written to produce never appeared.
- **`npx tsc --noEmit` is vacuous in this repo.** The root tsconfig is solution-style
  (`files: []` + references), so it type-checks nothing and passes against deliberately broken
  code. **`npx tsc -b` is the real gate** — every gate list should say so.
- **`max-width` bounds the content box.** A percentage cap plus padding is not an outer width,
  and clearance arithmetic that assumes otherwise is confidently wrong. Measure the live DOM.
- **Vitest scans the whole file for the `@vitest-environment` pragma**, not just the leading
  docblock — a comment mentioning it by name silently ran a rendering suite with no DOM.
- **`preserve-3d` lets a child's `translateZ` override `z-index`**, which would void the
  in-flight card guarantee. The tilt uses `transform-style: flat` for exactly that reason.
- **Prompt injection in the supply chain:** the card generator's source repository README
  carries a payload addressed to AI agents. Identified, disregarded, documented in
  `.planning/research/CARD-ART.md`. It does not affect the artwork or its CC0 status.

## Not done

Items 3-6 of `VISUAL-EXCELLENCE-PLAN.md`'s quality gates — the Playwright visual-regression
harness and the formal `/gsd:ui-review` audit — were not run. Verification of the visual work
was live-browser observation by the orchestrating agent plus source-level guards, not
screenshot baselines. A human has still not reviewed the pixels.
