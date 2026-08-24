import { useEffect, useState } from 'react';
import './App.css';
import { DealButton } from './ui/DealButton';
import { CardPicker } from './ui/CardPicker';
import { StreetControls } from './ui/StreetControls';
import { TableScene } from './ui/TableScene';
import { OddsPanel } from './ui/OddsPanel';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
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

  // Transient UI state, not odds data — held here rather than in oddsStore.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Scenario-construction disclosure (D-06/A4): collapsed by default; the existing CardPicker's
  // slot/panel/dialog semantics are untouched, only its visibility is toggled from here.
  const [scenarioOpen, setScenarioOpen] = useState(false);

  useEffect(() => {
    if (!runout) return;

    // Cache gate (D-10/D-12): consult the settled-odds cache BEFORE ever touching the worker.
    // On a hit, apply the cached snapshot and stop — no startSimulation call, no cleanup
    // function, so rewinding to an unchanged-knowledge street is a pure Map.get with zero
    // re-simulation noise. On a miss, fall through to the normal live-converging run below.
    const cached = useOddsStore.getState().getCached(street, revealedMask);
    if (cached) {
      useOddsStore.getState().applySnapshot(cached);
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
  }, [runout, street, revealedMask, dealNonce]);

  return (
    <>
      <h1>Monte Carlo Poker Simulator</h1>
      {runout === null && (
        <div className="empty-hand-state" data-testid="empty-hand-state">
          <h2>No hand dealt yet</h2>
          <p>
            Click Deal to draw a random hand, or click Set Up Scenario to construct your own
            hand, then click Deal.
          </p>
        </div>
      )}
      {errorMessage !== null && (
        <div className="simulation-error" data-testid="simulation-error" role="alert">
          {SIMULATION_ERROR_MESSAGE}
        </div>
      )}
      <div className="control-bar">
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
      </div>
      {scenarioOpen && (
        <div id={CARD_PICKER_REGION_ID}>
          <CardPicker />
        </div>
      )}
      <div className="table-row">
        <TableScene />
        <OddsPanel />
      </div>
    </>
  );
}

export default App;
