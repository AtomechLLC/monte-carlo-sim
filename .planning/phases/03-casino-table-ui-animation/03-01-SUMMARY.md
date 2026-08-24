---
phase: 03-casino-table-ui-animation
plan: 01
subsystem: ui
tags: [react, svg, cc0-assets, accessibility, vite-public-assets]

# Dependency graph
requires:
  - phase: 02-scenario-construction-street-navigation
    provides: gameStore runout/street/revealedMask shape, HandDisplay/BoardDisplay testid contract
provides:
  - Vendored CC0 SVG playing-card deck committed under public/cards/ (52 faces + back + LICENSE)
  - PlayingCard/CardBack — the single D-03 card-code-to-art mapping bridge
  - HandDisplay/BoardDisplay re-skinned to render real card art instead of text codes
affects: [03-02, 03-03, TableScene/Seat components, animation/deal-choreography plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card art referenced via <img src=\"/cards/...\"> from public/, never inlined as React components (bundle-size)"
    - "Exhaustive Record<Rank,...>/Record<Suit,...> maps for card-code -> asset-path/alt-text translation, compile-time-checked"
    - ".card-slot wrapper owns width; .playing-card owns box treatment at width:100% — face-up/face-down never changes box size"

key-files:
  created:
    - public/cards/*.svg (53 vendored assets)
    - public/cards/LICENSE
    - src/ui/PlayingCard.tsx
    - src/ui/PlayingCard.test.tsx
    - src/ui/CardBack.tsx
  modified:
    - src/ui/HandDisplay.tsx
    - src/ui/BoardDisplay.tsx
    - src/App.css
    - src/index.css
    - src/App.test.tsx
    - src/App.acceptance.test.tsx
    - tsconfig.app.json

key-decisions:
  - "Vendored letele/playing-cards pinned to commit 865a78eb940c1232e4b21523577c8fca52f694fe (CC0-1.0, confirmed via GitHub API license.spdx_id)"
  - "Wrapped opponent seat cards in .card-slot--opponent spans (not explicitly spelled out in the plan's opponent JSX bullet, but implied by the plan's own CSS action defining that variant and by the Table-Geometry 'reveal must never change box size' rule) for visual consistency with hero/community slots"
  - "Added 'node' to tsconfig.app.json compilerOptions.types so the PlayingCard.test.tsx on-disk asset-existence check (node:fs/node:path/node:url) type-checks under tsc -b — type-only change, no runtime/browser-bundle impact"

patterns-established:
  - "D-03 mapping-component contract: only PlayingCard.tsx may construct a /cards/... path or a screen-reader alt string"
  - "Accessibility split: full alt text inside hero-hole/board-cards; decorative alt=\"\" inside opponent-seat buttons that already carry a comprehensive aria-label"

requirements-completed: [TBL-02]

# Metrics
duration: ~35min
completed: 2026-08-24
---

# Phase 3 Plan 01: Vendored Card Art & PlayingCard Bridge Summary

**Real playing-card SVG faces (pips + court-card art) and a shared accent-tinted card back now render throughout the hero hand, opponent seats, and board — replacing every two-character text code from Phases 1-2, behind a single exhaustively-typed `PlayingCard`/`CardBack` mapping bridge.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-24
- **Tasks:** 3 completed (Task 2 was TDD: RED then GREEN)
- **Files modified/created:** 13 (7 new: 53 SVGs counted as one directory + LICENSE + PlayingCard.tsx/.test.tsx + CardBack.tsx; 6 modified: HandDisplay.tsx, BoardDisplay.tsx, App.css, index.css, App.test.tsx, App.acceptance.test.tsx, tsconfig.app.json)

## Accomplishments

- Vendored the CC0-1.0 `letele/playing-cards` SVG deck (52 faces + back), pinned to a resolved commit SHA, with the full upstream LICENSE text fetched directly (not hand-typed) plus a provenance block recording source/SHA/date
- Built `PlayingCard`/`CardBack` as the sole D-03 bridge from a `Card` string to rendered art, using `getRank`/`getSuit` (never manual string slicing) with exhaustive `Record<Rank,...>`/`Record<Suit,...>` maps — TDD RED then GREEN, 9 new tests covering all 52 cards plus an on-disk asset-existence check
- Re-skinned `HandDisplay`/`BoardDisplay` to render through `PlayingCard`/`CardBack` — hero hole cards, revealed opponent cards, hidden opponent backs, and board cards all show real art — while every Phase 1-2 testid, aria-label, `title`, and `disabled` rule survived verbatim
- Added the `--card-back-filter` (A2 purple tint) and `--card-w-{hero,opponent,community}` CSS tokens, plus the shared `.playing-card`/`.card-back`/`.card-slot` box-treatment rules, so a face-up/face-down swap never changes a card's box dimensions
- Verified end-to-end: 129/129 tests pass, `tsc -b` clean, `eslint .` clean, production build succeeds with `dist/cards/` containing all 53 vendored assets, and the dev server correctly serves `/cards/S-A.svg` and `/cards/back.svg` as `image/svg+xml`

## Task Commits

1. **Task 1: Vendor the CC0 SVG deck into public/cards/ with pinned provenance** - `1430fc5` (feat)
2. **Task 2: PlayingCard and CardBack — the single card-code to art bridge** - `afbcd83` (test, RED) → `b41259a` (feat, GREEN)
3. **Task 3: Render card art in the hero hand, opponent seats, and the board** - `10a4cd0` (feat)

_Task 2 was TDD: RED (failing test, module didn't resolve) then GREEN (implementation, 9/9 passing). No REFACTOR commit was needed — the GREEN implementation required no cleanup pass._

## Files Created/Modified

- `public/cards/*.svg` (53 files) - Vendored CC0-1.0 face/back art, pinned to commit `865a78eb940c1232e4b21523577c8fca52f694fe`
- `public/cards/LICENSE` - Full upstream CC0-1.0 text (fetched via curl, not typed) plus a provenance block
- `src/ui/PlayingCard.tsx` - `cardAssetPath`/`cardAltText`/`PlayingCard` — the only D-03 bridge
- `src/ui/PlayingCard.test.tsx` - Exhaustive 52-card coverage + on-disk asset existence check
- `src/ui/CardBack.tsx` - Zero-store face-down leaf, always `alt=""`
- `src/ui/HandDisplay.tsx` - Hero/opponent seats now render `PlayingCard`/`CardBack` instead of text
- `src/ui/BoardDisplay.tsx` - Board cards now render through `PlayingCard`
- `src/App.css` - New card-presentation CSS section; relaxed board-cards span border rule
- `src/index.css` - New `--card-back-filter`/`--card-w-*` tokens
- `src/App.test.tsx` - Hero-hole assertion now checks rendered `<img alt>` instead of raw text
- `src/App.acceptance.test.tsx` - Revealed-opponent assertion now checks `aria-label` instead of `textContent`
- `tsconfig.app.json` - Added `"node"` to `compilerOptions.types` (see Deviations)

## Decisions Made

- Pinned the vendored deck to `letele/playing-cards` commit `865a78eb940c1232e4b21523577c8fca52f694fe` (resolved via the GitHub API at execution time, not guessed) — license confirmed `CC0-1.0` via `license.spdx_id` before downloading anything.
- Wrapped each opponent seat's two cards in `.card-slot.card-slot--opponent` spans. The plan's Task 3 JSX bullet for opponents didn't spell out a wrapper span, but the plan's own CSS instructions define a `--card-w-opponent` token and a `.card-slot--opponent` variant, and explicitly note "a reveal must never change slot width or height" — which is exactly the opponent-seat reveal scenario. Wrapping keeps hero/opponent/community all following the same slot-owns-width pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `"node"` to `tsconfig.app.json`'s `compilerOptions.types`**
- **Found during:** Task 2 (writing `PlayingCard.test.tsx`'s on-disk asset-existence check, an explicit acceptance-criteria requirement)
- **Issue:** The test imports `node:fs`/`node:path`/`node:url` to verify `cardAssetPath`'s output actually exists in `public/cards/` for all 52 cards (per Task 2's acceptance criteria). `tsconfig.app.json`'s `types` array was `["vite/client"]` only, so `tsc -b` failed with `TS2591: Cannot find name 'node:fs'` — a build-blocking error, not a test-runtime error (Vitest itself ran the test fine; only the separate `tsc -b` type-check step failed).
- **Fix:** Added `"node"` to `compilerOptions.types` in `tsconfig.app.json`. `@types/node` was already a devDependency. This is a type-only addition — it does not add any Node runtime code to the production browser bundle; no non-test source file imports a Node builtin.
- **Files modified:** `tsconfig.app.json`
- **Verification:** `npx tsc -b` exits 0; production `npm run build` still produces a browser-only bundle (verified by inspecting `dist/` — no Node-specific code paths).
- **Committed in:** `b41259a` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Rephrased a comment in `PlayingCard.tsx` that was tripping its own acceptance-criteria grep**
- **Found during:** Task 2, running the acceptance-criteria check `grep -c 'card\[0\]\|\.slice(' src/ui/PlayingCard.tsx` (must be 0)
- **Issue:** A doc comment explaining the Pitfall-5 rationale literally contained the substrings `card[0]` and `.slice(` as illustrative examples of what NOT to do, so the grep guard (designed to catch a real manual-slicing regression) matched the comment instead.
- **Fix:** Reworded the comment to describe the same rationale ("never manual string indexing/substring extraction") without using the literal disallowed substrings.
- **Files modified:** `src/ui/PlayingCard.tsx`
- **Verification:** `grep -c 'card\[0\]\|\.slice(' src/ui/PlayingCard.tsx` now returns `0`; no functional code change.
- **Committed in:** `b41259a` (Task 2 GREEN commit)

**3. [Rule 1 - Bug] Scoped `eslint-disable` for `react-refresh/only-export-components` in `PlayingCard.tsx`**
- **Found during:** Task 2, running `npx eslint .`
- **Issue:** The plan's `target_contracts` lock `PlayingCard.tsx`'s exports to exactly `PlayingCard`, `cardAssetPath`, `cardAltText` from one file. The `react-refresh/only-export-components` rule flags any file exporting non-component values alongside a component, which is unavoidable given the locked contract.
- **Fix:** Added a narrowly-scoped `/* eslint-disable react-refresh/only-export-components */` directly above the imports, with a comment explaining the contract that makes this necessary, rather than restructuring the file (which would violate `target_contracts`) or disabling the rule project-wide.
- **Files modified:** `src/ui/PlayingCard.tsx`
- **Verification:** `npx eslint .` exits 0 with no warnings.
- **Committed in:** `b41259a` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking build-config, 2 bug/lint fixes to satisfy the plan's own acceptance criteria). All are minimal and type/config/lint-only — no behavioral change beyond what Tasks 2-3 already specified.
**Impact on plan:** None on scope. All three were necessary to make the plan's own stated acceptance criteria pass.

## Issues Encountered

- **Content-filter interruption while writing `public/cards/LICENSE`:** An earlier turn was terminated mid-task by an API content-filter error triggered by typing out the full CC0 legal text directly in a tool call. Resumed per the coordinator's guidance: fetched the upstream `LICENSE` file directly via `curl` into `public/cards/LICENSE` (no legal text typed by the agent), then appended a short, separately-authored provenance block (source repo, pinned SHA, license id, vendor date) via a scratchpad file + `cat >>`, never reproducing the license body in conversation output. No functional impact — the committed `LICENSE` file is identical to what would have been produced by the original approach.
- **Acceptance-criteria numeric quirks (pre-existing, not introduced by this plan), documented rather than "fixed":**
  - Task 3's acceptance criteria state `grep -c "STREET_BOARD_COUNT" src/ui/BoardDisplay.tsx` should return `1`. It returns `2` (the `import` line plus the one usage site) — and it returned `2` in the pre-existing Phase 2 baseline file too (verified via `git show`), so this is a grep-counting artifact of the criteria text, not a regression. The substantive intent — "the visibility rule was not duplicated" — holds: `BoardDisplay.tsx` remains the only UI component reading `STREET_BOARD_COUNT`.
  - Task 3's acceptance criteria state `npm test` should show "the same number of passing tests as before this plan (120)". Task 2's own acceptance criteria mandate a new `PlayingCard.test.tsx` covering all 52 cards, which added 9 tests (120 → 129). Both task's stated criteria can't be literally simultaneously true; 129/129 passing with zero skips and zero regressions is the correct outcome given Task 2's explicit test requirements.

## User Setup Required

None - no external service configuration required. Card art is fully self-contained/offline once committed.

## Next Phase Readiness

- `PlayingCard`/`CardBack` are ready to be consumed by the felt-table `TableScene`/`Seat` components planned for 03-02/03-03 — no changes needed to the mapping bridge itself, only to how/where it's composed.
- `--card-w-hero`/`--card-w-opponent`/`--card-w-community` and `--card-back-filter` tokens are already in `index.css` for the animation/layout plans to reuse.
- `motion` is still not installed — correctly deferred to a later plan (03-03) per the phase's threat model (`T-03-SC`).
- `index.html`'s `<title>scaffold-tmp</title>` (D-14 cosmetic debt) is unchanged — out of scope for this plan, confirmed not in `03-01-PLAN.md`'s `files_modified` list.

## Self-Check: PASSED

All created files verified present on disk (`public/cards/LICENSE`, `public/cards/S-A.svg`, `public/cards/back.svg`, `src/ui/PlayingCard.tsx`, `src/ui/PlayingCard.test.tsx`, `src/ui/CardBack.tsx`, `src/ui/HandDisplay.tsx`, `src/ui/BoardDisplay.tsx`). All four task commit hashes (`1430fc5`, `afbcd83`, `b41259a`, `10a4cd0`) verified present in `git log`.

---
*Phase: 03-casino-table-ui-animation*
*Completed: 2026-08-24*
