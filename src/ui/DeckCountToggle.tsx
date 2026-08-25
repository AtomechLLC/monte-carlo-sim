import type { DeckCount } from '../engine/shoe';
import type { DeckTogglePrefix } from './deckTogglePrefix';

interface DeckCountToggleProps {
  /** D-02's two contractual prefixes, not a bare string (08-REVIEW IN-03). The union is
   *  declared in its own module so this component keeps naming neither game — see
   *  ./deckTogglePrefix.ts for why both rules have to hold at once. */
  testidPrefix: DeckTogglePrefix;
  deckCount: DeckCount;
  onSelect: (deckCount: DeckCount) => void;
  oneDeckDisabled?: boolean;
  oneDeckTitle?: string;
  twoDecksTitle?: string;
}

/**
 * The single shared deck-count segmented control (Phase 8 D-01, SC1) — the structural twin of
 * GameModeSwitcher, rendered by BOTH games' control bars. Fully props-driven: it owns no
 * state, reads nothing global, and never arms the animation gate — every per-game difference
 * (the testid prefix per D-02, the active count, the one-directional guard disabling, the
 * PRE-COMPUTED per-segment titles) arrives via props from the call site, and each game's deck
 * count keeps living in each game's own store. Segment labels never change with state;
 * `aria-pressed` alone carries which count is active. Because the titles arrive pre-computed,
 * guard-title precedence stays entirely at the call sites and the rendered DOM stays
 * byte-identical to the pre-extraction inline markup (D-06).
 *
 * What this component GUARANTEES BY ITSELF, whatever a call site passes (08-UI-SPEC binding
 * rule 6 and 07 A3, made structural per 08-REVIEW WR-01):
 *   - The ACTIVE segment is never `disabled` and never carries a `title`. Both attributes are
 *     gated on the segment being INACTIVE, so no call site can render an inoperable control
 *     (the pressed segment disabled, with no visible way back — a WCAG operable-toggle
 *     violation) or hang a tooltip on the pressed segment.
 *   - The second segment has no `disabled` path at all: the prop does not exist on it, so it
 *     is unreachable rather than merely `disabled={false}`.
 * Clicking the active segment stays a harmless no-op routed through each game's own same-value
 * early return — the component adds no suppression layer of its own (08-UI-SPEC A4).
 *
 * The active-segment gating is byte-identical to the previous unconditional form in every
 * state either call site can reach: both guard predicates are structurally one-directional
 * (2 -> 1 only) and the pre-click title is already undefined on whichever segment is active,
 * so the nine-state DOM golden stays green unmodified. It exists for the call site that does
 * not exist yet — DECK-02's deferred v2.x work — which must not be able to derive its guard
 * predicate without a direction check and ship a dead control.
 */
export function DeckCountToggle({
  testidPrefix,
  deckCount,
  onSelect,
  oneDeckDisabled,
  oneDeckTitle,
  twoDecksTitle,
}: DeckCountToggleProps) {
  // The active-segment invariant is enforced HERE, by construction, rather than trusted to
  // every call site's guard-predicate derivation (08-REVIEW WR-01). `undefined` is the same
  // omission React already applies to an absent prop, so gating changes no rendered byte in
  // any state a call site can currently reach.
  const oneDeckActive = deckCount === 1;
  const twoDecksActive = deckCount === 2;

  return (
    <div data-testid={testidPrefix} role="group" aria-label="Deck count">
      <button
        type="button"
        data-testid={`${testidPrefix}-1`}
        aria-pressed={oneDeckActive}
        disabled={oneDeckActive ? undefined : oneDeckDisabled}
        title={oneDeckActive ? undefined : oneDeckTitle}
        onClick={() => onSelect(1)}
      >
        1 deck
      </button>
      <button
        type="button"
        data-testid={`${testidPrefix}-2`}
        aria-pressed={twoDecksActive}
        title={twoDecksActive ? undefined : twoDecksTitle}
        onClick={() => onSelect(2)}
      >
        2 decks
      </button>
    </div>
  );
}
