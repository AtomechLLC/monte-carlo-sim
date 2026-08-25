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

/**
 * The 2-deck row source (D-05, D-09 as amended post-research): the shipped ten labels plus
 * the extended index-10 label. DERIVED by spreading `CATEGORY_LABELS` — never a second
 * hand-written list, so the ten shared labels can never drift (the derived-constant
 * discipline of `../worker/blackjackProtocol`'s `BUCKET_INDEX`). The new label sits at the
 * STRENGTH END because the shipped table renders ascending (High Card first, Royal Flush
 * last), so "ranks above Royal Flush" means the LAST DOM row rather than the first. Used
 * ONLY where `deckCount === 2` flows — every 1-deck surface keeps reading `CATEGORY_LABELS`.
 *
 * WARNING: widening `CATEGORY_LABELS` itself is FORBIDDEN. A frozen v1 suite renders the
 * 1-deck table and compares the rendered rows against the WHOLE constant, so an eleventh
 * entry there reds an untouchable file. Extended labels belong here, in the derived
 * constant, and nowhere else.
 */
export const CATEGORY_LABELS_TWO_DECK: readonly string[] = [...CATEGORY_LABELS, 'Five of a Kind'];
