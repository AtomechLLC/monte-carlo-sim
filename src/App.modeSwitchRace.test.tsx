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
// To construct the closure-vs-registration window in one deterministic step — rather than
// waiting out the deal's real ~900ms 8-card stagger, which is exactly the real-motion-timing
// dependency this file avoids — the runout is seeded directly via `useGameStore.setState` rather
// than via a `deal()` click. `deal()` synchronously calls `beginAnimation()` in the SAME tick it
// sets `runout` (gameStore.ts's own "armed BEFORE the odds cache is cleared" comment), which
// guarantees the odds effect's first render after a real Deal click always observes
// pendingAnimationCount > 0 already. Bypassing that synchronous coupling lets the odds effect's
// first render see pendingAnimationCount === 0 (its own closure-captured value from THIS render,
// unaffected by the cascade of child AnimatedCard/FlipCard registrations that fire moments later
// in the SAME passive-effects flush) while `runout` is simultaneously non-null. That is the
// EXACT shape the production mode switch-back had before 05-REVIEW CR-01 was fixed (no
// synchronous arming, cards registering child-first in the same flush) — pre-fix, a live run
// started here while 8 real cards were mid-flight. Post-fix, the odds effect's SECONDARY live
// read of the gate (App.tsx — supplementing, never replacing, the subscribed dependency that
// still drives every re-run) must see those same-flush registrations and refuse to start a run
// while any card is in flight (D-11/D-12).
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
  useGameModeStore.setState({ mode: 'holdem', holdemRestorePending: false });
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

