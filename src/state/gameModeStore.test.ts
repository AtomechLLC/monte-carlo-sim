import { describe, it, expect, beforeEach } from 'vitest';
import { useGameModeStore } from './gameModeStore';

describe('gameModeStore — mode is the only cross-game field (D-02)', () => {
  beforeEach(() => {
    useGameModeStore.setState({ mode: 'holdem' });
  });

  it('starts with mode === "holdem"', () => {
    expect(useGameModeStore.getState().mode).toBe('holdem');
  });

  it('setMode("blackjack") then setMode("holdem") flips mode both ways', () => {
    useGameModeStore.getState().setMode('blackjack');
    expect(useGameModeStore.getState().mode).toBe('blackjack');

    useGameModeStore.getState().setMode('holdem');
    expect(useGameModeStore.getState().mode).toBe('holdem');
  });

  it('setMode with the value already in state is a harmless no-op', () => {
    useGameModeStore.getState().setMode('holdem');
    expect(useGameModeStore.getState().mode).toBe('holdem');
  });
});
