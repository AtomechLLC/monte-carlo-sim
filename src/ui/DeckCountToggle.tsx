import type { DeckCount } from '../engine/shoe';

interface DeckCountToggleProps {
  testidPrefix: string;
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
 * `aria-pressed` alone carries which count is active. The active segment is never disabled —
 * clicking it is a harmless no-op routed through each game's same-value early return — and
 * the second segment carries no disabled path at all (both guards are structurally
 * one-directional, 2 -> 1 only). Because the titles arrive pre-computed, guard-title
 * precedence stays entirely at the call sites and the rendered DOM stays byte-identical to
 * the pre-extraction inline markup (D-06).
 */
export function DeckCountToggle({
  testidPrefix,
  deckCount,
  onSelect,
  oneDeckDisabled,
  oneDeckTitle,
  twoDecksTitle,
}: DeckCountToggleProps) {
  return (
    <div data-testid={testidPrefix} role="group" aria-label="Deck count">
      <button
        type="button"
        data-testid={`${testidPrefix}-1`}
        aria-pressed={deckCount === 1}
        disabled={oneDeckDisabled}
        title={oneDeckTitle}
        onClick={() => onSelect(1)}
      >
        1 deck
      </button>
      <button
        type="button"
        data-testid={`${testidPrefix}-2`}
        aria-pressed={deckCount === 2}
        title={twoDecksTitle}
        onClick={() => onSelect(2)}
      >
        2 decks
      </button>
    </div>
  );
}