describe('switch-mid-deal race — the animation gate blocks the odds effect and drains to 0 on switch-away (D-07/D-08, 05-REVIEW CR-01/CR-02)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('cards registering in the same flush block the odds effect (CR-01 live-read guard), and switching to Blackjack drains the gate to exactly 0', async () => {
    // Never streams a `done` snapshot (05-02-PLAN Task 2 action) — the settled-snapshot mock
    // (App.modeIsolation.test.tsx) would complete instantly and leave nothing in flight.
    vi.mocked(simulationService.startSimulation).mockImplementation(() => new Promise(() => {}));

    act(() => {
      useGameStore.setState({ runout: FAKE_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1 });
    });

    render(<App />);

    // CR-01 (05-REVIEW): the odds effect's own first render saw pendingAnimationCount === 0
    // (see the top-of-file comment for why), but the 8 card registrations landed in the SAME
    // passive-effects flush, child-first, BEFORE the effect ran — the live-read secondary guard
    // must therefore refuse to start a run. Pre-fix this was 1: a live run launched while every
    // card was still mid-flight (the exact production switch-back bug, D-11/D-12 violation).
    expect(vi.mocked(simulationService.startSimulation)).not.toHaveBeenCalled();

    // Guard assertion (BEFORE the switcher click), exact by design (05-REVIEW CR-02): the 8 real
    // AnimatedCards (2 hero + 6 opponent hole cards; preflop, so no board cards) each registered
    // one unit, and TableScene's release effect — which fires only on real navigation-dep
    // changes — took none of them. Pre-CR-02-fix this read 7: TableScene's unconditional
    // endAnimation() on mount stole one card's unit, opening the gate one card early on every
    // mount-with-a-dealt-hand. A 0 here means the real-motion mock stopped taking effect and
    // this test has gone vacuous.
    expect(
      useUiStore.getState().pendingAnimationCount,
      'expected exactly 8 real card registrations (2 hero + 6 opponent hole cards) with none stolen by TableScene\'s mount effect (05-REVIEW CR-02) — a 0 here means the real-motion mock stopped taking effect and this test has gone vacuous',
    ).toBe(8);
    // Non-vacuousness anchor for the instant-restore assertions later: gate-registered cards
    // visibly carry the in-flight marker class while animating.
    expect(document.querySelectorAll('.card-in-flight')).toHaveLength(8);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));

    // Drained purely by AnimatedCard's/FlipCard's existing useAnimationGate unmount cleanups —
    // no production resetAnimations() call is involved anywhere in this flow.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    // No run ever started (the live-read guard blocked it above), so there is nothing to
    // cancel — an effect instance that early-returns registers no cleanup. Cancellation of a
    // GENUINELY live run on switch-away stays owned by the one cancelSimulation call site (the
    // odds effect's ignore-flag cleanup torn down by `mode` in its dependency array, D-07 —
    // pinned by App.modeShell.guard.test.ts).
    expect(vi.mocked(simulationService.cancelSimulation)).not.toHaveBeenCalled();

    // The drain happened via a real unmount, not a CSS-hidden subtree still present in the DOM
    // (D-04's own DOM-absence contract, reused here as evidence the drain is real).
    expect(screen.getByTestId('blackjack-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('table-scene')).not.toBeInTheDocument();

    // Switching back re-mounts the Hold'em subtree fresh with the same runout/dealNonce (D-07
    // persistence, proven separately in App.modeIsolation.test.tsx). WR-02 (05-REVIEW): this is
    // a RESTORE mount — 05-UI-SPEC locks the switch as "an instant DOM swap... no new
    // animation" and D-07 as "returning shows the exact table left behind" — so the re-mounting
    // cards must render directly in their slots: no deal-choreography replay, no gate arming
    // (pre-fix this count read 8: every card re-registered and re-flew from the deck), and no
    // in-flight marker. TIGHTENED from the pre-fix "finite and non-negative" tolerance.
    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(document.querySelectorAll('.card-in-flight')).toHaveLength(0);
    // The exact table left behind IS on screen, immediately.
    expect(screen.getByTestId('hero-hole').children).toHaveLength(2);
    expect(screen.getByTestId('opponents').children).toHaveLength(3);

    // D-07's "recomputed if the run was cancelled mid-flight": the gate is untouched (nothing
    // registered) and no settled cache exists (the pre-switch window never started a run), so
    // the odds effect starts the live recompute IMMEDIATELY on the restore commit — no odds
    // interruption, no start/cancel churn (this stays the FIRST and only start).
    expect(vi.mocked(simulationService.startSimulation)).toHaveBeenCalledTimes(1);

    // Second switch-away: the restarted live run is cancelled through the one existing
    // cancellation mechanism (`mode` in the odds effect's dependency array tearing down the
    // ignore-flag cleanup — the single cancelSimulation call site, D-07), and the drain
    // mechanism is repeatable, not a one-shot fluke (T-05-03: a stuck counter would permanently
    // freeze every future odds update).
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(vi.mocked(simulationService.cancelSimulation)).toHaveBeenCalledTimes(1);
  });

  it('a fresh Deal after a switch-back restore animates normally — the restore suppression is scoped to the restore commit alone (WR-02)', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(() => new Promise(() => {}));

    act(() => {
      useGameStore.setState({ runout: FAKE_RUNOUT, street: 'preflop', revealedMask: 0, dealNonce: 1 });
    });
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    // Restore mount: nothing armed, nothing flying (the WR-02 contract, proven above).
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    const callsAfterRestore = vi.mocked(simulationService.startSimulation).mock.calls.length;

    // A real Deal must be a byte-identical Phase 3 deal: synchronous arming, 8 fresh cards
    // registering under real motion, TableScene releasing exactly the action's unit — the
    // restore flag must not leak past its own commit and suppress this.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(useUiStore.getState().pendingAnimationCount).toBe(8);
    expect(document.querySelectorAll('.card-in-flight')).toHaveLength(8);
    // And the gate blocks the odds effect for the new deal exactly as designed — no new run
    // starts while the fresh cards are mid-flight.
    expect(vi.mocked(simulationService.startSimulation).mock.calls.length).toBe(callsAfterRestore);
  });

  it('a revealed seat restore-mounts already face-up: no flip replay registration, and the face is on screen instantly (WR-02/D-07)', async () => {
    vi.mocked(simulationService.startSimulation).mockImplementation(() => new Promise(() => {}));

    act(() => {
      useGameStore.setState({ runout: FAKE_RUNOUT, street: 'preflop', revealedMask: 0b1, dealNonce: 1 });
    });
    render(<App />);

    // Exactly the 8 AnimatedCards register — a FlipCard mounting ALREADY face-up has no
    // hidden -> face-up transition to animate, so it must not arm the gate (pre-fix this read
    // 10: opponent 0's two already-revealed FlipCards each registered a unit at mount that only
    // Motion's mount-replay of the flip would release).
    expect(useUiStore.getState().pendingAnimationCount).toBe(8);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('game-mode-switch-blackjack'));
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);

    await user.click(screen.getByTestId('game-mode-switch-holdem'));
    // Restore mount: neither the fly-ins nor the revealed flips replay or register.
    expect(useUiStore.getState().pendingAnimationCount).toBe(0);
    expect(document.querySelectorAll('.card-in-flight')).toHaveLength(0);

    // The revealed seat is back exactly as left: disabled, revealed aria-label, both face
    // images present immediately (not mid-flip, not face-down).
    const seat = screen.getByTestId('opponent-seat-0');
    expect(seat).toBeDisabled();
    expect(seat).toHaveAttribute('aria-label', 'Opponent 1 hole cards: 7h 8h (revealed)');
    const faceImages = Array.from(seat.querySelectorAll('img')).filter(
      (img) => img.getAttribute('src') !== '/cards/back.svg',
    );
    expect(faceImages).toHaveLength(2);
  });
});
