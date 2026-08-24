import { useEffect, useState } from 'react';
import { GameModeSwitcher } from './GameModeSwitcher';
import { BlackjackControls } from './BlackjackControls';
import { BlackjackTable } from './BlackjackTable';
import { BlackjackOddsPanel } from './BlackjackOddsPanel';
import { useBlackjackStore } from '../state/blackjackStore';
import { useBlackjackOddsStore } from '../state/blackjackOddsStore';
import { useUiStore } from '../state/uiStore';
import { useGameModeStore } from '../state/gameModeStore';
import {
  startBlackjackSimulation,
  cancelBlackjackSimulation,
} from '../state/blackjackSimulationService';
import { deriveBlackjackConditionedState } from '../engine/blackjackConditioning';

/** Locked A14 error copy (06-UI-SPEC Copywriting Contract — verbatim). */
const BLACKJACK_SIMULATION_ERROR_MESSAGE =
  'The simulation hit an unexpected error and stopped updating. Deal a new round to try again.';

/**
 * The Blackjack game root (D-13, BJ-02): owns the blackjack odds effect, the restore ack,
 * the error banner, the idle state, the control bar and the scene row — the blackjack
 * sibling of <HoldemGame /> under the shell's mode fork (D-07).
 *
 * 06-RESEARCH Pitfall G, explicitly: this odds effect is NEW code — it does not inherit
 * Hold'em's StrictMode hardening by virtue of Hold'em having it. The ignore flag, the
 * animation gate's dual check and the cache gate are all RE-IMPLEMENTED here on purpose,
 * because a StrictMode double-invoked effect without them would leak a second live run or
 * apply a superseded snapshot.
 */
