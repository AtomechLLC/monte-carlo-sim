/**
 * Duplicate-aware Hold'em evaluation over a 2-deck (104-card) shoe: a value-equality
 * duplicate gate in front of the stock evaluator, a Five of a Kind branch, a suit-remap
 * proxy, a one-suit flush scorer and an extended comparator (D-04, D-05, D-06, D-16).
 *
 * PITFALLS.md Pitfall 7 is CORRECTED by 07-RESEARCH's empirical characterization: the
 * stock evaluator's dominant failure mode on duplicate input is SILENT WRONG ANSWERS
 * (five deuces scored as High Card; malformed StraightFlush objects with 0/1/3/4-card
 * hand arrays), not a crash. That is why the gate routes on duplicate DETECTION, never
 * on crash behavior, and why every acceptance vector for this module asserts a VALUE
 * (D-16).
 *
 * This module deliberately routes every stock evaluation through `./evaluator` — the one
 * module in the codebase permitted to import the evaluator library directly (its header
 * says so). Nothing here touches that library.
 */
import type { Card } from '@poker-apprentice/types';
import { ALL_CARDS, ALL_RANKS, ALL_SUITS, getRank, getSuit } from '@poker-apprentice/types';
import { evaluateHand, compareHands, HandStrength, type Hand } from './evaluator';

/** Extends HandStrength (0-9) upward. Index 10 is the odds table's new row (D-05). */
export const FIVE_OF_A_KIND = 10;

/**
 * Closed literal union in `DeckCount`'s style in `./shoe` — never a wider number type.
 */
export type ExtendedStrength = HandStrength | 10;

export interface HandTwoDeck {
  strength: ExtendedStrength;
  /** Best-5 card list. On the proxy path this MAY contain a SYNTHETIC card (a remapped
   *  suit) — display-only, consumed by nothing today. Never feed it into physical-card
   *  accounting and never into the library comparator (07-RESEARCH Pitfall 5). */
  hand: Card[];
  /** Present ONLY on custom-scored hands (Five of a Kind, dup-flush): the within-category
   *  tiebreak vector as rank INDICES descending (2 -> 0 ... A -> 12). Absent means the
   *  result is stock-shaped and stock-comparable. */
  tiebreak?: number[];
}

// ---------------------------------------------------------------------------
// Module-scope lookup tables, built ONCE at load by iterating ALL_CARDS. `getRank` and
// `getSuit` validate and throw on every invocation, so calling them per card inside the
// trial-loop hot path would be measurable waste across a 200k-trial run — they are never
// called below this block.
// ---------------------------------------------------------------------------

// Every straight and tiebreak computation below depends on ALL_RANKS being the 13 ranks
// ascending 2..A. Pinning it here turns a silent upstream reorder into a loud startup
// failure instead of wrong probabilities.
const RANKS_ASCENDING: readonly string[] = ALL_RANKS;
if (RANKS_ASCENDING.length !== 13 || RANKS_ASCENDING[0] !== '2' || RANKS_ASCENDING[12] !== 'A') {
  throw new Error(
    'evaluatorTwoDeck: ALL_RANKS must be the 13 ranks ascending 2..A — rank-index arithmetic below depends on that ordering',
  );
}

const CARD_INDEX = new Map<Card, number>();
const RANK_OF = new Int8Array(52);
const SUIT_OF = new Int8Array(52);
/** (rankIndex, suitIndex) -> card, for the proxy builder and the flush scorer. */
const CARD_AT: Card[][] = [];
for (let r = 0; r < 13; r += 1) {
  CARD_AT.push(new Array<Card>(4));
}
for (let i = 0; i < ALL_CARDS.length; i += 1) {
  const card = ALL_CARDS[i];
  const rankIndex = ALL_RANKS.indexOf(getRank(card));
  const suitIndex = ALL_SUITS.indexOf(getSuit(card));
  CARD_INDEX.set(card, i);
  RANK_OF[i] = rankIndex;
  SUIT_OF[i] = suitIndex;
  CARD_AT[rankIndex][suitIndex] = card;
}

/**
 * Total over the closed `Card` union by construction (CARD_INDEX is built from ALL_CARDS
 * above), so the throw is an unreachable type-narrowing guard, not a real runtime path.
 */
