// Single source of truth for the Hold'em testid DOM-absence sweeps (D-07, 05-REVIEW IN-02):
// App.modeIsolation.test.tsx and App.modeSwitch.test.tsx previously carried two hand-synced
// copies of this list that had already diverged (12 vs 29 entries) — both now import THIS
// list, so adding a new Hold'em testid is a one-line addition here that extends both sweeps
// with no other edit.
//
// This module lives under src/test/ because it is test-support code with no production
// consumer (same convention as src/test/setup.ts). Plan 06-07 adds the mirror-image
// BLACKJACK_ONLY_TESTIDS list beside it.

// UI-SPEC "Testids — MUST remain unchanged" (05-UI-SPEC.md, "Interaction States & Testid
// Contract") — every Hold'em testid re-synced from that section's source-of-truth list, so a
// newly added Hold'em testid is a one-line addition here, not a new test. `empty-hand-state` is
// included but is the one entry whose presence condition (`mode === 'holdem' && runout === null`)
// is mutually exclusive with every other entry (which all require a completed deal to be
// non-vacuously present) — see the conditional setup in App.modeIsolation.test.tsx's sweep.
export const HOLDEM_ONLY_TESTIDS: readonly string[] = [
  'table-scene',
  'odds-panel',
  'hero-hole',
  'seat-label-hero',
  'opponents',
  'opponent-seat-0',
  'opponent-seat-1',
  'opponent-seat-2',
  'seat-label-opponent-0',
  'seat-label-opponent-1',
  'seat-label-opponent-2',
  'board-cards',
  'deck-origin',
  'street-label',
  'rewind-button',
  'advance-button',
  'set-up-scenario-button',
  'empty-hand-state',
  'trial-counter',
  'win-pct',
  'tie-pct',
  'lose-pct',
  'category-table',
  'category-pct-0',
  'card-picker',
  'picker-panel',
  'picker-slot-hero-0',
  'picker-clear-hero-0',
  'picker-clear-all',
];
