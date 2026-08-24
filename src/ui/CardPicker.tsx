import { useRef, useState } from 'react';
import type { Card, Suit } from '@poker-apprentice/types';
import { ALL_RANKS, ALL_SUITS } from '@poker-apprentice/types';
import { usePickerStore, pickedCards, SLOT_ORDER, SLOT_LABEL } from '../state/pickerStore';
import type { SlotId } from '../state/pickerStore';

/** UI-SPEC A6 — full English suit-group headings, in `ALL_SUITS` order (c, d, h, s). */
const SUIT_LABEL: Record<Suit, string> = {
  c: 'Clubs',
  d: 'Diamonds',
  h: 'Hearts',
  s: 'Spades',
};

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

  // Used-elsewhere set (A7/D-05): pickedCards(picks) minus whatever the OPEN slot itself already
  // holds, so re-picking that same card into the same slot is never blocked. Reuses pickedCards
  // rather than re-deriving a second duplicate-filtering helper (Task 1 constraint).
  const usedElsewhere = new Set(pickedCards(picks));
  if (openSlot !== null) {
    const ownCard = picks[openSlot];
    if (ownCard !== null) usedElsewhere.delete(ownCard);
  }

  return (
    <div data-testid="card-picker">
      <h2>Card Picker</h2>
      {SLOT_ORDER.map((slot) => {
        const value = picks[slot];
        return (
          <span key={slot}>
            <button type="button" data-testid={`picker-slot-${slot}`} onClick={() => openPanel(slot)}>
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
                  const used = usedElsewhere.has(card);
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
