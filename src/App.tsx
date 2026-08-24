import { useEffect } from 'react';
import { DealButton } from './ui/DealButton';
import { HandDisplay } from './ui/HandDisplay';
import { WinTieLossDisplay } from './ui/WinTieLossDisplay';
import { OddsTable } from './ui/OddsTable';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { startSimulation } from './state/simulationService';
import { deckWithout } from './engine/cards';

function App() {
  const heroHole = useGameStore((state) => state.heroHole);
  const dealNonce = useGameStore((state) => state.dealNonce);

  useEffect(() => {
    if (!heroHole) return;

    useOddsStore.getState().reset();
    void startSimulation(heroHole, deckWithout(heroHole), dealNonce, (snapshot) =>
      useOddsStore.getState().applySnapshot(snapshot),
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
