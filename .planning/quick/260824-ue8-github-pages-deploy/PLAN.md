---
quick_id: 260824-ue8
slug: github-pages-deploy
date: 2026-08-25
type: quick
autonomous: true
files_modified:
  - vite.config.ts
  - src/ui/PlayingCard.tsx
  - src/ui/CardBack.tsx
  - src/ui/PlayingCard.test.tsx
  - .github/workflows/static.yml
---

# Quick Task: GitHub Pages deployment setup

Deploy the simulator as a GitHub Pages project site at `https://atomechllc.github.io/monte-carlo-sim/`
(repo `git@github.com:AtomechLLC/monte-carlo-sim.git`).

## Why this is not just "add a workflow"

The app serves from a SUBPATH (`/monte-carlo-sim/`), but two asset families are built with
root-absolute paths that would 404 there:

1. **Runtime-constructed card SVG paths** — `cardAssetPath()` returns `/cards/S-A.svg` and
   `CardBack` hard-codes `/cards/back.svg`. Vite cannot rewrite these: they are runtime strings,
   not static imports. Every card on the felt would be a broken image.
2. **`index.html` references** — these Vite DOES rewrite with `base` at build time, so they need
   no source change (verify in the built output rather than assuming).

The orchestrator also found that the remote's existing `.github/workflows/static.yml` is GitHub's
default *static* template: it uploads the repo root with no build step, which would publish
TypeScript source instead of a working app.

## Key insight that keeps the test suite untouched

`import.meta.env.BASE_URL` is `'/'` under both `vite dev` and Vitest, and only becomes
`'/monte-carlo-sim/'` for `vite build`. Routing the asset paths through it therefore changes
NOTHING in the test environment — the seven test files that pin literal `/cards/...` strings
(including the frozen v1 suites `App.phase3.acceptance.test.tsx` and `App.modeSwitchRace.test.tsx`,
which may not be edited) keep passing byte-untouched.

## Tasks

### Task 1 — Base path + BASE_URL-relative assets

1. `vite.config.ts`: switch to the function form so dev/test keep base `'/'`:
   `defineConfig(({ command }) => ({ base: command === 'build' ? '/monte-carlo-sim/' : '/', ... }))`.
   Plugins and the `test` block carry over unchanged.
2. `src/ui/PlayingCard.tsx` — `cardAssetPath`: return `` `${import.meta.env.BASE_URL}cards/${suit}-${rank}.svg` ``
   (`BASE_URL` always ends in `/`). Preserve the sole-constructor invariant comment and extend it to
   record WHY the base prefix is required (subpath deploy).
3. `src/ui/CardBack.tsx`: same treatment for `back.svg`.
4. `src/ui/PlayingCard.test.tsx`: ADD a case pinning the deploy-critical behavior — with
   `import.meta.env.BASE_URL` stubbed to a non-root value (`vi.stubEnv` or equivalent), `cardAssetPath`
   must emit the prefixed path and must NOT double a slash. Existing cases stay byte-unchanged.

**Verification:** `npx vitest run` green at 916 + the new case(s); `npx tsc --noEmit` clean;
`npx eslint .` clean. Confirm zero edits to the other six `/cards/`-pinning test files
(`git diff --name-only` must not list them).

### Task 2 — Build-and-deploy workflow

Adapt `.github/workflows/static.yml` (content is on `origin/main`; recreate it locally with the
adaptation). KEEP: filename, `name:`, the `on:` push-to-`main` + `workflow_dispatch` triggers, the
`permissions:` block, and the `concurrency:` block. CHANGE the job to build first:
`actions/checkout@v4` → `actions/setup-node@v4` (node-version `24`, `cache: npm`) → `npm ci` →
`npm run build` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` with
`path: './dist'` (not `'.'`) → `actions/deploy-pages@v4`.

**Verification:** `npm run build` exits 0; then assert against the BUILT output:
- `dist/index.html` references `/monte-carlo-sim/`-prefixed script/asset URLs (proves Vite rewrote
  the html refs, including the favicon).
- The emitted JS chunk contains the `/monte-carlo-sim/` base for card paths.
- `dist/cards/` exists and contains the 53 SVGs; `dist/favicon.svg` exists.
- YAML parses (node one-liner or equivalent) and the `path:` value is `./dist`.

## Constraints

- Do NOT push, do NOT add/modify git remotes, do NOT touch `origin` — the orchestrator owns that.
- Do NOT edit `.planning/STATE.md` or `ROADMAP.md`.
- Do NOT modify any existing test other than the additive `PlayingCard.test.tsx` case.
- No new dependencies.
- Atomic commit per task, conventional messages.
