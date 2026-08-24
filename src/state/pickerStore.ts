import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';

/**
 * The seven manually-pickable slots (D-07): hero hole plus all five board slots. There is
 * deliberately no slot for any opponent hole card anywhere in this union.
 */
export type SlotId = 'hero-0' | 'hero-1' | 'flop-0' | 'flop-1' | 'flop-2' | 'turn' | 'river';

/** Fixed picker slot order — matches the UI-SPEC "Hero 1, Hero 2, Flop 1, Flop 2, Flop 3, Turn, River" order. */
export const SLOT_ORDER: readonly SlotId[] = ['hero-0', 'hero-1', 'flop-0', 'flop-1', 'flop-2', 'turn', 'river'];

/** UI-SPEC copy contract — exact display label for each slot. */
export const SLOT_LABEL: Record<SlotId, string> = {
  'hero-0': 'Hero 1',
  'hero-1': 'Hero 2',
  'flop-0': 'Flop 1',
  'flop-1': 'Flop 2',
  'flop-2': 'Flop 3',
  turn: 'Turn',
  river: 'River',
};

/** The user's draft picks: one slot per `SlotId`, `null` when unset. */
export type PickerDraft = Record<SlotId, Card | null>;

const EMPTY_DRAFT: PickerDraft = {
  'hero-0': null,
  'hero-1': null,
  'flop-0': null,
  'flop-1': null,
  'flop-2': null,
  turn: null,
  river: null,
};

/**
 * Returns the non-null picks in `picks`, in `SLOT_ORDER` order. The single shared source of
 * "which cards are already used" for both the picker UI's disabled rendering and
 * `gameStore.deal()`'s random-fill pool — never duplicate this filtering elsewhere.
 */
export function pickedCards(picks: PickerDraft): Card[] {
  const result: Card[] = [];
  for (const slot of SLOT_ORDER) {
    const card = picks[slot];
    if (card !== null) result.push(card);
  }
  return result;
}

interface PickerState {
  picks: PickerDraft;
  /** No-op when `card` already occupies a DIFFERENT slot (D-05 store-level second line of defence). */
  setPick: (slot: SlotId, card: Card) => void;
  clearSlot: (slot: SlotId) => void;
  clearAll: () => void;
}

export const usePickerStore = create<PickerState>()((set, get) => ({
  picks: { ...EMPTY_DRAFT },
  setPick: (slot, card) => {
    const { picks } = get();
    const heldByAnotherSlot = SLOT_ORDER.some((otherSlot) => otherSlot !== slot && picks[otherSlot] === card);
    if (heldByAnotherSlot) return;
    set({ picks: { ...picks, [slot]: card } });
  },
  clearSlot: (slot) => {
    set((state) => ({ picks: { ...state.picks, [slot]: null } }));
  },
  clearAll: () => {
    set({ picks: { ...EMPTY_DRAFT } });
  },
}));
