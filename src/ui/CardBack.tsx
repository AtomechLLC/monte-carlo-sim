/**
 * D-02: face-down card rendering, shared by every hidden card on the felt.
 *
 * A back never carries alt text — its meaning ("this card is hidden") is always conveyed by an
 * ancestor (a seat button's aria-label, or a decorative/aria-hidden wrapper), never by this
 * element's own accessible name (UI-SPEC Accessibility Contract).
 */
export function CardBack() {
  return <img className="playing-card card-back" src="/cards/back.svg" alt="" draggable={false} />;
}
