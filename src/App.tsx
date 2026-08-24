import { MotionConfig } from 'motion/react';
import './App.css';
import { HoldemGame } from './ui/HoldemGame';
import { BlackjackGame } from './ui/BlackjackGame';
import { useGameModeStore } from './state/gameModeStore';

// D-07 (05-REVIEW WR-03): App is now a cross-game SHELL — it owns no game state, no effects
// and no simulation imports. Every Hold'em-scoped effect, state field and JSX block lives in
// <HoldemGame />, and every Blackjack-scoped one in <BlackjackGame /> (06-07 — the Phase 5
// placeholder shim and BlackjackScene are retired, D-13); the shell only picks which game
// component mounts. Leakage is structurally impossible: a game-scoped sibling cannot exist
// outside its game component.
function App() {
  // Subscribed value (D-05): the shell reads the active game only to choose which sibling
  // component mounts — it never branches game LOGIC on it.
  const mode = useGameModeStore((state) => state.mode);

  return (
    // D-09: honours prefers-reduced-motion app-wide (and deterministically in tests, via the
    // matchMedia polyfill in src/test/setup.ts) — every Motion component under this provider
    // collapses to zero-duration animations when reduced motion is active.
    <MotionConfig reducedMotion="user">
      <h1>Monte Carlo Poker Simulator</h1>
      {mode === 'holdem' && <HoldemGame />}
      {mode === 'blackjack' && <BlackjackGame />}
    </MotionConfig>
  );
}

export default App;
