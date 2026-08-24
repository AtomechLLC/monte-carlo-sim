# Deferred Items — Phase 03 (casino-table-ui-animation)

Items discovered during execution that are out of scope for the plan that found them (per the
executor's scope-boundary rule: only auto-fix issues directly caused by the current task's
changes).

## From 03-05 Task 2 (D-14 cosmetic debt cleanup)

- **`src/App.css`'s `#next-steps ul` block (including `.logo`, `#docs`, and a second
  `.button-icon` rule scoped under `#next-steps ul a`) is dead scaffold CSS.** No element with
  id `next-steps` or `docs`, and no element with class `logo`, exists anywhere in `src/*.tsx`
  (verified via grep during 03-05 Task 2). This is pre-existing debt inherited from the original
  Vite scaffold's "next steps" links section, unrelated to `public/icons.svg` (which this task
  did delete) — 03-05's plan text only authorized removing the `#social .button-icon` rule in
  `src/index.css`, not this separate block in `App.css`. Left untouched to stay within Task 2's
  explicit scope; a future cleanup pass (or the next phase touching `App.css`) can remove it
  safely, since it has zero DOM references today.
