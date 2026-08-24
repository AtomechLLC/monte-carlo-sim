import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import type { DeckCount } from '../engine/shoe';
import { cardCounts } from '../engine/shoe';

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

/**
 * Copies of `card` still available to the draft at `deckCount` decks (D-09). The single
 * shared source of "how many more times can this card be picked" for both `setPick`'s
 * block threshold and the picker UI's disabled-state rendering — never duplicate this
 * counting elsewhere. Reuses `cardCounts` (from `../engine/shoe`) over `pickedCards(picks)`
 * rather than a fourth hand-rolled counting loop. Clamped at 0 via `Math.max` — never
 * returns a negative count.
 */
export function remainingCopies(picks: PickerDraft, card: Card, deckCount: DeckCount = 1): number {
  const used = cardCounts(pickedCards(picks)).get(card) ?? 0;
  return Math.max(0, deckCount - used);
}

interface PickerState {
  picks: PickerDraft;
  /**
   * No-op once picks already using `card` reach `deckCount` (D-09, D-05 store-level second
   * line of defence). `deckCount` defaults to 1, matching v1's every-card-unique behaviour
   * unchanged; a caller passes 2 to admit a second physical copy of the same card value.
   */
  setPick: (slot: SlotId, card: Card, deckCount?: DeckCount) => void;
  clearSlot: (slot: SlotId) => void;
  clearAll: () => void;
}

export const usePickerStore = create<PickerState>()((set, get) => ({
  picks: { ...EMPTY_DRAFT },
  setPick: (slot, card, deckCount = 1) => {
    const { picks } = get();
    const heldByOtherSlots = SLOT_ORDER.filter((otherSlot) => otherSlot !== slot && picks[otherSlot] === card).length;
    if (heldByOtherSlots >= deckCount) return;
    set({ picks: { ...picks, [slot]: card } });
  },
  clearSlot: (slot) => {
    set((state) => ({ picks: { ...state.picks, [slot]: null } }));
  },
  clearAll: () => {
    set({ picks: { ...EMPTY_DRAFT } });
  },
}));
