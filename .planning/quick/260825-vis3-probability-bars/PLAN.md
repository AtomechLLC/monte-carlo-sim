# Quick Plan — Felt & Brass step (iii): probability bars + convergence made visible

**Branch:** `main` (direct, no worktree)
**Baseline:** `64e7155`, 67 files / 939 tests green
**Typecheck gate:** `npx tsc -b` (NOT `--noEmit` — vacuous under this solution-style tsconfig)

## Objective

Make the category distribution read as a *shape*, and make convergence visible, without
touching a single displayed digit. A "Share" column of relative-to-max bars sits between the
category label and the percentage; the bar width animates via CSS `transition` so streamed
snapshots visibly settle instead of snapping.

## Design decisions

1. **Relative-to-max, not relative-to-100.** The largest category is always a full bar. At
   realistic distributions (High Card ~17%, Royal Flush ~0.003%) a share-of-100 bar would
   render nine invisible slivers and one short stub — no shape at all. Relative-to-max makes
   the *profile* legible, and the percentage column beside it carries the absolute truth.

2. **Digits are never animated.** Frozen v1 suites assert exact `category-pct-N` textContent
   (`'50.0%'`, `'—'`). `formatPct` stays byte-identical and is called exactly as today. The
   ONLY thing that moves over time is a CSS-transitioned `width`. No count-up, no tween, no
   `requestAnimationFrame`, no interpolation state.

3. **The bar is decorative.** `aria-hidden="true"` on the bar track (which hides the fill's
   subtree too). The percentage cell beside it is the sole a11y carrier — the bar adds
   nothing an assistive-tech user would lose. A visible `Share` column header is kept so the
   visual column is titled; its cells announce as empty, which is correct — they are a
   redundant rendering of the neighbouring Probability cell.

4. **Gate discipline (TBL-04) is expressed as one shared predicate.** `categoryShares()`
   returns all-zero shares under exactly the condition `formatPct` returns `'—'`
   (`pending || trialsCompleted === 0`). This is testable as an implication:
   *for every row, pct === '—' implies width === '0.0%'*. Bars can never hold a stale shape
   while cards fly.

5. **Settled = derived, no store change.** `done && !pending && trialsCompleted > 0`, read
   off the existing `oddsStore.done`. Affordance: a hairline (`--accent-border`) under the
   trial count, driven purely from a `.odds-panel--settled` class on the panel — so
   `WinTieLossDisplay.tsx` is not edited at all. Quiet, one declaration, zero new colours.

6. **Leading emphasis.** `count === max` gets `var(--accent)`; everyone else gets
   `var(--accent-bg)` layered over `var(--background-color: var(--border))`. Exact ties both
   lead — deterministic and honest, no arbitrary first-wins tiebreak.

## Tasks

- **T1** — `src/ui/categoryShares.ts`: pure `categoryShares(counts, rowCount, trialsCompleted,
  pending)` → `{ share, leading }[]`, plus `shareWidth(share)` → 1dp percentage string.
  Row count comes from the LABEL source (never `counts.length`), so a stray 11-entry snapshot
  at one deck cannot set the max for a ten-row table. `commit: feat(ui)`
- **T2** — `src/ui/categoryShares.test.ts`: unit + property coverage of the pure function.
  `commit: test(ui)`
- **T3** — `OddsTable.tsx`: `Share` column between `<th>` label and the percentage cell;
  `data-testid="category-bar-{index}"` on each fill. `commit: feat(ui)`
- **T4** — `App.css`: `.category-table__share`, `.category-bar`, `.category-bar__fill`,
  `--leading` modifier, the `width` transition, the `prefers-reduced-motion` opt-out, and the
  settled hairline. `commit: feat(ui)`
- **T5** — `OddsPanel.tsx`: derived settled class. `commit: feat(ui)`
- **T6** — Tests: extend `OddsTable.categoryIconCell.test.tsx` (column census 4 → 5, bar
  placement, `<th>` textContent still exactly the label) and add
  `OddsTable.shareBars.test.tsx` (proportionality, relative-to-max, leading emphasis,
  gate-pending emptiness, aria-hidden, 2-deck 11th row, reduced-motion CSS-source pin,
  negative control). Register `category-bar-0` in `HOLDEM_ONLY_TESTIDS`. `commit: test(ui)`

## Do not touch

`src/App.test.tsx`, `App.acceptance`, `App.phase3.acceptance`, `App.modeErrorBanner`,
`App.modeSwitchRace`, the three `*.golden.*` files, every blackjack file.

## Gates

`npx vitest run` · `npx tsc -b` · `npx eslint .` · `npm run build` — all clean.
No push, no git remote command. No dev server (5199 is not ours).
