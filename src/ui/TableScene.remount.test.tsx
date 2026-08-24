import { describe, it, expect, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { TableScene } from './TableScene';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import type { PredeterminedRunout } from '../engine/conditioning';

// 05-REVIEW CR-02 regression pins. Phase 5's mode fork re-mounts TableScene with a DEALT hand
// (a blackjack -> holdem switch-back) — a scenario Phase 3's release effect assumed impossible
// (its old comment: "pendingAnimationCount is always still 0 [at a component's own initial
// mount], nothing has been dealt yet"). The release must fire ONLY when the navigation deps
// (dealNonce/street/revealedMask) actually CHANGE — never on a mount, a StrictMode double-invoked
// mount, or a mode-switch-back re-mount that no gameStore action armed. uiStore's own
// resetAnimations comment names the failure class exactly: "the clamp prevents negatives, not
// cross-registration theft".
//
// Default harness (src/test/setup.ts forces reduced motion) keeps AnimatedCard/FlipCard out of
// the gate entirely, so every count in this file measures TableScene's own effect and nothing
// else — the units armed below stand in for in-flight cards whose registrations TableScene must
// never steal. Additive sibling to TableScene.test.tsx (deliberately not an edit to it).

const FABRICATED_RUNOUT: PredeterminedRunout = {
  heroHole: ['Ah', 'Kh'],
  board: ['2c', '3c', '4c', '5c', '6c'],
  opponentHoles: [
    ['7c', '8c'],
    ['9c', 'Tc'],
    ['Jc', 'Qc'],
  ],
};

function seedDealtHand() {
  useGameStore.setState({ runout: FABRICATED_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1 });
}

describe('TableScene re-mount with a dealt hand — no gate-unit theft (05-REVIEW CR-02)', () => {
  beforeEach(() => {
    useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
    // TEST-ONLY reset (uiStore's own guard comment) — beforeEach isolation only.
    useUiStore.getState().resetAnimations();
  });

  it('mounting with a dealt hand releases nothing: units armed by other registrations are untouched', () => {
    seedDealtHand();
    act(() => {
      useUiStore.getState().beginAnimation();
      useUiStore.getState().beginAnimation();
    });

    render(<TableScene />);

    // Pre-fix this read 1: TableScene's unconditional endAnimation() on mount decremented a unit
    // no gameStore action armed for it.
    expect(useUiStore.getState().pendingAnimationCount).toBe(2);
  });

  it('a StrictMode double-invoked mount with a dealt hand also releases nothing (two uncompensated calls pre-fix)', () => {
    seedDealtHand();
    act(() => {
      useUiStore.getState().beginAnimation();
      useUiStore.getState().beginAnimation();
    });

    render(
      <StrictMode>
        <TableScene />
      </StrictMode>,
    );

    // Pre-fix this read 0: StrictMode's mount -> cleanup -> mount cycle ran the (cleanup-less)
    // effect twice, stealing TWO units — the gate would open two cards early in dev.
    expect(useUiStore.getState().pendingAnimationCount).toBe(2);
  });

  it('a real navigation change after mounting with a dealt hand still releases exactly the one unit the action armed', () => {
    seedDealtHand();
    render(<TableScene />);
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors advanceStreet(): state change + arm in the same synchronous tick.
    act(() => {
      useGameStore.setState({ street: 'flop' });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // Mirrors reveal(): a second, different dep changing must release again.
    act(() => {
      useGameStore.setState({ revealedMask: 0b1 });
      useUiStore.getState().beginAnimation();
    });
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });

  it('under StrictMode a real navigation change releases exactly once — no compensating-cleanup drift', () => {
    seedDealtHand();
    render(
      <StrictMode>
        <TableScene />
      </StrictMode>,
    );
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    act(() => {
      useGameStore.setState({ street: 'flop' });
      useUiStore.getState().beginAnimation();
    });
    // A fix that added a cleanup releasing on teardown would drift here (the old comment's
    // warning): real transitions are single cleanup-then-setup cycles, so the armed unit must be
    // released exactly once, leaving 0 — not -1-clamped-to-0 masking a double release, and not 1.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});