function cardIndexOf(card: Card): number {
  const idx = CARD_INDEX.get(card);
  if (idx === undefined) {
    throw new Error(`evaluatorTwoDeck: unknown card ${String(card)}`);
  }
  return idx;
}

/** Same unreachable-guard treatment for the (rank, suit) -> card table. */
function cardAt(rankIndex: number, suitIndex: number): Card {
  const card = CARD_AT[rankIndex][suitIndex];
  if (card === undefined) {
    throw new Error(`evaluatorTwoDeck: no card at rank ${String(rankIndex)} suit ${String(suitIndex)}`);
  }
  return card;
}

// ---------------------------------------------------------------------------
// The duplicate gate: a module-scope stamped Int32Array(52) plus a generation counter —
// zero allocation per evaluation call, no clearing between calls. The same single pass
// accumulates rank and suit counts so the Five of a Kind and flush-zone branches need no
// second scan. The counting buffers are cleared by the same generation-stamp trick,
// mirroring `createDrawer`'s reused-working-array discipline in ./rng. Never a
// value-membership collection here: a card VALUE is a COUNT in this codebase (DECK-01).
//
// The stamped array is safe as module state because this module is single-threaded (one
// worker and the main thread each load their own module instance) and Vitest isolates
// run in separate processes.
// ---------------------------------------------------------------------------

const stamps = new Int32Array(52);
let generation = 0;

const rankCounts = new Int32Array(13);
const rankCountStamp = new Int32Array(13);
const suitCounts = new Int32Array(4);
const suitCountStamp = new Int32Array(4);

let scanFoundDuplicate = false;
/** Bitmask of suit indices in which a duplicated VALUE was detected this scan. */
let dupSuitMask = 0;

const GENERATION_MAX = 0x7fffffff;

function beginScan(): void {
  // Guard the counter against Int32 overflow: a wrapped generation reading a stale stamp
  // would report a phantom duplicate — so at the ceiling, zero every stamp buffer and
  // restart the counter from scratch.
  if (generation >= GENERATION_MAX) {
    stamps.fill(0);
    rankCountStamp.fill(0);
    suitCountStamp.fill(0);
    generation = 0;
  }
  generation += 1;
  scanFoundDuplicate = false;
  dupSuitMask = 0;
}

function scanCard(card: Card): void {
  const idx = cardIndexOf(card);
  if (stamps[idx] === generation) {
    // The same VALUE (rank AND suit) already appeared in this window. Value-equality
    // detection, never rank-count-only: a rank-count-only gate would pass every smoke
    // test while silently mis-scoring ~17.7% of duplicate windows (D-04, 07-RESEARCH).
    scanFoundDuplicate = true;
    dupSuitMask |= 1 << SUIT_OF[idx];
  } else {
    stamps[idx] = generation;
  }
  const r = RANK_OF[idx];
  if (rankCountStamp[r] !== generation) {
    rankCountStamp[r] = generation;
    rankCounts[r] = 0;
  }
  rankCounts[r] += 1;
  const s = SUIT_OF[idx];
  if (suitCountStamp[s] !== generation) {
    suitCountStamp[s] = generation;
    suitCounts[s] = 0;
  }
  suitCounts[s] += 1;
}

/** Stamp-aware read: a stale (previous-generation) count reads as 0. */
function rankCountOf(rankIndex: number): number {
  return rankCountStamp[rankIndex] === generation ? rankCounts[rankIndex] : 0;
}

function suitCountOf(suitIndex: number): number {
  return suitCountStamp[suitIndex] === generation ? suitCounts[suitIndex] : 0;
}

// ---------------------------------------------------------------------------
// Proxy-builder working buffers (dup branch only, ~19% of 2-deck evaluations; reused
// across calls — single-threaded, see the gate comment above).
// ---------------------------------------------------------------------------

const origSuitCounts = new Int32Array(4);
const proxySuitCounts = new Int32Array(4);
/** Bitmask of suits holding each rank in the proxy under construction. */
const rankSuitPresence = new Int32Array(13);
/** Window positions (0-1 hole, 2+ community) of duplicate copies; a 7-card window holds at most 3. */
const dupPositions = new Int32Array(7);

