# Recommended Improvements — post-v1.0

Curated 2026-08-24 at v1.0 close, from review findings (01/02/03-REVIEW.md), the milestone audit debt register, deferred ideas in CONTEXT files, and live driving of the shipped app. Ordered by tier, then by leverage. Effort: S (< half a plan), M (a plan), L (a phase).

## Tier 1 — Robustness debt worth clearing first (small, sharp-edged)

1. **Surface hard worker crashes (WR-02, open since Phase 2).** `simulationService` handles call rejections but never subscribes to the Worker `error` event — a script-load failure in production leaves Comlink promises hanging and the odds frozen with no banner. Add the `error`/`messageerror` listeners routing into the existing `onError` path. *(S — the error-banner plumbing already exists.)*
2. **Make TypeScript strictness explicit.** `tsconfig.app.json` relies on TS 6.0.3 defaulting `strict: true`. Write it down so a future compiler-default change can't silently drop the nullability contracts the leak guards depend on (e.g. `FlipCard.card` must be `undefined` while hidden). Also remove the `"node"` types entry that leaked into the browser tsconfig. *(S)*
3. **Run the security gate retroactively.** Security enforcement is on but no phase has a SECURITY.md — `/gsd:secure-phase 1|2|3` verifies the threat-model mitigations that already exist in every PLAN. Client-only static app, so expect mostly accept-dispositions, but the gate should be green, not skipped. *(S per phase)*
4. **Real-motion E2E smoke test (Playwright).** The milestone's only critical bugs lived exactly where jsdom's forced reduced-motion couldn't see: real animation timing. One Playwright spec driving Deal → Advance → Rewind-to-preflop → Reveal → re-deal-from-river with animations ON would have caught all three deadlocks. CLAUDE.md already recommends `@playwright/test` and it was never added. *(M — highest test-leverage item on this list.)*

## Tier 1b — Defects/UX gaps found in first real user session (2026-08-24)

- **Win/tie/loss row lost its labels in the Phase 3 re-skin.** OddsPanel renders `200,00080.2%3.1%16.7%` as one unlabeled run-on string — the trial counter and three percentages need labels ("Trials / Win / Tie / Loss") and spacing. Automated walkthroughs read values via test-ids and never saw the missing visual separation. *(S — pure markup/CSS.)*
- **Category-table semantics read as "at least," but the table is exclusive-final-category.** First real user reaction: holding a locked-in trips ("should be 100% three of a kind") while the table showed 65.2%, because improvement outcomes (full house 29%, quads 4.2%, straight 1.5%) are separate rows. The math is correct and sums to 100%; the framing isn't communicated. Fix candidates: a "Final hand by the river" header/subtitle, a cumulative "at least" column or hover, and/or highlighting locked-in categories ("you already have this ✓"). Direct evidence for the EDU-02 annotations scope. *(S for the header; M for cumulative/locked-in display.)*

## Tier 2 — Product improvements that amplify the core value

5. **Convergence sparkline.** "Probability made visible" currently means numbers settling; a small live line chart of win% vs trial count would make convergence — including early jitter and the √n narrowing — literally visible. Biggest educational payoff per effort on this list. *(M)*
6. **Pre/post-reveal delta display.** The reveal mechanic's payoff is "watch information reshape the numbers," but the user must memorize the old number to feel it. Show the shift explicitly (e.g. `11.1% → 3.9% ▼` fading after a few seconds) on reveal and street changes. *(S-M)*
7. **Adjustable trial budget / convergence speed.** 200k trials converge in ~2s — almost too fast to savor the process the tool exists to teach. A speed control (or a "slow convergence" toggle throttling the chunk rate) lets learners watch the law of large numbers actually work. Keep 200k as the default. *(S-M — protocol already streams chunked snapshots.)*
8. **v2 education layer (deferred requirements EDU-01/02/03):** outs/draw callouts ("any heart gives you the flush — 9 outs, ~19.6%"), educational annotations explaining why numbers moved, and shareable scenario permalinks (URL-encoded picks + seed — the seedable RNG was built for exactly this). These are the natural v2 milestone scope via `/gsd:new-milestone`. *(L — a phase or more.)*
9. **Pick opponent hole cards in the picker.** Deliberately deferred from Phase 2; turns the tool into a full solver-style what-if explorer ("my AK vs their QQ vs two randoms"). The conditioning engine already supports known opponent holes — this is UI + store work only. *(M)*

## Tier 3 — Reach and platform

10. **Git remote + CI + deploy.** No remote exists; the app is a static bundle begging for GitHub Pages/Netlify. Repo push + a GitHub Action running `npm test`/`tsc`/`build` + Pages deploy makes it shareable with a URL — which the project's "zero install, easy to share" constraint has wanted from day one. *(S-M)*
11. **Mobile/responsive pass.** v1 is desktop-first by locked decision; the felt uses absolute positioning that will need a real small-screen layout (stacked seats or scaled felt). Do after a deploy exists, since that's when phone traffic becomes real. *(M-L)*
12. **Worker pool.** Split trials across `navigator.hardwareConcurrency` workers (CLAUDE.md flags this as the natural extension). Only worth it if a slower-device profile shows convergence lag — on desktop the single worker already saturates the 200k budget in ~2s. *(M, do on evidence not speculation)*

## Tier 4 — Small polish (batch into any touching plan)

13. Deduplicate `formatPct` across the three display components into one helper. *(S)*
14. Remove the dead scaffold CSS block (`#next-steps`/`#docs`/`.logo`) in `App.css` — already logged in `.planning/phases/03-casino-table-ui-animation/deferred-items.md`. *(S)*
15. Harden the test `matchMedia` polyfill from substring matching to proper query parsing (it currently works because Motion queries the exact boolean form). *(S)*
16. Render or remove `errorMessage` string state noted in 03-REVIEW (the banner shows a generic message; the detail string is captured but never displayed). *(S)*
17. Graceful fade for the flop→preflop full rewind (the CR-01 fix correctly disables the exit gate when the board empties; the visual now unmounts instantly rather than fading — cosmetic only). *(S-M, needs care not to re-open CR-01)*

## Suggested sequencing

- **Now (one cleanup plan):** items 1-3 + 13-16 — a single `/gsd:quick`-sized hardening pass clears every open review item.
- **Next milestone (`/gsd:new-milestone` v2):** items 5-8 as the education-layer scope, with item 4 (Playwright) as its first plan so the animation layer finally has real-motion coverage before more UI lands on it.
- **When sharing matters:** items 10-11.
