import { describe, it, expect, beforeEach } from 'vitest';
import { usePickerStore, pickedCards, SLOT_ORDER, SLOT_LABEL } from './pickerStore';

const EMPTY_PICKS = {
  'hero-0': null,
  'hero-1': null,
  'flop-0': null,
  'flop-1': null,
  'flop-2': null,
  turn: null,
  river: null,
} as const;

describe('pickerStore — seven-slot draft with duplicate rejection', () => {
  beforeEach(() => {
    usePickerStore.setState({ picks: { ...EMPTY_PICKS } });
  });

  it('starts with all seven slots null and pickedCards empty', () => {
    const { picks } = usePickerStore.getState();
    expect(picks).toEqual(EMPTY_PICKS);
    expect(pickedCards(picks)).toEqual([]);
  });

  it('setPick("hero-0", "As") puts As in that slot and pickedCards returns [As]', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
    expect(pickedCards(usePickerStore.getState().picks)).toEqual(['As']);
  });

  it('setPick rejects a card already held by a different slot (D-05), leaving both slots unchanged', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('flop-0', 'As');

    const { picks } = usePickerStore.getState();
    expect(picks['hero-0']).toBe('As');
    expect(picks['flop-0']).toBeNull();
  });

  it('re-picking the same card into the slot that already holds it is accepted (not a duplicate)', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-0', 'As');

    expect(usePickerStore.getState().picks['hero-0']).toBe('As');
  });

  it('setPick replaces the existing pick in the same slot, freeing the old card', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-0', 'Kd');

    expect(usePickerStore.getState().picks['hero-0']).toBe('Kd');

    // The freed 'As' can now be picked into a different slot.
    usePickerStore.getState().setPick('flop-0', 'As');
    expect(usePickerStore.getState().picks['flop-0']).toBe('As');
  });

  it('clearSlot clears only that slot', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('hero-1', 'Ah');

    usePickerStore.getState().clearSlot('hero-0');

    const { picks } = usePickerStore.getState();
    expect(picks['hero-0']).toBeNull();
    expect(picks['hero-1']).toBe('Ah');
  });

  it('clearAll clears every slot', () => {
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('turn', 'Kd');

    usePickerStore.getState().clearAll();

    expect(usePickerStore.getState().picks).toEqual(EMPTY_PICKS);
  });

  it('pickedCards returns values in SLOT_ORDER order, skipping unset slots', () => {
    usePickerStore.getState().setPick('river', 'Kd');
    usePickerStore.getState().setPick('hero-0', 'As');
    usePickerStore.getState().setPick('flop-1', '2c');

    expect(pickedCards(usePickerStore.getState().picks)).toEqual(['As', '2c', 'Kd']);
  });

  it('SLOT_LABEL values match the copy contract exactly', () => {
    expect(SLOT_LABEL).toEqual({
      'hero-0': 'Hero 1',
      'hero-1': 'Hero 2',
      'flop-0': 'Flop 1',
      'flop-1': 'Flop 2',
      'flop-2': 'Flop 3',
      turn: 'Turn',
      river: 'River',
    });
  });

  it('SLOT_ORDER has exactly 7 entries and no entry mentions an opponent (D-07)', () => {
    expect(SLOT_ORDER).toHaveLength(7);
    for (const slot of SLOT_ORDER) {
      expect(slot).not.toContain('opponent');
    }
  });
});
