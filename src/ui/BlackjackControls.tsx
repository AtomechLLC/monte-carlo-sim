import { useBlackjackStore } from '../state/blackjackStore';
import { hasPhysicalDuplicate } from '../engine/blackjackConditioning';
import { DeckCountToggle } from './DeckCountToggle';

/** Locked A3 duplicate-guard `title` (06-UI-SPEC Copywriting Contract — verbatim). */
const DUPLICATE_GUARD_TITLE = 'The dealt cards include a duplicate — impossible with one deck';

/*
 * The Blackjack controls (BJ-05, BJ-07), now TWO exports rather than one, because the 260825
 * reorganization splits them by what they act on and puts each where it acts:
 *
 *   <BlackjackSessionControls />  the shoe size — ABOVE the felt, beside the game-mode switcher
 *   <BlackjackControls />         Deal / Hit / Stand — FLOATING ON the felt, bottom-left
 *
 * They are two components in ONE file on purpose. Phase 8's SC1 pins are file-scoped: this
 * path must import the shared deck-count component, must render it, must keep the contractual
 * `blackjack-deck-toggle` prefix, and must contain no grouping-role markup or group label. A
 * split across two files would have moved the deck-toggle call site out from under all four.
 *
 * Both read ONLY `useBlackjackStore` (D-10) — no Hold'em state, no odds state, and no
 * animation-gate state: the gate is armed by the blackjack store's own actions, never from here
 * (the mode-shell guard pins these absences at source level by sweeping this file's RAW text
 * for the forbidden module names, which is why the prose here names none of them). The reveal
 * button deliberately lives in neither — it wraps the hole card itself inside the dealer area
 * (plan 06-05), because its whole affordance IS the card.
 *
 * Note the asymmetry with Hold'em's transport group, which carries a named grouping role: the
 * wrappers below are plain class-only divs, because the SC1 pin forbids that markup in this file
 * in ANY quoting style. Nothing is lost — an unnamed grouping role adds nothing to the
 * accessibility tree, and the deck toggle already carries its own named one from inside the
 * shared component that renders it.
 */

/**
 * The shoe control, above the felt. It answers "what am I playing", persists across rounds, and
 * acts on no card on the table — which is exactly why it is up there with the game-mode switcher
 * rather than down on the felt with Deal/Hit/Stand.
 */
export function BlackjackSessionControls() {
  const round = useBlackjackStore((state) => state.round);
  const playerHand = useBlackjackStore((state) => state.playerHand);
  const dealerPlayoutCards = useBlackjackStore((state) => state.dealerPlayoutCards);
  const deckCount = useBlackjackStore((state) => state.deckCount);
  const setDeckCount = useBlackjackStore((state) => state.setDeckCount);

  // A3 duplicate guard over the round's PHYSICAL cards — the player hand, the upcard, the
  // predetermined hole (hidden or not) and every playout draw — via the engine's
  // count-aware sole reader (06-REVIEW WR-01; a Set-based check would collapse the very
  // duplicate copies it is meant to detect, PITFALLS Pitfall 6). The hole is a real dealt
  // card (D-01): a visible-cards-only guard left "1 deck" enabled when the HIDDEN hole
  // duplicated a visible card, and the toggle then silently created an impossible one-deck
  // table with a corrupted 53-card ledger. DELIBERATE, DOCUMENTED ~one-bit D-02 leak
  // (06-REVIEW WR-01 trade-off): while the hole is hidden and no visible duplicate exists,
  // this disabled state tells the user the hole duplicates a visible card's VALUE — the
  // accepted cost of never entering an impossible physical state (blackjackStore's
  // setDeckCount refuses the same switch as the correctness backstop). Structurally
  // one-directional: only the 2 -> 1 direction can ever be blocked — at deckCount === 1
  // the shoe holds one physical copy of each card, so no duplicate can exist among the
  // dealt cards and this boolean is false by construction (the active "1 deck" segment is
  // therefore never disabled, per A3/A4).
  const duplicateOnTable =
    round !== null && hasPhysicalDuplicate(round, playerHand, dealerPlayoutCards);

  // Shared segmented control (Phase 8 D-01, SC1): the markup lives in DeckCountToggle; the A3
  // guard predicate above and the locked title computation stay at this call site, passed
  // pre-computed — the shared component owns no game logic. The first segment ONLY can ever
  // disable (06-REVIEW WR-01: the hidden hole counts — it is a dealt card), and the second
  // segment never carries a title in any state.
  return (
    <DeckCountToggle
      testidPrefix="blackjack-deck-toggle"
      deckCount={deckCount}
      onSelect={setDeckCount}
      oneDeckDisabled={duplicateOnTable}
      oneDeckTitle={duplicateOnTable ? DUPLICATE_GUARD_TITLE : undefined}
    />
  );
}

/**
 * The round actions, floating on the felt at its bottom-left — they act on the hand in front of
 * you, so they sit on the table with it. Rendered into <BlackjackTable />'s on-felt chrome slot,
 * which makes `.felt` their DOM parent (see the `.felt-controls` block in App.css for the
 * ellipse geometry that keeps them on the green and clear of the player's hand).
 */
export function BlackjackControls() {
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const deal = useBlackjackStore((state) => state.deal);
  const hit = useBlackjackStore((state) => state.hit);
  const stand = useBlackjackStore((state) => state.stand);

  // Hit/Stand are enabled ONLY mid-decision (UI-SPEC interaction-states matrix): disabled
  // while idle (nothing to act on) and while resolved (the round is over). The instant Stand
  // is clicked, roundPhase leaves 'player-turn', so both disable immediately — no
  // double-action during the dealer playout.
  const actionsDisabled = roundPhase !== 'player-turn';

  return (
    <div className="felt-controls felt-controls--blackjack">
      <div className="control-group control-group--hand-actions">
        {/* A2 (06-UI-SPEC, planner decision recorded): Deal is NEVER disabled, in any round
            phase — a mid-round click silently abandons the current round and deals a new one,
            matching Phase 3's re-deal-during-animation precedent (03-CONTEXT D-10). A
            confirmation dialog here would violate both the app's silent-system-behaviour
            precedent and the copy block-list ("Cancel"/"OK"), and blackjack has no rewind, so
            Deal-as-escape-hatch is the only way out of a round the user has lost interest in. */}
        <button type="button" data-testid="blackjack-deal-button" onClick={deal}>
          Deal
        </button>
        <button type="button" data-testid="blackjack-hit-button" disabled={actionsDisabled} onClick={hit}>
          Hit
        </button>
        <button type="button" data-testid="blackjack-stand-button" disabled={actionsDisabled} onClick={stand}>
          Stand
        </button>
      </div>
    </div>
  );
}
