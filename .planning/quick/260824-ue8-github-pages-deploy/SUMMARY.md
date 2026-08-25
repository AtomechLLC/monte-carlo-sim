---
quick_id: 260824-ue8
slug: github-pages-deploy
date: 2026-08-25
status: complete
tasks: 2/2
key-files:
  modified:
    - vite.config.ts
    - src/ui/PlayingCard.tsx
    - src/ui/CardBack.tsx
    - src/ui/PlayingCard.test.tsx
    - .github/workflows/static.yml
---

# Quick Task Summary — GitHub Pages deployment setup

**One-liner:** The app builds and deploys to `https://atomechllc.github.io/monte-carlo-sim/` with
every asset resolving under the subpath, verified against the actual build output.

## What changed

**Task 1 — base path + BASE_URL-relative assets (commit `1e1ba22`-class, see git log)**
- `vite.config.ts` → function form: `base: command === 'build' ? '/monte-carlo-sim/' : '/'`.
  Dev and Vitest keep `'/'`.
- `cardAssetPath` and `CardBack` now prefix `import.meta.env.BASE_URL`.
- `src/ui/PlayingCard.test.tsx` gained three additive cases (non-root prefix, no doubled slash,
  card-back src, and the default-base case) under a describe block labelled DEPLOY-CRITICAL.

**Task 2 — build-and-deploy workflow**
- `.github/workflows/static.yml` keeps its filename, `name`, `on` (push→main + workflow_dispatch),
  `permissions` and `concurrency` from the repository's original commit; the job gains
  `actions/setup-node@v4` (node 24, npm cache) → `npm ci` → `npm run build`, and uploads `./dist`
  instead of `'.'`.

## Why this was not just "add a workflow"

Card art paths are composed at RUNTIME (`` `${...}cards/${suit}-${rank}.svg` ``), so Vite cannot
rewrite them the way it rewrites `index.html` references. Deployed to a project-site subpath, every
card on the felt would have requested `atomechllc.github.io/cards/...` and 404'd — a green deploy
with a visibly broken table.

## Verification (against the real build output, not assumptions)

- `dist/index.html`: `href="/monte-carlo-sim/favicon.svg"`, `src="/monte-carlo-sim/assets/index-*.js"`,
  `href="/monte-carlo-sim/assets/index-*.css"` — Vite rewrote all html refs including the favicon.
- Emitted JS contains `/monte-carlo-sim/cards` (both the face and back path builders).
- **Web Worker chunk** — the other classic subpath breakage — is also correct:
  `new Worker("/monte-carlo-sim/assets/simulation.worker-*.js")`.
- Grep for un-prefixed `"/assets/` or `"/cards/` in the built output: **none**.
- `dist/cards/` has 54 SVGs; `dist/favicon.svg` present.
- Workflow content checks: setup-node/npm ci/npm run build/upload-pages-artifact present,
  `path: './dist'`, no `path: '.'` remaining.
- Suite **919 passed / 65 files** (916 baseline + 3 additive), `tsc --noEmit` clean, `eslint` clean,
  `npm run build` clean (pre-existing chunk-size advisory only).
- Six of the seven `/cards/`-pinning test files are untouched (`git status` shows only
  `PlayingCard.test.tsx` among tests) — the frozen v1 suites were never edited.

## Deviations

1. **Executed inline rather than via worktree subagents.** Two dispatches (and two re-dispatches)
   halted with `base_mismatch`: `git worktree add` kept basing new worktrees on the stale
   `origin/main` remote-tracking ref — an orphan single-file commit — rather than the repaired local
   `main`. All four agents correctly refused to run and diagnosed it rather than improvising. The
   orchestrator executed the plan directly instead; plan artifact, atomic commits per task, and this
   SUMMARY are unchanged.
2. **History reconciliation happened first** (commit `2dbb9bc`): local history and the repository's
   `main` were unrelated (the repo held only the web-UI `Create static.yml` commit). They were joined
   with `git merge --allow-unrelated-histories`, preserving that commit rather than force-overwriting
   it, and the local branch was renamed `master` → `main` to match the remote and the workflow's
   `push: branches: ["main"]` trigger.

## Follow-ups for the repository owner (cannot be done from here)

- **Enable Pages with source = "GitHub Actions"** in Settings → Pages. Without it the workflow runs
  but the deploy step fails.
- Pages on a private repository requires a paid plan; on a public repo it just works.
