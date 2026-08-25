---
phase: 07-2-deck-holdem-evaluation
plan: 04
subsystem: ui
tags: [typescript, react, motion, vitest, testing-library, holdem, copy-cue, accessibility]
status: complete

# Dependency graph
requires:
  - phase: 07-2-deck-holdem-evaluation
    provides: "gameStore.deckCount (plan 07-02, D-14) — the hook's fourth selector; everything else consumed UNMODIFIED (STREET_BOARD_COUNT, isOpponentRevealed, the felt render paths)"
provides:
  - src/ui/copyCue.ts — copyCuedSlots pure canonical-scan derivation + heroCueKey/communityCueKey/opponentCueKey slot-key composers + useCopyCuedSlots memoised gameStore hook
  - src/ui/PlayingCard.tsx — optional copyCue prop; cued path renders the shipped img plus the aria-hidden ×2 badge (data-testid holdem-copy-cue) and the visually-hidden sentence
  - src/ui/Seat.tsx / src/ui/BoardDisplay.tsx / src/ui/FlipCard.tsx / src/ui/HandDisplay.tsx — all three face-up felt paths thread the cue; card-slot--cued co-applied; revealed-opponent aria-label suffix
affects: [07-05, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second-copy determination is a pure function of (runout, street, revealedMask, deckCount) over a fixed canonical scan — hero holes, board in street order, revealed opponents by SEAT index — so the badge never migrates between two visible copies (07-RESEARCH Pitfall 7)"
    - "Badge rides the card, not the slot: copyCue is content INSIDE AnimatedCard/FlipCard (fragment sibling of the shipped img), inheriting fly-in/flip/rewind-exit/restore-mount with zero gate involvement (A7)"
    - "Slot-key composers are the single bridge for cue-slot strings — call sites never hand-build them (the PlayingCard card-code-to-art discipline applied to slot keys)"

key-files:
  created:
    - src/ui/copyCue.ts
    - src/ui/copyCue.test.ts
    - src/ui/copyCueRender.test.tsx
  modified:
    - src/ui/PlayingCard.tsx
    - src/ui/FlipCard.tsx
    - src/ui/Seat.tsx
    - src/ui/HandDisplay.tsx
    - src/ui/BoardDisplay.tsx

key-decisions:
  - "copyCuedSlots signature AS SHIPPED: `copyCuedSlots(runout: PredeterminedRunout | null, street: Street, revealedMask: number, deckCount: DeckCount): ReadonlySet<string>` — slot-key formats `hero-{0|1}`, `community-{0..4}`, `opponent-{seat}-{0|1}` (built ONLY by heroCueKey/communityCueKey/opponentCueKey)"
  - "cuedSlots is an OPTIONAL Seat/FlipCard prop (absent = no cues): the shipped direct-render call sites in Seat.test.tsx/FlipCard.test.tsx stay untouched and the 1-deck output stays byte-identical without editing any existing test file"
  - "The single `new Set(` in copyCue.ts is the slot-key accumulator doubling as the early-return empty result — the value counter is a Map<Card, number> (DECK-01)"
  - "Revealed-opponent aria-label composition: 1 deck = `Opponent {n} hole cards: {c0} {c1} (revealed)` byte-identical; 2 decks appends ` — second copy of {card}` once per badged card in slot order (suffix branch unreachable at 1 deck because the cued set is empty there)"

patterns-established:
  - "Conditional-testid containment argument: holdem-copy-cue is deliberately NOT in HOLDEM_ONLY_TESTIDS (entries must be non-vacuously present after a deal); cross-mode absence is guaranteed because the cue can only render inside table-scene, which that list already pins absent in the other game's mode — reasoning recorded in copyCueRender.test.tsx's header"

requirements-completed: [HE2-03]

# Metrics
duration: 17min
completed: 2026-08-25
---

# Phase 7 Plan 04: Felt copy cue — canonical-scan derivation, ×2 badge, three render paths, aria split Summary

**The second visible copy of any duplicated card on the felt (hero hole, board, revealed opponent hole) now wears an aria-hidden ×2 badge that rides its card through every animation, driven by a pure canonical-scan derivation of (runout, street, revealedMask, deckCount) — with the badge, its `card-slot--cued` class, its testid and its screen-reader sentence fully DOM-absent at one deck, and not one felt key expression changed.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-08-25T02:04:01Z (base `4ed9d82` verified, npm ci in fresh worktree)
- **Completed:** 2026-08-25T02:21Z (final full-suite + tsc + eslint gates)
- **Tasks:** 3 (all RED→GREEN, six commits)
- **Files modified:** 8 (3 created, 5 modified — exactly the plan's files_modified list)

## Task Commits

| Task | Phase | Commit | Message |
|------|-------|--------|---------|
| 1 | RED | `a51cbc0` | test(07-04): add failing canonical-scan second-copy derivation vectors (D-08, HE2-03) |
| 1 | GREEN | `e0a6465` | feat(07-04): canonical-scan second-copy derivation for the felt copy cue (D-08, HE2-03) |
| 2 | RED | `1382e57` | test(07-04): add failing hero and board copy-cue render pins (D-08/A5/A7, HE2-03) |
| 2 | GREEN | `2011423` | feat(07-04): x2 copy-cue badge on PlayingCard, threaded through the hero and board felt paths (D-08/A5/A7, HE2-03) |
| 3 | RED | `4072772` | test(07-04): add failing revealed-opponent copy-cue and A11 aria-suffix render pins (D-08/A11, HE2-03) |
| 3 | GREEN | `68e0d01` | feat(07-04): copy cue on revealed opponent holes with the A11 aria-label suffix and both-ways DOM-absence pins (D-08/A11, HE2-03) |

## Binding contract emitted for plan 07-05 (class names + testid — do not rename)

- `.copy-cue` — the badge span itself (`<span className="copy-cue" data-testid="holdem-copy-cue" aria-hidden="true">×2</span>`)
- `.card-slot--cued` — co-applied on the AnimatedCard slot hosting a badge, always APPENDED to the shipped `card-slot card-slot--{hero|community|opponent}` classes, 2-deck only
- `.visually-hidden` — shipped class reused unchanged for the sibling sentence `Second copy — two physical copies of this card are in play`
- **This plan wrote NO CSS** — `git diff --stat 4ed9d82..HEAD` contains no `.css` file; the two new class names are an unstyled DOM contract until 07-05 styles them (the 06-05/06-06/06-07 precedent).

## Accomplishments

- **Task 1 — pure derivation (13 headless vectors):** `copyCuedSlots` runs one pass in the canonical order (hero slots 0,1 → board `0..STREET_BOARD_COUNT[street]-1` → revealed opponents ascending by seat via `isOpponentRevealed`), Map value-counter, badge on count===2. Pinned: structural deckCount-1 guard (asserted WITH a duplicate-containing runout), null-runout, street-progression + rewind in BOTH directions, board-internal dup (`community-2`), hidden-opponent leak-absence, seat-index tiebreak under two mask construction orders, three simultaneous dup values, determinism.
- **Task 2 — PlayingCard badge + hero/board threading:** the no-cue path returns the shipped `<img>` expression byte-identically (cue branch inserted ABOVE it; the original return statement is untouched in the diff); cued path is a fragment: shipped img + aria-hidden `×2` badge + visually-hidden sentence. `faceUp={false}` always short-circuits to `<CardBack />` before the cue branch. HandDisplay holds the single memoised `useCopyCuedSlots()` for all four seats; BoardDisplay holds its own. Render pins: exactly one badge, on the second hero slot / correct community index; badge is a descendant of `.card-slot`; sibling slot un-cued; rewind removes the boarded twin's badge.
- **Task 3 — opponent path + A11 split + both-ways pins:** FlipCard's additive `copyCue` prop reaches the face-up PlayingCard inside `.flip-card-face--front` (backface-visibility hides it mid-flip; the T-03-12 face-mount guard means an opponent badge can only exist after reveal — pinned by the unrevealed-seat zero-badge test). Revealed button aria-label gains ` — second copy of {card}` per badged card; exact-string pins at both deck counts; unrevealed label/title byte-identical at both counts. DOM-absence pinned both ways including the 2-decks-no-duplicate case. Gate neutrality pinned: `pendingAnimationCount` identical between a cued and an equivalent un-cued table (A7 — the badge registers nothing).

## Felt-Key Prohibition Evidence (T-07-19)

- `git diff -U0 4ed9d82..HEAD -- src/ui/Seat.tsx src/ui/BoardDisplay.tsx | grep -E '^[+-].*(key=|animationKey=|flipKey=)'` → exactly one −/+ pair: the FlipCard call-site line, where the `flipKey={flipKey}` expression is byte-identical before and after and only the additive `copyCue={cued}` prop is new. **Zero `key=` or `animationKey=` lines changed.**
- Expression-set proof: extracting every `key={...}`/`animationKey={...}`/`flipKey={...}` occurrence from base vs HEAD yields IDENTICAL sets for both `Seat.tsx` and `BoardDisplay.tsx`.
- The plan's literal verification grep (default 3-line context) matches 7 lines — all either the pair above or UNCHANGED context lines: the shipped `className` attribute sits 3 lines below `animationKey=` inside the same JSX element, so the plan-mandated `--cued` co-apply necessarily pulls those unchanged key lines into diff context. The changed-lines-only form above is the faithful execution of the acceptance criterion ("git diff shows no change to any key expression").
- `AnimatedCard.tsx` untouched (not in the diff at all).

## Deviations from Plan

**1. [Sequencing] copyCueRender.test.tsx created in Task 2 RED, extended in Task 3 RED**
- The plan's Task 3 nominally creates the file but also requires it to "cover every behavior row from BOTH Task 2 and Task 3", while Tasks 2 and 3 are each `tdd="true"`. Creating the file at Task 2 RED (hero/board/PlayingCard rows) and extending it at Task 3 RED (opponent/aria/gate rows) honors per-task RED→GREEN and lands the exact single file the plan mandates. No content deviation.

**2. [Rule 1 - Bug] Comment reword to keep the verification grep clean**
- **Found during:** plan-level verification after Task 3 GREEN
- **Issue:** a Seat.tsx comment quoted the literal `flipKey={flipKey}` token, adding a spurious diff line to the felt-key grep and a phantom entry to the expression-set extraction.
- **Fix:** reworded to describe the invariant without embedding the token; folded into the Task 3 GREEN commit via amend (`913894a` → `68e0d01`).
- **Files modified:** src/ui/Seat.tsx

**3. [Environment note] One flaky full-suite failure, not reproducible**
- The first full `vitest run` after Task 3 GREEN reported 1 failure / 794 passed; three subsequent full runs (including the final gate) were 795/795 green with no code change in between. Consistent with the documented full-suite CPU-contention flake class (07-PATTERNS §9b's timeout note); no test was modified in response.

No other deviations — the plan executed as written.

## Frozen-Artifact Confirmation

- `git diff --stat 4ed9d82..HEAD` lists exactly the eight planned files — no CSS file, no store, no engine or worker file, no `blackjack*` file.
- Both goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`), the five frozen v1 suites (`App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`) and `src/test/holdemTestids.ts` are byte-unmodified (`git diff --name-only` over that set: empty) and all ran green in the final full-suite gate.

## Test-Count Delta

- **Baseline (wave-1 HEAD `4ed9d82`):** 55 files / 764 tests.
- **After:** 57 files / **795 tests**, 0 failed, 0 skipped (+2 files, +31 tests: 13 in copyCue.test.ts, 18 in copyCueRender.test.tsx — all additive; no pre-existing test modified).
- `npx tsc --noEmit` clean; `npx eslint .` clean (zero new inline eslint-disable in the diff); `npm run build` exits 0.

## Known Stubs

None in the hardcoded-empty/placeholder sense. Two deliberate this-wave gaps, both by design:
- `.copy-cue` / `.card-slot--cued` are emitted UNSTYLED — plan 07-05 owns `App.css` and styles them (binding contract above).
- The cue is user-unreachable this wave: no UI can set `deckCount: 2` yet (07-05 ships the toggle); all coverage is store-seeded render tests, per the plan's isolation design.

## Threat Flags

None. No new surface beyond the plan's threat model: T-07-18 (unrevealed-seat zero-badge test shipped), T-07-19 (evidence section above), T-07-20 (no-cue path byte-identical + both-ways absence pins), T-07-21 (gate-neutrality pin shipped), T-07-23 (canonical scan pinned incl. seat-order tiebreak). Zero package installs (T-07-SC: `npm ci` from the committed lockfile only).

## Self-Check: PASSED

- All eight files exist on disk and match the diff scope exactly.
- All six task commits present in `git log 4ed9d82..HEAD`: a51cbc0, e0a6465, 1382e57, 2011423, 4072772, 68e0d01.
- Full suite 795/795 green; tsc, eslint, build all clean; goldens and frozen suites byte-untouched.
