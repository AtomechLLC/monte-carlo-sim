import { useEffect, useState } from 'react';
import { DealButton } from './DealButton';
import { CardPicker } from './CardPicker';
import { StreetControls } from './StreetControls';
import { TableScene } from './TableScene';
import { OddsPanel } from './OddsPanel';
import { GameModeSwitcher } from './GameModeSwitcher';
import { useGameStore } from '../state/gameStore';
import { useOddsStore } from '../state/oddsStore';
import { useUiStore } from '../state/uiStore';
import { useGameModeStore } from '../state/gameModeStore';
import { usePickerStore, hasDuplicatePick } from '../state/pickerStore';
import { startSimulation, cancelSimulation } from '../state/simulationService';
import { deriveConditionedState } from '../engine/conditioning';

const SIMULATION_ERROR_MESSAGE =
  'The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again.';

const CARD_PICKER_REGION_ID = 'card-picker';

/** Locked A3 fresh-deal `title` (07-UI-SPEC Copywriting Contract — verbatim). */
const FRESH_DEAL_TITLE = 'Switching the shoe deals a fresh hand';

/** Locked A4 duplicate-pick guard `title` (07-UI-SPEC Copywriting Contract — verbatim). */
const DUPLICATE_PICK_GUARD_TITLE =
  'Your picked cards include a duplicate — impossible with one deck';

/**
 * The Hold'em game root (D-07, 05-REVIEW WR-03): every Hold'em-scoped effect, state field and
 * JSX block extracted verbatim from App.tsx, so both games are sibling components under the
 * shell's mode fork. Renders its own control bar with <GameModeSwitcher /> as the first child,
 * keeping the shipped Hold'em DOM order byte-equivalent to the pre-extraction App.tsx (D-08).
 */
