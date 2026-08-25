import { useBlackjackStore } from '../state/blackjackStore';
import { hasPhysicalDuplicate } from '../engine/blackjackConditioning';
import { DeckCountToggle } from './DeckCountToggle';

/** Locked A3 duplicate-guard `title` (06-UI-SPEC Copywriting Contract — verbatim). */
const DUPLICATE_GUARD_TITLE = 'The dealt cards include a duplicate — impossible with one deck';

/**
 * The Blackjack control cluster (BJ-05, BJ-07): Deal / Hit / Stand plus the blackjack-local
 * deck-count segmented toggle. Reads ONLY `useBlackjackStore` (D-10) — no Hold'em store, no
 * odds store, and no animation-gate store: the gate is armed by the blackjack store's own
 * actions, never from here (the mode-shell guard pins these absences at source level). The
 * reveal button deliberately does NOT live here — it wraps the hole card itself inside the
 * dealer area (plan 06-05), because its whole affordance IS the card.
 */
export function BlackjackControls() {
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const round = useBlackjackStore((state) => state.round);
  const playerHand = useBlackjackStore((state) => state.playerHand);
  const dealerPlayoutCards = useBlackjackStore((state) => state.dealerPlayoutCards);
  const deckCount = useBlackjackStore((state) => state.deckCount);
  const deal = useBlackjackStore((state) => state.deal);
  const hit = useBlackjackStore((state) => state.hit);
  const stand = useBlackjackStore((state) => state.stand);
  const setDeckCount = useBlackjackStore((state) => state.setDeckCount);

  // Hit/Stand are enabled ONLY mid-decision (UI-SPEC interaction-states matrix): disabled
  // while idle (nothing to act on) and while resolved (the round is over). The instant Stand
  // is clicked, roundPhase leaves 'player-turn', so both disable immediately — no
  // double-action during the dealer playout.
  const actionsDisabled = roundPhase !== 'player-turn';

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

  return (
    <>
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
      {/* Shared segmented control (Phase 8 D-01, SC1): the markup lives in DeckCountToggle;
          the A3 guard predicate above and the locked title computation stay at this call
          site, passed pre-computed — the shared component owns no game logic. The first
          segment ONLY can ever disable (06-REVIEW WR-01: the hidden hole counts — it is a
          dealt card), and the second segment never carries a title in any state. */}
      <DeckCountToggle
        testidPrefix="blackjack-deck-toggle"
        deckCount={deckCount}
        onSelect={setDeckCount}
        oneDeckDisabled={duplicateOnTable}
        oneDeckTitle={duplicateOnTable ? DUPLICATE_GUARD_TITLE : undefined}
      />
    </>
  );
}
