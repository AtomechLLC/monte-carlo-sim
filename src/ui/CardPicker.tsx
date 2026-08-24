import { useRef, useState } from 'react';
import type { Card, Suit } from '@poker-apprentice/types';
import { ALL_RANKS, ALL_SUITS } from '@poker-apprentice/types';
import { usePickerStore, pickedCards, remainingCopies, SLOT_ORDER, SLOT_LABEL } from '../state/pickerStore';
import type { SlotId } from '../state/pickerStore';
import type { DeckCount } from '../engine/shoe';

/** UI-SPEC A6 — full English suit-group headings, in `ALL_SUITS` order (c, d, h, s). */
const SUIT_LABEL: Record<Suit, string> = {
  c: 'Clubs',
  d: 'Diamonds',
  h: 'Hearts',
  s: 'Spades',
};

/**
 * Fixed deck count for this phase (D-09): the picker's blocking is count-aware but this phase
 * ships no visible UI for it, so `deckCount` stays pinned to 1 here — identical to v1's every-
 * card-unique behaviour. Phase 8 (cross-game deck-count toggle): replacing this const with a
 * `gameModeStore` read is NOT sufficient on its own — the `setPick(openSlot, card)` call below
 * MUST also pass `deckCount` as its third argument, or the store keeps blocking at its default
 * of 1 while `isUsed` shows a second copy as available (silent lost picks — 04-REVIEW WR-01).
 */
const deckCount: DeckCount = 1;

export function CardPicker() {
  const picks = usePickerStore((state) => state.picks);
  const setPick = usePickerStore((state) => state.setPick);
  const clearSlot = usePickerStore((state) => state.clearSlot);
  const clearAll = usePickerStore((state) => state.clearAll);

  const [openSlot, setOpenSlot] = useState<SlotId | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const anyPicked = pickedCards(picks).length > 0;

  function openPanel(slot: SlotId) {
    setOpenSlot(slot);
    dialogRef.current?.showModal();
  }

  function handlePick(card: Card) {
    if (openSlot === null) return;
    setPick(openSlot, card);
    dialogRef.current?.close();
  }

  // Count-based availability (A7/D-09): remainingCopies(picks, card, deckCount) counts every
  // slot's pick against `card` at the current deckCount, then the OPEN slot's own pick is added
  // back so re-picking that same card into the same slot is never blocked. Reuses
  // remainingCopies rather than re-deriving a second duplicate-counting helper (Task 1
  // constraint) — no value-based Set of card values survives in the picker path.
  const ownCard = openSlot !== null ? picks[openSlot] : null;
  function isUsed(card: Card): boolean {
    let available = remainingCopies(picks, card, deckCount);
    if (ownCard === card) available += 1;
    return available <= 0;
  }

  return (
    <div data-testid="card-picker">
      <h2>Card Picker</h2>
      {SLOT_ORDER.map((slot) => {
        const value = picks[slot];
        return (
          <span key={slot}>
            <button type="button" data-testid={`picker-slot-${slot}`} className={value !== null ? 'picker-slot-filled' : undefined} onClick={() => openPanel(slot)}>
              {SLOT_LABEL[slot]}: {value ?? '—'}
            </button>
            <button
              type="button"
              data-testid={`picker-clear-${slot}`}
              onClick={() => clearSlot(slot)}
              disabled={value === null}
            >
              Clear
            </button>
          </span>
        );
      })}
      <button type="button" data-testid="picker-clear-all" onClick={clearAll} disabled={!anyPicked}>
        Clear All
      </button>

      {/* Native modal <dialog> (UI-SPEC A4): built-in focus trap, focus restoration, and
          Escape-to-close for free — no custom focus trap or cancel-event interception added. */}
      <dialog ref={dialogRef} data-testid="picker-panel" onClose={() => setOpenSlot(null)}>
        {openSlot !== null && (
          <>
            <h2>Pick a card for {SLOT_LABEL[openSlot]}</h2>
            {ALL_SUITS.map((suit) => (
              <div key={suit}>
                <h3>{SUIT_LABEL[suit]}</h3>
                {ALL_RANKS.map((rank) => {
                  const card = `${rank}${suit}` as Card;
                  const used = isUsed(card);
                  return (
                    <button
                      key={card}
                      type="button"
                      data-testid={`picker-card-${card}`}
                      disabled={used}
                      title={used ? 'Already used in this hand' : undefined}
                      onClick={() => handlePick(card)}
                    >
                      {used ? `${card} (used)` : card}
                    </button>
                  );
                })}
              </div>
            ))}
            <button type="button" onClick={() => dialogRef.current?.close()}>
              Cancel Pick
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
