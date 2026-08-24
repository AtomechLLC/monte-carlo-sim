import { useEffect, useState } from 'react';
import { DealButton } from './ui/DealButton';
import { StreetControls } from './ui/StreetControls';
import { HandDisplay } from './ui/HandDisplay';
import { BoardDisplay } from './ui/BoardDisplay';
import { WinTieLossDisplay } from './ui/WinTieLossDisplay';
import { OddsTable } from './ui/OddsTable';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { startSimulation, cancelSimulation } from './state/simulationService';
import { deriveConditionedState } from './engine/conditioning';

const SIMULATION_ERROR_MESSAGE =
  'The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again.';

function App() {
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const dealNonce = useGameStore((state) => state.dealNonce);

  // Transient UI state, not odds data — held here rather than in oddsStore.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!runout) return;

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
      {errorMessage !== null && (
        <div data-testid="simulation-error" role="alert">
          {SIMULATION_ERROR_MESSAGE}
        </div>
      )}
      <DealButton />
      <StreetControls />
      <HandDisplay />
      <BoardDisplay />
      <WinTieLossDisplay />
      <OddsTable />
    </>
  );
}

export default App;