/**
 * Wheel-aware straight detection over a 13-entry distinct-rank presence array (1 =
 * present). Returns the straight's high-card rank index, or -1 when no straight exists.
 * The wheel A-5-4-3-2 is checked explicitly and ranks as the LOWEST straight (high card
 * the 5, index 3). A duplicate copy never extends a straight — straights and straight
 * flushes require five DISTINCT consecutive ranks, which is why only distinct-rank
 * presence (never physical multiplicity) feeds this function.
 */
function straightHighFromPresence(present: Int32Array): number {
  for (let high = 12; high >= 4; high -= 1) {
    let run = true;
    for (let r = high; r > high - 5; r -= 1) {
      if (present[r] === 0) {
        run = false;
        break;
      }
    }
    if (run) return high;
  }
  if (present[12] !== 0 && present[0] !== 0 && present[1] !== 0 && present[2] !== 0 && present[3] !== 0) {
    return 3; // the wheel: A plays low, the 5 is the high card
  }
  return -1;
}

/** Reused presence buffer for straight checks (flush scorer + comparator, cold paths). */
const straightPresence = new Int32Array(13);

/** The first five physical cards of `rankIndex` found in the window, hole first. */
function firstFiveOfRank(rankIndex: number, holeCards: readonly Card[], communityCards: readonly Card[]): Card[] {
  const hand: Card[] = [];
  for (let i = 0; i < holeCards.length && hand.length < 5; i += 1) {
    if (RANK_OF[cardIndexOf(holeCards[i])] === rankIndex) hand.push(holeCards[i]);
  }
  for (let i = 0; i < communityCards.length && hand.length < 5; i += 1) {
    if (RANK_OF[cardIndexOf(communityCards[i])] === rankIndex) hand.push(communityCards[i]);
  }
  return hand;
}

/**
 * Builds the suit-remap PROXY (07-RESEARCH decision-tree step 3): every duplicate COPY
 * (the second occurrence of a value, never the first) is substituted by the same rank in
 * an unused suit, preserving each card's hole-versus-community position so the proxy is
 * still a legal `evaluateHand` input.
 *
 * Existence proof: a rank with count k <= 4 occupying d distinct suits needs k - d
 * substitutions into its 4 - d free suits, and k <= 4 implies k - d <= 4 - d.
 *
 * The keep-cards are counted in FULL before any substitution target is chosen: choosing
 * from prefix-only counts could steer a substitution into a suit that later keep-cards
 * fill to 5 (a phantom flush the true window does not hold). With full-window counts,
 * picking the free suit with the LOWEST current proxy suit count (ties -> lowest suit
 * index, deterministic) makes a manufactured 5-card suit impossible by pigeonhole
 * (07-RESEARCH step-5 exactness proof); the step-5 assertion downstream re-checks it.
 */
function buildProxy(
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[],
): { hole: [Card, Card]; community: Card[] } {
  proxySuitCounts.fill(0);
  rankSuitPresence.fill(0);

  const windowSize = 2 + communityCards.length;
  beginScan(); // fresh generation for the classify pass; the caller snapshotted its counts
  let dupCount = 0;
  for (let i = 0; i < windowSize; i += 1) {
    const card = i < 2 ? holeCards[i] : communityCards[i - 2];
    const idx = cardIndexOf(card);
    if (stamps[idx] === generation) {
      dupPositions[dupCount] = i;
      dupCount += 1;
    } else {
      stamps[idx] = generation;
      proxySuitCounts[SUIT_OF[idx]] += 1;
      rankSuitPresence[RANK_OF[idx]] |= 1 << SUIT_OF[idx];
    }
  }

  const proxyHole: [Card, Card] = [holeCards[0], holeCards[1]];
  const proxyCommunity = communityCards.slice();
  for (let d = 0; d < dupCount; d += 1) {
    const pos = dupPositions[d];
    const card = pos < 2 ? holeCards[pos] : communityCards[pos - 2];
    const r = RANK_OF[cardIndexOf(card)];
    let chosen = -1;
    for (let s = 0; s < 4; s += 1) {
      if ((rankSuitPresence[r] & (1 << s)) !== 0) continue; // suit already holds this rank
      if (chosen === -1 || proxySuitCounts[s] < proxySuitCounts[chosen]) chosen = s;
    }
    if (chosen === -1) {
      // Unreachable while rank counts are <= 4 (the Five of a Kind branch runs first).
      throw new Error('evaluatorTwoDeck: no free suit for a proxy substitution — internal bug');
    }
    const substitute = cardAt(r, chosen);
    if (pos < 2) {
      proxyHole[pos] = substitute;
    } else {
      proxyCommunity[pos - 2] = substitute;
    }
    proxySuitCounts[chosen] += 1;
    rankSuitPresence[r] |= 1 << chosen;
  }
  return { hole: proxyHole, community: proxyCommunity };
}

