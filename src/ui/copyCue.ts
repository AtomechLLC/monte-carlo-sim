import { useMemo } from 'react';
import type { Card } from '@poker-apprentice/types';
import type { PredeterminedRunout } from '../engine/conditioning';
import { isOpponentRevealed } from '../engine/conditioning';
import type { Street } from '../engine/streets';
import { STREET_BOARD_COUNT } from '../engine/streets';
import type { DeckCount } from '../engine/shoe';
import { useGameStore } from '../state/gameStore';

/**
 * The D-08/HE2-03 second-copy derivation for the felt copy cue: which slot on the felt
 * holds the SECOND visible copy of a duplicated card value at 2 decks.
 *
 * Structurally leak-proof, in lockedCategory.ts's framing: `copyCuedSlots` can only ever
 * see what its caller passes in. It reads no store, no deck and nothing hidden — an
 * unrevealed opponent's cards are simply never scanned, so a hidden duplicate can never
 * be inferred from the felt (T-07-18, the same leak class FlipCard's T-03-12 face-mount
 * guard prevents).
 *
 * The trap this module defends against is 07-RESEARCH Pitfall 7: an ad-hoc "second copy"
 * rule based on render or mount order flips which card wears the badge across re-renders
 * and reads as flicker. Here, which copy wears it is a pure function of
 * `(runout, street, revealedMask, deckCount)` over a FIXED canonical scan order, so
 * every re-render, rewind, advance and reveal recomputes the same answer.
 */

/** `0 | 1` -> `hero-{slotIndex}`. The slot-key composers below are the ONLY places these
 * strings are built — call sites derive their flags through these helpers rather than
 * hand-building template strings, so a consumer can never drift from the derivation (the
 * same single-bridge discipline PlayingCard's card-code-to-art mapping enforces). */
export function heroCueKey(slotIndex: 0 | 1): string {
  return `hero-${slotIndex}`;
}

/** Board index -> `community-{index}`. See heroCueKey's single-bridge note. */
export function communityCueKey(index: number): string {
  return `community-${index}`;
}

/** Seat + slot -> `opponent-{seatIndex}-{slotIndex}`. See heroCueKey's single-bridge note. */
export function opponentCueKey(seatIndex: number, slotIndex: 0 | 1): string {
  return `opponent-${seatIndex}-${slotIndex}`;
}

/**
 * Slot keys of every card that is the SECOND visible copy of its value, under the
 * canonical scan order: hero holes in slot order, then the board in street order, then
 * revealed opponents by SEAT index (`revealedMask` records a reveal SET, not a
 * chronology — seat order is the deterministic tiebreak). Returns an empty set at
 * deckCount 1.
 */
export function copyCuedSlots(
  runout: PredeterminedRunout | null,
  street: Street,
  revealedMask: number,
  deckCount: DeckCount,
): ReadonlySet<string> {
  // The returned Set holds SLOT identifiers (each unique by construction — one per felt
  // position), never cards, so the DECK-01 no-Set-of-cards prohibition does not apply to
  // it. It doubles as the early-return empty result below, deliberately keeping this the
  // file's only `new Set(` call.
  const cued = new Set<string>();
  // Structural absence guarantee, not an optimisation: duplicates are impossible at one
  // deck anyway, but returning early makes the 1-deck DOM-absence contract (D-11) hold
  // even for a (physically impossible) duplicate-containing runout.
  if (deckCount !== 2 || runout === null) return cued;

  // Seen-counter is a Map of VALUE counts — never a Set — because a card value is a
  // COUNT in this codebase (DECK-01): two physical copies of the same value must tally
  // as 2, which Set membership would collapse to 1.
  const seen = new Map<Card, number>();
  const visit = (card: Card, slotKey: string): void => {
    const count = (seen.get(card) ?? 0) + 1;
    seen.set(card, count);
    if (count === 2) cued.add(slotKey);
  };

  // Two behavioural consequences of this fixed scan, binding per 07-UI-SPEC: (1) a badge
  // may appear on an ALREADY-SETTLED card when a later street boards its twin (the twin,
  // later in scan, wears it) and disappears again on rewind; (2) with both copies
  // simultaneously visible, the LATER-in-scan card always wears it, so the badge never
  // migrates between two visible copies.
  visit(runout.heroHole[0], heroCueKey(0));
  visit(runout.heroHole[1], heroCueKey(1));
  const visibleBoardCount = STREET_BOARD_COUNT[street];
  for (let index = 0; index < visibleBoardCount; index++) {
    visit(runout.board[index], communityCueKey(index));
  }
  for (let seat = 0; seat < runout.opponentHoles.length; seat++) {
    if (!isOpponentRevealed(revealedMask, seat)) continue;
    visit(runout.opponentHoles[seat][0], opponentCueKey(seat, 0));
    visit(runout.opponentHoles[seat][1], opponentCueKey(seat, 1));
  }
  return cued;
}

/**
 * Memoised gameStore-subscribing wrapper for the two felt components (HandDisplay and
 * BoardDisplay). Memoising HERE is what lets both consume ONE derivation per state
 * change rather than each re-deriving the scan on every render.
 */
export function useCopyCuedSlots(): ReadonlySet<string> {
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const deckCount = useGameStore((state) => state.deckCount);
  return useMemo(
    () => copyCuedSlots(runout, street, revealedMask, deckCount),
    [runout, street, revealedMask, deckCount],
  );
}
