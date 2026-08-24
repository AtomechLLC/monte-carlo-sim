// Single source of truth for the Blackjack testid DOM-absence sweep (D-14, BJ-01 symmetry):
// the mirror image of ./holdemTestids — that list sweeps Hold'em testids for absence in
// Blackjack mode, THIS list sweeps blackjack-* testids for absence in Hold'em mode. The two
// lists sweep in opposite directions and together enforce the both-ways DOM-absence contract
// (05/06-UI-SPEC: neither game's testids may exist while the other is active). Adding a new
// blackjack testid is a one-line addition here that extends the sweep with no other edit.
//
// This module lives under src/test/ because it is test-support code with no production
// consumer (same convention as ./holdemTestids and ./setup).

// Transcribed from 06-UI-SPEC.md "Testids — NEW this phase" (the source-of-truth table),
// plus the two RETAINED Phase 5 testids that are blackjack-only even though they predate
// this phase: `blackjack-scene` (now the felt root on BlackjackTable) and
// `blackjack-empty-state` (now the page-level A10 idle block on BlackjackGame).
export const BLACKJACK_ONLY_TESTIDS: readonly string[] = [
  'blackjack-scene',
  'blackjack-empty-state',
  'blackjack-deal-button',
  'blackjack-hit-button',
  'blackjack-stand-button',
  'blackjack-deck-toggle',
  'blackjack-deck-toggle-1',
  'blackjack-deck-toggle-2',
  'blackjack-dealer-area',
  'blackjack-dealer-cards',
  'blackjack-hole-reveal',
  'blackjack-dealer-label',
  'blackjack-dealer-total',
  'blackjack-player-area',
  'blackjack-player-cards',
  'blackjack-player-label',
  'blackjack-player-total',
  'blackjack-deck-origin',
  'blackjack-outcome-banner',
  'blackjack-odds-panel',
  'blackjack-trial-counter',
  'blackjack-bust-pct',
  'blackjack-stand-win-pct',
  'blackjack-stand-push-pct',
  'blackjack-stand-lose-pct',
  'blackjack-ev-stand',
  'blackjack-ev-hit',
  'blackjack-dealer-table',
  'blackjack-dealer-pct-17',
  'blackjack-dealer-pct-18',
  'blackjack-dealer-pct-19',
  'blackjack-dealer-pct-20',
  'blackjack-dealer-pct-21',
  'blackjack-dealer-pct-natural',
  'blackjack-dealer-pct-bust',
  'blackjack-simulation-error',
  'blackjack-simulation-error-detail',
];
