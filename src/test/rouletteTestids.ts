// Single source of truth for the roulette testid DOM-absence sweep (quick task 261015-ch8) —
// the third list beside ./holdemTestids and ./blackjackTestids. App.rouletteMode.test.tsx
// sweeps every entry here for presence in roulette mode and absence in BOTH other modes, and
// sweeps the other two lists for absence in roulette mode, which together extend the both-ways
// DOM-absence contract to three games. Adding a new roulette testid is a one-line addition
// here that extends the sweep with no other edit.
//
// This module lives under src/test/ because it is test-support code with no production
// consumer (same convention as the two lists beside it).
export const ROULETTE_ONLY_TESTIDS: readonly string[] = [
  'roulette-scene',
  'roulette-empty-state',
  'roulette-wheel-toggle',
  'roulette-wheel-toggle-european',
  'roulette-wheel-toggle-american',
  'roulette-house-edge',
  'roulette-wheel',
  'roulette-wheel-pocket-0',
  'roulette-wheel-pocket-36',
  'roulette-wheel-ball',
  'roulette-last-spin',
  'roulette-layout',
  'roulette-pocket-0',
  'roulette-pocket-1',
  'roulette-pocket-36',
  'roulette-color-red',
  'roulette-color-black',
  'roulette-color-green',
  'roulette-spin-button',
  'roulette-reset-button',
  'roulette-odds-panel',
  'roulette-spin-counter',
  'roulette-edge-pct',
  'roulette-no-prediction',
  'roulette-color-score',
  'roulette-color-observed',
  'roulette-color-true',
  'roulette-color-hits',
  'roulette-color-expected',
  'roulette-color-net',
  'roulette-color-gauge-fill',
  'roulette-color-gauge-mark',
  'roulette-number-score',
  'roulette-number-observed',
  'roulette-number-true',
  'roulette-number-hits',
  'roulette-number-expected',
  'roulette-number-net',
  'roulette-number-gauge-fill',
  'roulette-number-gauge-mark',
  'roulette-landed-table',
  'roulette-landed-bar-red',
  'roulette-landed-count-red',
  'roulette-landed-pct-red',
  'roulette-landed-pct-black',
  'roulette-landed-pct-green',
  'roulette-landed-true-red',
  'roulette-history',
];
