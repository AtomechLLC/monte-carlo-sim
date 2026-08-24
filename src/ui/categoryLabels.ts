/**
 * Ordered display labels for each `HandStrength` value (0-9). Ten entries, not nine —
 * Royal Flush is a distinct `HandStrength` value from Straight Flush, and folding it in
 * would be invisible to every sum-to-100% check yet immediately obvious to a poker-literate
 * user who deals themselves a royal and sees it mislabeled.
 */
export const CATEGORY_LABELS: readonly string[] = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];
