import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import './App.css';
import { DealButton } from './ui/DealButton';
import { CardPicker } from './ui/CardPicker';
import { StreetControls } from './ui/StreetControls';
import { TableScene } from './ui/TableScene';
import { OddsPanel } from './ui/OddsPanel';
import { GameModeSwitcher } from './ui/GameModeSwitcher';
import { BlackjackScene } from './ui/BlackjackScene';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';
import { startSimulation, cancelSimulation } from './state/simulationService';
import { deriveConditionedState } from './engine/conditioning';

const SIMULATION_ERROR_MESSAGE =
  'The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again.';

const CARD_PICKER_REGION_ID = 'card-picker';

function App() {
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const dealNonce = useGameStore((state) => state.dealNonce);
  // Subscribed value only — the effect below must never read this field live off the store's
  // getState() snapshot. Mixing a subscribed dependency with a live imperative read would let the
  // dependency value stay unchanged between two renders while the live value flipped, so the
  // effect would never re-run and the gate would never open (03-RESEARCH).
  const pendingAnimationCount = useUiStore((state) => state.pendingAnimationCount);
  // Subscribed value, same discipline as pendingAnimationCount above (D-05): the odds effect
  // below reads this from its dependency array, never via a live getState() call.
  const mode = useGameModeStore((state) => state.mode);

  // Transient UI state, not odds data — held here rather than in oddsStore.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Scenario-construction disclosure (D-06/A4): collapsed by default; the existing CardPicker's
  // slot/panel/dialog semantics are untouched, only its visibility is toggled from here.
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    // Mode gate (05-01 D-05, Pitfall 11): checked FIRST, above every other guard — no simulation
    // may start and no odds cache key may be written while another game is on screen. When `mode`
    // later flips away from 'holdem' mid-run, this same dependency-array entry (see below) tears
    // down the previous effect instance and fires the EXISTING ignore-flag cleanup below, which is
    // what delivers D-07's cancellation for free — no second cancellation call site is added.
    if (mode !== 'holdem') return;

    // Animation gate (D-11/D-12, TBL-04): checked FIRST, above the cache-hit branch below — a
    // settled-cache hit has no worker timing dependency today and is the branch most likely to
    // be left ungated (03-RESEARCH Pitfall 1), so it must wait for animation completion exactly
    // like a live run does. No odds number may change, and no cached snapshot may be applied,
    // while any card describing that knowledge state is still mid-flight.
    if (pendingAnimationCount > 0) return;

    if (!runout) return;

    // Cache gate (D-10/D-12): consult the settled-odds cache BEFORE ever touching the worker.
    // On a hit, apply the cached snapshot and stop — no startSimulation call, no cleanup
    // function, so rewinding to an unchanged-knowledge street is a pure Map.get with zero
    // re-simulation noise. On a miss, fall through to the normal live-converging run below.
    const cached = useOddsStore.getState().getCached(street, revealedMask);
    if (cached) {
      useOddsStore.getState().applySnapshot(cached);
      // WR-01 fix (02-REVIEW.md): a cache hit is a valid, current result for this knowledge
      // state — any error banner left over from a previous run no longer describes what's on
      // screen. Deferred via a microtask, mirroring the live branch's callback-shaped setState
      // discipline (setErrorMessage there is called from inside startSimulation's onProgress
      // callback, not synchronously in the effect body) — react-hooks/set-state-in-effect flags
      // a setState call reachable directly from the effect's own synchronous scope.
      queueMicrotask(() => setErrorMessage(null));
      return;
    }

    // Ignore-flag cleanup (RESEARCH Pitfall 3): dependency array covers all four navigation
    // triggers (runout/street/revealedMask/dealNonce), so a narrow re-deal-only fix would still
    // leave the identical stale-write race reachable from rapid Advance/Rewind clicks.
    let ignore = false;
    useOddsStore.getState().reset();

    const conditioned = deriveConditionedState(runout, street, revealedMask);
    void startSimulation(
      conditioned,
      (snapshot) => {
        if (ignore) return;
        // A streamed snapshot means this run is actively progressing — clear any stale error
        // from a previous run (react-hooks/set-state-in-effect: setState belongs in a callback
        // reacting to the external worker, not synchronously in the effect body).
        setErrorMessage(null);
        useOddsStore.getState().applySnapshot(snapshot);
        // Filed under the (street, revealedMask) captured in THIS effect's closure, not a fresh
        // getState() read — a late snapshot from a superseded run must not be cached under
        // whatever street/mask happens to be current by the time it arrives. The store's own
        // write-gate decides whether this write actually lands, so no `if (snapshot.done)`
        // check is needed here.
        useOddsStore.getState().cacheIfSettled(street, revealedMask, snapshot);
      },
      (message) => {
        console.error('[simulation]', message);
        if (!ignore) setErrorMessage(message);
      },
    );

    return () => {
      ignore = true;
      void cancelSimulation();
    };
  }, [runout, street, revealedMask, dealNonce, pendingAnimationCount, mode]);

  return (
    // D-09: honours prefers-reduced-motion app-wide (and deterministically in tests, via the
    // matchMedia polyfill in src/test/setup.ts) — every Motion component under this provider
    // collapses to zero-duration animations when reduced motion is active.
    <MotionConfig reducedMotion="user">
      <h1>Monte Carlo Poker Simulator</h1>
      {mode === 'holdem' && runout === null && (
        <div className="empty-hand-state" data-testid="empty-hand-state">
          <h2>No hand dealt yet</h2>
          <p>
            Click Deal to draw a random hand, or click Set Up Scenario to construct your own
            hand, then click Deal.
          </p>
        </div>
      )}
      {mode === 'holdem' && errorMessage !== null && (
        // IMP-16: shows the underlying error detail alongside the existing recovery-path
        // copy. Deliberate a11y trade-off: the detail sits OUTSIDE the role="alert" live
        // region so the announced text stays the actionable recovery-path sentence
        // (UI-SPEC Copywriting Contract keeps that copy verbatim on the alert element
        // itself) rather than a raw technical string — the detail is still in normal
        // reading order for anyone who wants it, just not what a screen reader announces.
        <div className="simulation-error-banner">
          <div className="simulation-error" data-testid="simulation-error" role="alert">
            {SIMULATION_ERROR_MESSAGE}
          </div>
          <p className="simulation-error-detail" data-testid="simulation-error-detail">
            Reported error: {errorMessage}
          </p>
        </div>
      )}
      <div className="control-bar">
        <GameModeSwitcher />
        {mode === 'holdem' && (
          <>
            <DealButton />
            <button
              type="button"
              data-testid="set-up-scenario-button"
              aria-expanded={scenarioOpen}
              aria-controls={CARD_PICKER_REGION_ID}
              onClick={() => setScenarioOpen((open) => !open)}
            >
              Set Up Scenario
            </button>
            <StreetControls />
          </>
        )}
      </div>
      {mode === 'holdem' && scenarioOpen && (
        <div id={CARD_PICKER_REGION_ID}>
          <CardPicker />
        </div>
      )}
      {mode === 'holdem' && (
        <div className="table-row">
          <TableScene />
          <OddsPanel />
        </div>
      )}
      {mode === 'blackjack' && <BlackjackScene />}
    </MotionConfig>
  );
}

export default App;