/**
 * Scores ONE suit's physical cards as a flush-family hand (07-RESEARCH decision-tree
 * step 6). Straight and royal detection runs over the suit's DISTINCT ranks; the plain
 * flush tiebreak is the top five entries of the suit's physical rank MULTISET,
 * descending.
 *
 * That multiset tiebreak is Assumption A1 — a DEFINED working convention with no
 * published rulebook behind it (wild-card rules prohibit duplicate hands outright),
 * chosen because it reduces exactly to stock kicker order on clean hands and keeps a
 * real physical flush like `Ah Ah 2h 3h 4h` from being demoted to One Pair.
 */
function scoreFlushSuit(
  suitIndex: number,
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[],
): HandTwoDeck {
  const suitRanks: number[] = [];
  for (let i = 0; i < 2; i += 1) {
    const idx = cardIndexOf(holeCards[i]);
    if (SUIT_OF[idx] === suitIndex) suitRanks.push(RANK_OF[idx]);
  }
  for (let i = 0; i < communityCards.length; i += 1) {
    const idx = cardIndexOf(communityCards[i]);
    if (SUIT_OF[idx] === suitIndex) suitRanks.push(RANK_OF[idx]);
  }

  straightPresence.fill(0);
  for (const r of suitRanks) straightPresence[r] = 1;
  const high = straightHighFromPresence(straightPresence);

  if (high === 12) {
    // A-K-Q-J-T of one suit: Royal Flush (D-05's ladder keeps it at strength 9).
    return { strength: HandStrength.RoyalFlush, hand: straightFlushHand(suitIndex, 12), tiebreak: [12] };
  }
  if (high >= 0) {
    return { strength: HandStrength.StraightFlush, hand: straightFlushHand(suitIndex, high), tiebreak: [high] };
  }

  const ranksDesc = suitRanks.sort((a, b) => b - a);
  const tiebreak = ranksDesc.slice(0, 5);
  const hand = tiebreak.map((r) => cardAt(r, suitIndex));
  return { strength: HandStrength.Flush, hand, tiebreak };
}

/** The 5 physical cards of a straight flush, high card first (wheel-aware). */
function straightFlushHand(suitIndex: number, high: number): Card[] {
  if (high === 3) {
    // The wheel: 5-4-3-2-A, the ace playing LOW.
    return [cardAt(3, suitIndex), cardAt(2, suitIndex), cardAt(1, suitIndex), cardAt(0, suitIndex), cardAt(12, suitIndex)];
  }
  const hand: Card[] = [];
  for (let r = high; r > high - 5; r -= 1) {
    hand.push(cardAt(r, suitIndex));
  }
  return hand;
}

/**
 * Evaluates the best 5-card PHYSICAL hand from a 2-deck window (07-RESEARCH's validated
 * decision tree, one branch per numbered step).
 */
