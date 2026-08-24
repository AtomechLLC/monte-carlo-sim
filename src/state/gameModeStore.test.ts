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

describe('gameModeStore — holdemRestorePending marks exactly a blackjack -> holdem switch-back (05-REVIEW WR-02)', () => {
  beforeEach(() => {
    useGameModeStore.setState({ mode: 'holdem', holdemRestorePending: false });
  });

  it('starts false — an initial Hold\'em mount is not a restore', () => {
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);
  });

  it('a blackjack -> holdem transition sets it, and ackHoldemRestore clears it (idempotently)', () => {
    useGameModeStore.getState().setMode('blackjack');
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);

    useGameModeStore.getState().setMode('holdem');
    expect(useGameModeStore.getState().holdemRestorePending).toBe(true);

    useGameModeStore.getState().ackHoldemRestore();
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);
    useGameModeStore.getState().ackHoldemRestore();
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);
  });

  it('a holdem -> blackjack transition never sets it, and clears any stale pending value', () => {
    useGameModeStore.setState({ holdemRestorePending: true });
    useGameModeStore.getState().setMode('blackjack');
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);
  });

  it('a redundant setMode("holdem") while already in holdem does not mark a restore (UI-SPEC A5 no-op click)', () => {
    useGameModeStore.getState().setMode('holdem');
    expect(useGameModeStore.getState().holdemRestorePending).toBe(false);
  });
});
