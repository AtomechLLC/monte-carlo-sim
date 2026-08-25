/**
 * The two CONTRACTUAL deck-count toggle testid prefixes (Phase 8 D-02).
 *
 * D-02 makes exactly these two strings contractual — `{prefix}`, `{prefix}-1` and
 * `{prefix}-2` are depended on by the Phase 5/6/7 isolation sweeps, both testid registries and
 * every behavioural toggle suite — so the shared control's prefix prop is typed as this union
 * rather than a bare `string`. Before that, `testidPrefix="blackjck-deck-toggle"` compiled and
 * the typo surfaced only as a downstream "unable to find an element by data-testid" failure,
 * rather than at the boundary where D-02 is actually stated (08-REVIEW IN-03).
 *
 * WHY THIS LIVES IN ITS OWN MODULE rather than beside the component: `ui/DeckCountToggle.tsx`
 * is pinned by `App.modeShell.guard.test.ts` to mention neither game in any casing — that pin
 * is what enforces the 08-UI-SPEC Prop Contract's "the component contains no game-specific
 * logic" constraint (08-REVIEW WR-02). Naming the two games inside the component to type its
 * own prop would defeat it. Keeping the union here preserves both rules at once: the component
 * stays game-agnostic, and the prefixes stay a contract the type system can check.
 *
 * This module is types only — it emits no runtime code and holds no logic.
 */
export type DeckTogglePrefix = 'blackjack-deck-toggle' | 'holdem-deck-toggle';