export function evaluateHandTwoDeck(holeCards: [Card, Card], communityCards: Card[]): HandTwoDeck {
  beginScan();
  scanCard(holeCards[0]);
  scanCard(holeCards[1]);
  for (const card of communityCards) {
    scanCard(card);
  }

  // (1) No duplicate value: return the stock result, unchanged (D-04, D-11). A 1-deck
  // trial never reaches even this branch — `runTrials` hoists the evaluator-function
  // selection (plan 07-03), so the 1-deck path pays neither the gate nor this delegate.
  if (!scanFoundDuplicate) {
    return evaluateHand(holeCards, communityCards);
  }

  // (2) Five of a Kind (D-05): some rank has count >= 5. Rank count >= 5 for TWO ranks
  // in one window is impossible (5 + 5 = 10 > 7 cards), so this detection is unique per
  // window. The stock evaluator's behavior on these inputs is undefined — five aces
  // throw, five deuces silently score High Card (D-16) — which is why this branch never
  // consults it.
  for (let r = 12; r >= 0; r -= 1) {
    if (rankCountOf(r) >= 5) {
      return {
        strength: FIVE_OF_A_KIND,
        hand: firstFiveOfRank(r, holeCards, communityCards),
        tiebreak: [r],
      };
    }
  }

  // Snapshot the ORIGINAL window's suit facts before the proxy builder's classify pass
  // advances the generation (the counting buffers are generation-stamped). At most one
  // suit can hold >= 5 physical cards (5 + 5 = 10 > 7), and a duplicated value always
  // shares its twin's suit, so "the flush zone" is well-defined.
  let flushSuit = -1;
  for (let s = 0; s < 4; s += 1) {
    origSuitCounts[s] = suitCountOf(s);
    if (origSuitCounts[s] >= 5) flushSuit = s;
  }
  const dupInFlushSuit = flushSuit >= 0 && (dupSuitMask & (1 << flushSuit)) !== 0;

  // (3) + (4) Build the suit-remap proxy and evaluate it through the stock evaluator —
  // a legal input by construction, so all rank-category results and kickers come back
  // with v1 semantics.
  const proxy = buildProxy(holeCards, communityCards);
  const proxyResult: HandTwoDeck = evaluateHand(proxy.hole, proxy.community);

  if (!dupInFlushSuit) {
    // (5) EXACT: rank multiplicities are preserved by construction, and the proxy can
    // neither create nor destroy a flush here (07-RESEARCH's pigeonhole proof).
    // Defense-in-depth, mandated by 07-RESEARCH: a proxy suit reaching 5 that was not
    // already >= 5 in the original window can only mean an internal bug in the
    // substitution choice — throwing loudly beats silently mis-scoring.
    for (let s = 0; s < 4; s += 1) {
      if (proxySuitCounts[s] >= 5 && origSuitCounts[s] < 5) {
        throw new Error(
          'evaluatorTwoDeck: proxy manufactured a 5-card suit absent from the original window — internal bug',
        );
      }
    }
    return proxyResult;
  }

  // (6) FLUSH ZONE: the duplicated value sits inside the unique >= 5-physical-card suit,
  // so no legal proxy preserves flush semantics — score that one suit's physical cards
  // directly and return whichever of the custom score and the proxy result ranks higher.
  // The max step is what lets a rank hand (e.g. quads alongside 5 physical hearts)
  // legitimately beat the flush; the proxy's own flush component is always dominated by
  // the custom score, so max is exact.
  const custom = scoreFlushSuit(flushSuit, holeCards, communityCards);
  return compareHandsTwoDeck(custom, proxyResult) > 0 ? custom : proxyResult;
}

// ---------------------------------------------------------------------------
// The extended comparator.
// ---------------------------------------------------------------------------

const flushVectorA = new Int32Array(5);
const flushVectorB = new Int32Array(5);

/**
 * Fills `out` with a hand's 5-rank descending flush vector: the custom `tiebreak` when
 * present, otherwise derived from the (stock-shaped) hand array — identical to the
 * library's flush-kicker order, so mixing stock and custom flushes stays consistent.
 */
function fillFlushVector(h: HandTwoDeck, out: Int32Array): void {
  if (h.tiebreak !== undefined) {
    for (let i = 0; i < 5; i += 1) out[i] = h.tiebreak[i];
    return;
  }
  for (let i = 0; i < 5; i += 1) {
    const r = RANK_OF[cardIndexOf(h.hand[i])];
    let j = i;
    while (j > 0 && out[j - 1] < r) {
      out[j] = out[j - 1];
      j -= 1;
    }
    out[j] = r;
  }
}

/** A Five of a Kind's rank index — always carried in `tiebreak` (custom-only category). */
function fiveOfAKindRank(h: HandTwoDeck): number {
  if (h.tiebreak === undefined) {
    throw new Error('evaluatorTwoDeck: a Five of a Kind result must carry its tiebreak vector — internal bug');
  }
  return h.tiebreak[0];
}

/**
 * A straight flush's high-card rank, wheel-aware. For a stock-shaped hand the high is
 * defensively RECOMPUTED from the 5 cards' ranks — the library's hand-array ordering is
 * not trusted (07-RESEARCH comparator spec).
 */
