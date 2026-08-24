import { useEffect } from 'react';
import { DealButton } from './ui/DealButton';
import { HandDisplay } from './ui/HandDisplay';
import { WinTieLossDisplay } from './ui/WinTieLossDisplay';
import { OddsTable } from './ui/OddsTable';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { startSimulation } from './state/simulationService';
import { deckWithout } from './engine/cards';
import type { ConditionedState } from './engine/equity';

function App() {
  const heroHole = useGameStore((state) => state.heroHole);
  const dealNonce = useGameStore((state) => state.dealNonce);

  useEffect(() => {
    if (!heroHole) return;

    useOddsStore.getState().reset();
    // Preflop-only shape (no known board, no revealed opponents) — this plan's contract layer
    // only; street navigation and opponent reveal (which vary this ConditionedState) land in
    // 02-02/02-03.
    const conditioned: ConditionedState = {
      heroHole,
      knownBoard: [],
      knownOpponentHoles: [null, null, null],
      remainingDeck: deckWithout(heroHole),
    };
    void startSimulation(
      conditioned,
      (snapshot) => useOddsStore.getState().applySnapshot(snapshot),
      (message) => console.error('[simulation]', message),
    );
  }, [heroHole, dealNonce]);

  return (
    <>
      <h1>Monte Carlo Poker Simulator</h1>
      <DealButton />
      <HandDisplay />
      <WinTieLossDisplay />
      <OddsTable />
    </>
  );
}

export default App;
