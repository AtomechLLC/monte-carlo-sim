import { useGameStore } from '../state/gameStore';
import { STREET_LABEL } from '../engine/streets';

/**
 * The street transport (Rewind · current street · Advance) — one of the two purpose-groups in
 * the control bar's "the hand" row.
 *
 * The `<h2>Street</h2>` is VISUALLY HIDDEN rather than deleted (control-bar reorganization,
 * 260825): it was rendering as a stray floating heading above an undifferentiated row of five
 * controls, but it is still what gives this group its accessible name via `aria-labelledby`,
 * and it stays in the accessibility tree and in the document outline. The visible "Pre-Flop" /
 * "Flop" / … label between the two buttons already communicates the state sighted users need,
 * so the heading was doing no visual work — only a11y work, which `.visually-hidden` keeps.
 *
 * `role="group"` lives HERE and not at the call site on purpose: `App.modeShell.guard.test.ts`
 * pins ui/HoldemGame.tsx and ui/BlackjackControls.tsx to contain no group-role markup in any
 * quoting style (Phase 8 SC1 — the deck-toggle extraction's single-source claim), and this file
 * is not in that pin's list. The other new wrappers are plain class-only divs: an unnamed
 * `group` role adds nothing to the accessibility tree anyway.
 */
const STREET_HEADING_ID = 'street-controls-heading';

export function StreetControls() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);
  const advanceStreet = useGameStore((state) => state.advanceStreet);
  const rewindStreet = useGameStore((state) => state.rewindStreet);

  const noHand = runout === null;

  return (
    <div
      className="control-group control-group--street"
      role="group"
      aria-labelledby={STREET_HEADING_ID}
    >
      <h2 id={STREET_HEADING_ID} className="visually-hidden">
        Street
      </h2>
      <button type="button" data-testid="rewind-button" onClick={rewindStreet} disabled={noHand || street === 'preflop'}>
        Rewind
      </button>
      <span data-testid="street-label">{STREET_LABEL[street]}</span>
      <button type="button" data-testid="advance-button" onClick={advanceStreet} disabled={noHand || street === 'river'}>
        Advance
      </button>
    </div>
  );
}