function straightFlushHighOf(h: HandTwoDeck): number {
  if (h.tiebreak !== undefined) return h.tiebreak[0];
  straightPresence.fill(0);
  for (const card of h.hand) straightPresence[RANK_OF[cardIndexOf(card)]] = 1;
  const high = straightHighFromPresence(straightPresence);
  if (high < 0) {
    throw new Error('evaluatorTwoDeck: StraightFlush hand array lacks five consecutive distinct ranks — internal bug');
  }
  return high;
}

/**
 * Compares two evaluated hands with the same +1/0/-1 convention as `compareHands` in
 * ./evaluator, including its never-`-0` discipline: `+1` when `a` is the stronger hand,
 * `-1` when weaker, exactly `0` on a tie.
 */
export function compareHandsTwoDeck(a: HandTwoDeck, b: HandTwoDeck): number {
  // Strength first (numeric). This comparison is precisely where "Five of a Kind above
  // Royal Flush" is enforced (D-05): index 10 tops the stock 0-9 range, consistent with
  // the stock comparator's cross-category ordering.
  if (a.strength !== b.strength) {
    return a.strength > b.strength ? 1 : -1;
  }

  // Both stock-shaped: delegate to the stock comparator so clean-vs-clean and
  // proxy-vs-proxy comparisons stay byte-consistent with v1 semantics. A
  // duplicate-containing hand array is NEVER handed to the library comparator — some
  // shapes happen to work today, but that behavior is out of contract (07-RESEARCH
  // Anti-Patterns); custom-scored hands always carry `tiebreak` and are compared below.
  if (a.tiebreak === undefined && b.tiebreak === undefined) {
    if (a.strength === FIVE_OF_A_KIND) {
      throw new Error('evaluatorTwoDeck: a Five of a Kind result must carry its tiebreak vector — internal bug');
    }
    return compareHands(a as Hand, b as Hand);
  }

  // Equal strength, at least one side custom-scored.
  if (a.strength === FIVE_OF_A_KIND) {
    // By rank only: "between fives of a kind, the higher beats the lower" (pagat's
    // wild-card convention, adopted by D-05). A 5-card hand has no kicker slot, so
    // equal ranks tie exactly.
    const ra = fiveOfAKindRank(a);
    const rb = fiveOfAKindRank(b);
    if (ra === rb) return 0;
    return ra > rb ? 1 : -1;
  }
  if (a.strength === HandStrength.Flush) {
    // Lexicographic on the 5-rank descending vectors — Assumption A1's multiset order,
    // which reduces exactly to stock kicker order on clean hands.
    fillFlushVector(a, flushVectorA);
    fillFlushVector(b, flushVectorB);
    for (let i = 0; i < 5; i += 1) {
      if (flushVectorA[i] !== flushVectorB[i]) {
        return flushVectorA[i] > flushVectorB[i] ? 1 : -1;
      }
    }
    return 0;
  }
  if (a.strength === HandStrength.StraightFlush) {
    const ha = straightFlushHighOf(a);
    const hb = straightFlushHighOf(b);
    if (ha === hb) return 0;
    return ha > hb ? 1 : -1;
  }
  if (a.strength === HandStrength.RoyalFlush) {
    // Royal versus Royal is always a tie.
    return 0;
  }
  // Custom tiebreaks exist ONLY on Five of a Kind and the dup-flush zone categories
  // (Flush, StraightFlush, RoyalFlush) — reaching here means malformed input.
  throw new Error('evaluatorTwoDeck: unexpected custom tiebreak on a rank-category hand — internal bug');
}

// ---------------------------------------------------------------------------
// Test-only escape hatches, in `rawCompareForTesting`'s house style (./evaluator).
// ---------------------------------------------------------------------------

/**
 * Exposes the duplicate gate's verdict for `evaluatorTwoDeck.test.ts`'s exhaustive
 * shape sweep and for the property suites' gate-totality check ONLY. No production
 * call site may use this — the gate runs inside `evaluateHandTwoDeck` itself.
 */
export function findDuplicatesForTesting(cards: readonly Card[]): boolean {
  beginScan();
  for (const card of cards) {
    scanCard(card);
  }
  return scanFoundDuplicate;
}

/**
 * Forces the gate's generation counter for `evaluatorTwoDeck.test.ts`'s overflow-wrap
 * regression ONLY. No other call site may use this.
 */
export function setGenerationForTesting(value: number): void {
  generation = value;
}
