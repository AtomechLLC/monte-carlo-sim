/**
 * D-02: face-down card rendering, shared by every hidden card on the felt.
 *
 * A back never carries alt text — its meaning ("this card is hidden") is always conveyed by an
 * ancestor (a seat button's aria-label, or a decorative/aria-hidden wrapper), never by this
 * element's own accessible name (UI-SPEC Accessibility Contract).
 *
 * The src carries the `import.meta.env.BASE_URL` prefix for the same reason `cardAssetPath` does:
 * on the GitHub Pages project site the app is served from `/monte-carlo-sim/`, and a runtime
 * root-relative path would 404 there. `BASE_URL` is `'/'` in dev and under Vitest, so this is a
 * no-op outside a subpath production build.
 */
export function CardBack() {
  return (
    <img
      className="playing-card card-back"
      src={`${import.meta.env.BASE_URL}cards/back.svg`}
      alt=""
      draggable={false}
    />
  );
}
