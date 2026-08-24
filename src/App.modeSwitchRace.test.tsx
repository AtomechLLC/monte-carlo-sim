import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as simulationService from './state/simulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';
import type { PredeterminedRunout } from './engine/conditioning';

// D-07/D-08 switch-mid-deal race proof (05-02). This suite forces useReducedMotion() to false —
// file-scoped, hence its own sibling file (vi.mock is file-scoped, and this is the only file in
// the phase that needs real motion enabled) — so AnimatedCard's/FlipCard's `enabled = !reduce`
// derivation actually registers real cards with the animation gate. Under the DEFAULT harness
// (src/test/setup.ts forces prefers-reduced-motion: reduce globally, since jsdom has no
// compositor), no real card ever calls beginAnimation() — a switch-mid-deal test written against
// that default harness would assert a VACUOUS truth (the counter was 0 the whole time). Mirrors
// FlipCard.test.tsx's own documented escape hatch (lines 6-22) exactly, spreading importActual so
// MotionConfig/motion.div/AnimatePresence (which App depends on) keep working.
//
// Real-motion TIMING is deliberately NOT asserted anywhere in this file — unmount is the release
// trigger under test, never a wait on onAnimationComplete, which would be flaky in a
// compositor-less jsdom (same stance FlipCard.test.tsx documents). Fake timers are deliberately
// not used either.
//
// To get a genuinely in-flight simulation run to coexist with genuinely in-flight real card
// animations in one deterministic step — rather than waiting out the deal's real ~900ms 8-card
// stagger, which is exactly the real-motion-timing dependency this file avoids — the runout is
// seeded directly via `useGameStore.setState` rather than via a `deal()` click. `deal()`
// synchronously calls `beginAnimation()` in the SAME tick it sets `runout` (gameStore.ts's own
// "armed BEFORE the odds cache is cleared" comment), which guarantees the odds effect's first
// render after a real Deal click always observes pendingAnimationCount > 0 already — correctly
// preventing a live run from EVER starting while cards are still mid-flight (D-11/D-12, by
// design; verified empirically while building this file). Bypassing that synchronous coupling
// for this one test lets the odds effect's first render see pendingAnimationCount === 0 (its own
// closure-captured value from THIS render, unaffected by the cascade of child
// AnimatedCard/FlipCard registrations that fire moments later in the SAME passive-effects flush)
// while `runout` is simultaneously non-null — so a live (mocked, never-resolving) run starts AND,
// in the very same commit, real cards mount and register under real motion. This reconstructs
// the exact race D-08 describes (a live run in flight, cards in flight) without waiting on real
// animation timing or touching fake timers.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as every other App-level test's mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

function resetStores() {
  useGameStore.setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 });
  // TEST-ONLY use of resetAnimations (src/state/uiStore.ts's own guard comment) — appears ONLY
  // here, in beforeEach isolation. It must never appear between a deal and a post-switch
  // assertion below, or it would erase the very thing under test.
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useGameModeStore.setState({ mode: 'holdem' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
}

const FAKE_RUNOUT: PredeterminedRunout = {
  heroHole: ['As', 'Kd'],
  board: ['2c', '3c', '4c', '5c', '6c'],
  opponentHoles: [
    ['7h', '8h'],
    ['9h', 'Th'],
    ['Jh', 'Qh'],
  ],
};

describe('switch-mid-deal race — the animation gate drains to 0 and the in-flight run is cancelled (D-07/D-08)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('a live (never-resolving) run starts, real cards register with the gate, and switching to Blackjack drains the gate to 0 and cancels the run exactly once', async () => {
    // Never streams a `done` snapshot (05-02-PLAN Task 2 action) — Task 1's settled-snapshot
    // mock (App.modeIsolation.test.tsx) would complete instantly and leave nothing to cancel.
    vi.mocked(simulationService.startSimulation).mockImplementation(() => new Promise(() => {}));

    act(() => {
      useGameStore.setState({ runout: FAKE_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1 });
    });

    render(<App />);

    // Guard: a real run genuinely started — the odds effect's own first render saw
    // pendingAnimationCount === 0 (see the top-of-file comment for why), before the cascade of
    // card registrations below landed. Otherwise the cancellation assertion after the switch
    // would be vacuous (nothing was ever in flight to cancel).
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(1);

    // Guard assertion (BEFORE the switcher click): real AnimatedCard/FlipCard instances actually
    // registered with the gate. A 0 here means the real-motion mock stopped taking effect, or the
    // `enabled` derivation in AnimatedCard/FlipCard changed — either way this test would silently
    // degrade into a vacuous pass without this explicit check.
    expect(
      useUiStore.getState().pendingAnimationCount,
      'expected real card registrations to leave pendingAnimationCount > 0 before switching — a 0 here means the real-motion mock stopped taking effect and this test has gone vacuous',
    ).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    // Drained purely by AnimatedCard's/FlipCard's existing useAnimationGate unmount cleanups —
    // no production resetAnimations() call is involved anywhere in this flow.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // The in-flight run was cancelled through the SAME mechanism D-07 already relies on: `mode`
    // joining the odds effect's dependency array tears down the previous effect instance's
    // ignore-flag cleanup, which calls cancelSimulation() — no second cancellation call site
    // exists anywhere in the production code for this.
    expect(vi.mocked(simulationService.cancelSimulation).mock.calls.length).toBe(1);

    // The drain happened via a real unmount, not a CSS-hidden subtree still present in the DOM
    // (D-04's own DOM-absence contract, reused here as evidence the drain is real).
    expect(screen.getByTestId('blackjack-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('table-scene')).not.toBeInTheDocument();

    // Switching back re-mounts the Hold'em subtree fresh: the same runout/dealNonce still holds
    // (D-07 persistence, proven separately in App.modeIsolation.test.tsx), so the same real cards
    // mount again and register again under real motion — a legitimate, freshly-owned non-zero
    // count, not a stranded leftover from the earlier switch (which already proved a clean drain
    // to exactly 0 above). Asserting only "finite and non-negative" here (not a wait for it to
    // hit 0 via real animation completion) keeps this file's no-real-motion-timing rule intact.
    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    const afterReturn = useUiStore.getState().pendingAnimationCount;
    expect(afterReturn).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(afterReturn)).toBe(true);

    // Proves the drain mechanism is repeatable, not a one-shot fluke — a genuinely stranded gate
    // (T-05-03: a stuck counter would permanently freeze every future odds update) would fail to
    // return to 0 on a SECOND switch-away just as it would on the first. This is the concrete
    // "a rapid round trip cannot permanently freeze future odds updates" check, without waiting
    // on real Motion animation-completion timing.
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
  });
});
