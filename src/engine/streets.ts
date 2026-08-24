/** The four visible-information stages of a Hold'em hand, in dealing order. */
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

/** `Street` values in dealing order — preflop first, river last. */
export const STREET_ORDER: readonly Street[] = ['preflop', 'flop', 'turn', 'river'];

/** Number of community board cards visible at each street. */
export const STREET_BOARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

/** UI-SPEC copy contract — exact display label for each street. */
export const STREET_LABEL: Record<Street, string> = {
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

/** Returns the next street in `STREET_ORDER`, clamping at `'river'`. */
export function nextStreet(street: Street): Street {
  const index = STREET_ORDER.indexOf(street);
  return STREET_ORDER[Math.min(index + 1, STREET_ORDER.length - 1)];
}

/** Returns the previous street in `STREET_ORDER`, clamping at `'preflop'`. */
export function previousStreet(street: Street): Street {
  const index = STREET_ORDER.indexOf(street);
  return STREET_ORDER[Math.max(index - 1, 0)];
}