export function BlackjackGame() {
  const round = useBlackjackStore((state) => state.round);
  const playerHand = useBlackjackStore((state) => state.playerHand);
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const revealedHole = useBlackjackStore((state) => state.revealedHole);
  const deckCount = useBlackjackStore((state) => state.deckCount);
  const roundNonce = useBlackjackStore((state) => state.roundNonce);
  // Subscribed value — this dependency-array entry is what re-runs the effect on every gate
  // drain step, so the gate can always re-open. The 03-RESEARCH deadlock (dependency
  // unchanged between renders while the live value flipped, effect never re-running) only
  // applies when a live getState() read REPLACES this subscription; the effect below
  // additionally does one live read as a SECONDARY guard (05-REVIEW CR-01 fix) that
  // supplements — never replaces — this subscribed dependency.
  const pendingAnimationCount = useUiStore((state) => state.pendingAnimationCount);
  // Subscribed value, same discipline as pendingAnimationCount above: the odds effect below
  // reads this from its dependency array, never via a live getState() call.
  const mode = useGameModeStore((state) => state.mode);

  // Derived from the subscribed hand — the closure-captured cache-key dimension (with
  // revealedHole) that a late snapshot from a superseded run gets filed under.
  const playerHandLength = playerHand.length;

  // Transient UI state, not odds data — held here rather than in the odds store.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Gate 1 — mode gate, checked FIRST, above every other guard: no blackjack simulation
    // may start and no blackjack cache key may be written while another game is on screen.
    // When `mode` later flips away from 'blackjack' mid-run, this same dependency-array
    // entry tears down the previous effect instance and fires the ignore-flag cleanup
    // below — this teardown IS the cancellation mechanism for a mode switch (D-07,
    // 05-REVIEW CR-01 lineage), with NO second call site anywhere. Do not "simplify" the
    // guard or the `mode` dependency away.
    if (mode !== 'blackjack') return;

    // Gate 2 — animation gate (TBL-04): checked before the cache-hit branch below, so a
    // settled-cache hit waits for animation completion exactly like a live run does. No
    // odds number may change, and no cached snapshot may be applied, while any card
    // describing that knowledge state is still mid-flight.
    //
    // CR-01 fix (05-REVIEW), re-implemented for blackjack (Pitfall G): the live read is a
    // SECONDARY guard for the one commit where cards that mounted in THIS render flush
    // registered with the gate AFTER the render closure captured 0 but BEFORE this effect
    // ran (passive effects flush child-first) — the shape a mode switch-back re-mount has,
    // where no blackjackStore action armed the gate synchronously pre-render the way
    // deal/hit/stand/reveal do. The subscribed dependency above still drives every re-run,
    // so the 03-RESEARCH deadlock (which only applies when a live read REPLACES the
    // subscription) cannot recur: any skip here is always followed by a dependency-driven
    // re-run when the subscribed count next changes, including its final drain step to 0.
    if (pendingAnimationCount > 0 || useUiStore.getState().pendingAnimationCount > 0) return;

    // Gate 3 — roundPhase gate (D-03a): naturals resolve deterministically at deal, so a
    // resolved round has nothing to simulate and an idle one has no round at all — starting
    // a run in either state would stream numbers for a decision point that does not exist.
    // A natural-resolved deal therefore runs ZERO trials; the zero-trials display it shows
    // is deal()'s own unconditional odds reset (A16), not anything this effect does.
    if (roundPhase !== 'player-turn' || round === null) return;

    // Gate 4 — cache gate: consult the settled-odds cache BEFORE ever touching the worker.
    // On a hit, apply the cached snapshot and stop — no simulation start, no cleanup
    // function, so returning to an unchanged-knowledge decision point (a mode round trip)
    // is a pure Map.get with zero re-simulation noise. On a miss, fall through to the live
    // converging run below.
    const cached = useBlackjackOddsStore.getState().getCached(playerHandLength, revealedHole);
    if (cached) {
      useBlackjackOddsStore.getState().applySnapshot(cached);
      // A cache hit is a valid, current result for this knowledge state — any error banner
      // left over from a previous run no longer describes what's on screen. Deferred via a
      // microtask, mirroring the live branch's callback-shaped setState discipline
      // (setErrorMessage there is called from inside the simulation's onProgress callback,
      // not synchronously in the effect body) — react-hooks/set-state-in-effect flags a
      // setState call reachable directly from the effect's own synchronous scope.
      queueMicrotask(() => setErrorMessage(null));
      return;
    }

    // Live run — ignore-flag cleanup (Pitfall G, re-implemented): under StrictMode this
    // effect double-invokes; the first invocation's cleanup sets `ignore` and cancels, so
    // exactly one live, uncancelled run survives (the service's generation counter filters
    // the superseded run's snapshots as defence in depth).
    let ignore = false;
    useBlackjackOddsStore.getState().reset();

    // D-02: the predetermined round reaches the worker ONLY through the engine's sole
    // conditioning reader — this component never slices the raw round itself, which is what
    // keeps the face-down hole card inside the trial pool instead of leaking it out.
    const conditioned = deriveBlackjackConditionedState(round, playerHand, revealedHole, deckCount);
    void startBlackjackSimulation(
      conditioned,
      (snapshot) => {
        if (ignore) return;
        // Same-key/wrong-generation guard (06-REVIEW CR-02): a late snapshot from a run
        // whose round or shoe has been superseded must neither display nor cache.
        // deal()/setDeckCount() clear the cache SYNCHRONOUSLY, but this callback stays
        // live until React's passive-effect flush runs the ignore-flag cleanup — worker
        // messages are macrotasks that can be delivered inside that gap, re-caching the
        // stale run's odds under the unchanged (playerHandLength, revealedHole) key
        // AFTER the clear. The closure-captured key dimensions below defend the
        // wrong-KEY hazard only; roundNonce (a re-deal) and deckCount (a mid-turn
        // toggle, which changes no nonce) are the round's generation identity.
        const bj = useBlackjackStore.getState();
        if (bj.roundNonce !== roundNonce || bj.deckCount !== deckCount) return;
        // A streamed snapshot means this run is actively progressing — clear any stale
        // error from a previous run (react-hooks/set-state-in-effect: setState belongs in a
        // callback reacting to the external worker, not synchronously in the effect body).
        setErrorMessage(null);
        useBlackjackOddsStore.getState().applySnapshot(snapshot);
        // Filed under the (playerHandLength, revealedHole) captured in THIS effect's
        // closure, not a fresh getState() read — a late snapshot from a superseded run must
        // not be cached under whatever hand/reveal state happens to be current by the time
        // it arrives. The store's own write-gate decides whether this write actually lands,
        // so no `if (snapshot.done)` check is needed here.
        useBlackjackOddsStore.getState().cacheIfSettled(playerHandLength, revealedHole, snapshot);
      },
      (message) => {
        console.error('[blackjack simulation]', message);
        if (!ignore) setErrorMessage(message);
      },
    );

    return () => {
      ignore = true;
      void cancelBlackjackSimulation();
    };
    // `playerHand` sits beside the plan's pinned entries so the derive input is the closure
    // array itself (never a live read); `roundNonce` stays even though `round` identity
    // already changes per deal — a deal that resolves on a natural changes roundPhase too,
    // and a re-deal into an identical-shaped state would otherwise be indistinguishable;
    // the nonce makes each deal a distinct generation with no reliance on reference
    // identity.
  }, [round, playerHand, playerHandLength, revealedHole, roundPhase, deckCount, roundNonce, pendingAnimationCount, mode]);

  // Leaving Blackjack cancels the run the banner was describing (the odds effect's teardown
  // above), so the error no longer describes anything on screen — clear it, or it re-mounts
  // (and re-announces via role="alert") the instant the user switches back, sitting stale
  // for the whole re-mount. Mirrors HoldemGame's 05-REVIEW WR-01 fix. Deferred via a
  // microtask, mirroring the cache-hit branch's setState discipline above
  // (react-hooks/set-state-in-effect flags a setState reachable from the effect's own
  // synchronous scope).
  useEffect(() => {
    if (mode !== 'blackjack') queueMicrotask(() => setErrorMessage(null));
  }, [mode]);

  // A holdem -> blackjack switch marks blackjackRestorePending, which the re-mounting card
  // layer consumes at RENDER time (AnimatedCard captures it once at mount) to restore the
  // exact table left behind instantly — no deal-choreography replay, no gate arming
  // (06-RESEARCH Pattern 5, 05-REVIEW WR-02 lineage). Acknowledged here, in the same
  // commit's effect phase — after every restored card has already captured it — so a later
  // Deal mounts fresh cards with the flag down and animates normally. Idempotent and
  // StrictMode-safe (a double-invoked ack is just a second no-op write).
  useEffect(() => {
    if (mode === 'blackjack') useGameModeStore.getState().ackBlackjackRestore();
  }, [mode]);

  return (
    <>
      {roundPhase === 'idle' && (
        // A10: the retained blackjack-empty-state testid, now a page-level idle block in the
        // same document slot (and shipped class) as Hold'em's empty-hand-state — the Phase 5
        // on-felt placeholder copy and placement are retired.
        <div className="empty-hand-state" data-testid="blackjack-empty-state">
          <h2>No round dealt yet</h2>
          <p>
            Click Deal to start a round. Switch the shoe between 1 and 2 decks to see the
            odds shift.
          </p>
        </div>
      )}
      {errorMessage !== null && (
        // A14: mirrors Hold'em's error banner with blackjack-scoped testids. Deliberate a11y
        // trade-off carried across: the raw detail sits OUTSIDE the role="alert" live region
        // so the announced text stays the actionable recovery-path sentence, not a raw
        // technical string — the detail is still in normal reading order for anyone who
        // wants it.
        <div className="simulation-error-banner">
          <div
            className="simulation-error"
            data-testid="blackjack-simulation-error"
            role="alert"
          >
            {BLACKJACK_SIMULATION_ERROR_MESSAGE}
          </div>
          <p className="simulation-error-detail" data-testid="blackjack-simulation-error-detail">
            Reported error: {errorMessage}
          </p>
        </div>
      )}
      <div className="control-bar">
        <GameModeSwitcher />
        <BlackjackControls />
      </div>
      <div className="table-row">
        <BlackjackTable />
        <BlackjackOddsPanel />
      </div>
    </>
  );
}
