import { MotionConfig } from 'motion/react';
import './App.css';
import { GameModeSwitcher } from './ui/GameModeSwitcher';
import { BlackjackScene } from './ui/BlackjackScene';
import { HoldemGame } from './ui/HoldemGame';
import { useGameModeStore } from './state/gameModeStore';

// D-07 (05-REVIEW WR-03): App is now a cross-game SHELL — it owns no game state, no effects
// and no simulation imports. Every Hold'em-scoped effect, state field and JSX block lives in
// <HoldemGame />; the shell only picks which game component mounts. Leakage is structurally
// impossible: a Hold'em-only sibling cannot exist outside its game component.
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
      {mode === 'blackjack' && (
        // Temporary Blackjack shim (06-02 planner decision): until plan 06-07 lands
        // <BlackjackGame />, the blackjack branch renders its own control bar (switcher only —
        // identical DOM to the pre-extraction shape) above the Phase 5 placeholder scene.
        // Plan 06-07 deletes this shim together with the placeholder.
        <>
          <div className="control-bar">
            <GameModeSwitcher />
          </div>
          <BlackjackScene />
        </>
      )}
    </MotionConfig>
  );
}

export default App;