export function HoldemGame() {
  const runout = useGameStore((state) => state.runout);
  const street = useGameStore((state) => state.street);
  const revealedMask = useGameStore((state) => state.revealedMask);
  const dealNonce = useGameStore((state) => state.dealNonce);
  // Hold'em-local deck count (D-01, D-14): read from gameStore, following the same
  // one-selector-per-field subscription style as the fields above.
  const deckCount = useGameStore((state) => state.deckCount);
  const setDeckCount = useGameStore((state) => state.setDeckCount);
  // A4 guard input (07-05): the picks are the ONLY state that survives a deck toggle into the
  // next deal(), so they are the only impossibility source for a 2 -> 1 switch. One count-aware
  // predicate from pickerStore — never a second duplicate-counting loop in the UI.
  const picks = usePickerStore((state) => state.picks);
  const duplicateInPicks = hasDuplicatePick(picks);
  // Subscribed value — this dependency-array entry is what re-runs the effect on every gate
  // drain step, so the gate can always re-open. The 03-RESEARCH deadlock (dependency unchanged
  // between renders while the live value flipped, effect never re-running) only applies when a
  // live getState() read REPLACES this subscription; the effect below additionally does one live
  // read as a SECONDARY guard (05-REVIEW CR-01 fix) that supplements — never replaces — this
  // subscribed dependency.
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
    //
    // D-07 extraction note: now that <HoldemGame /> only mounts while mode === 'holdem', this
    // early return is belt-and-braces — but the `mode` subscription and its dependency-array
    // entry remain LOAD-BEARING for teardown ordering: the effect cleanup firing on the mode
    // flip (dependency change and/or unmount) IS the entire mode-switch cancellation mechanism.
    // Do not "simplify" either away.
    if (mode !== 'holdem') return;

    // Animation gate (D-11/D-12, TBL-04): checked before the cache-hit branch below — a
    // settled-cache hit has no worker timing dependency today and is the branch most likely to
    // be left ungated (03-RESEARCH Pitfall 1), so it must wait for animation completion exactly
    // like a live run does. No odds number may change, and no cached snapshot may be applied,
    // while any card describing that knowledge state is still mid-flight.
    //
    // CR-01 fix (05-REVIEW): the live read is a SECONDARY guard for the one commit where cards
    // that mounted in THIS render flush registered with the gate AFTER the render closure
    // captured 0 but BEFORE this effect ran (passive effects flush child-first) — the shape a
    // mode switch-back re-mount has, where no gameStore action armed the gate synchronously
    // pre-render the way deal/advance/reveal do. The subscribed dependency above still drives
    // every re-run, so the 03-RESEARCH deadlock (which only applies when a live read REPLACES
    // the subscription) cannot recur: any skip here is always followed by a dependency-driven
    // re-run when the subscribed count next changes, including its final drain step to 0.
    if (pendingAnimationCount > 0 || useUiStore.getState().pendingAnimationCount > 0) return;

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

    const conditioned = deriveConditionedState(runout, street, revealedMask, deckCount);
    void startSimulation(
      conditioned,
      (snapshot) => {
        if (ignore) return;
        // Same-key/wrong-generation guard (06-REVIEW CR-02): a late snapshot from a run
        // whose HAND has been superseded must neither display nor cache. deal() clears the
        // cache SYNCHRONOUSLY, but this callback stays live until React's passive-effect
        // flush runs the ignore-flag cleanup — worker messages are macrotasks that can be
        // delivered inside that gap, re-caching the stale hand's odds under the unchanged
        // (street, revealedMask) key AFTER the clear (a re-deal lands on the SAME
        // "preflop|0" key with different cards). dealNonce is the hand's generation
        // identity; street/mask changes are already covered by the key itself.
        if (useGameStore.getState().dealNonce !== dealNonce) return;
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
    // `deckCount` here is belt-and-braces under D-02 (a mid-hand change bumps `dealNonce`, an
    // idle change early-returns at `!runout` above); its position IMMEDIATELY BEFORE
    // pendingAnimationCount is load-bearing — the mode-shell guard pins that this array
    // literally ends `pendingAnimationCount, mode]`.
  }, [runout, street, revealedMask, dealNonce, deckCount, pendingAnimationCount, mode]);

  // WR-01 fix (05-REVIEW): leaving Hold'em cancels the run the banner was describing, so the
  // error no longer describes anything on screen — clear it, or it re-mounts (and re-announces
  // via role="alert") the instant the user switches back, sitting stale for the whole re-mount.
  // Same "banner no longer describes what's on screen" class as 02-REVIEW WR-01. Deferred via a
  // microtask, mirroring the cache-hit branch's setState discipline above
  // (react-hooks/set-state-in-effect flags a setState reachable from the effect's own
  // synchronous scope).
  useEffect(() => {
    if (mode !== 'holdem') queueMicrotask(() => setErrorMessage(null));
  }, [mode]);

  // WR-02 fix (05-REVIEW): a blackjack -> holdem switch marks holdemRestorePending, which the
  // re-mounting card layer consumes at RENDER time (AnimatedCard captures it once at mount) to
  // restore the exact table left behind instantly — no deal-choreography replay, no gate arming
  // (D-07, 05-UI-SPEC "instant DOM swap"). Acknowledged here, in the same commit's effect phase
  // — after every restored card has already captured it — so a later Deal mounts fresh cards
  // with the flag down and animates normally. Idempotent and StrictMode-safe (a double-invoked
  // ack is just a second no-op write).
  useEffect(() => {
    if (mode === 'holdem') useGameModeStore.getState().ackHoldemRestore();
  }, [mode]);

  return (
    <>
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
        {/* Structural twin of the mode switcher (D-01, UI-SPEC A2 — last control-bar child):
            segment labels never change with state; `aria-pressed` alone carries which count is
            active. The active segment is never `disabled` — clicking it is a harmless no-op
            routed through the store's same-value early return. There is deliberately NO
            confirmation dialog for the mid-hand path (A3): the app's silent-system-behaviour
            precedent plus the copy block-list rule one out — the fresh deal itself is the
            primary affordance (the full re-deal choreography plays the same frame the user
            clicks), and the pre-click `title` below is the same lightweight disclosure
            convention the picker cells already use. The on-table hand NEVER blocks a switch —
            D-02's fresh deal discards it — so the picks are the only impossibility source. */}
        <div data-testid="holdem-deck-toggle" role="group" aria-label="Deck count">
          <button
            type="button"
            data-testid="holdem-deck-toggle-1"
            aria-pressed={deckCount === 1}
            // A4 guard (this segment ONLY): switching DOWN to one deck while the picks hold
            // two copies of one value is impossible with one physical deck. Structurally
            // one-directional: at deckCount === 1 the picker's count-aware setPick already
            // blocks a second copy and the store refuses a duplicated 2 -> 1 switch, so this
            // boolean is false whenever this segment is ACTIVE — the active segment is never
            // disabled, and no pick is ever cleared by the guard. When both titles would apply
            // (mid-hand AND duplicated picks), the A4 guard title takes precedence here.
            disabled={duplicateInPicks}
            title={
              duplicateInPicks
                ? DUPLICATE_PICK_GUARD_TITLE
                : deckCount === 2 && runout !== null
                  ? FRESH_DEAL_TITLE
                  : undefined
            }
            onClick={() => setDeckCount(1)}
          >
            1 deck
          </button>
          <button
            type="button"
            data-testid="holdem-deck-toggle-2"
            aria-pressed={deckCount === 2}
            // A3 honesty affordance: the INACTIVE segment discloses the fresh-deal consequence
            // while a hand is on the table; no title while idle, never on the active segment.
            title={deckCount === 1 && runout !== null ? FRESH_DEAL_TITLE : undefined}
            onClick={() => setDeckCount(2)}
          >
            2 decks
          </button>
        </div>
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
