/**
 * The Phase 5 Blackjack placeholder (D-03). Reuses the existing `.felt` shell class unmodified —
 * the felt IS the placeholder's shell — but renders NO seats, NO community slots, NO deck-origin
 * stack, and NO absolute positioning: a single centered empty-state block. Reads no other
 * store in this codebase (D-05) — this component is entirely unaware Hold'em exists. Renders
 * zero interactive gameplay controls of any kind — none live, none inert (D-03 explicitly
 * prohibits both, unlike the Card Picker's precedent). Static placeholder — no live-announcing
 * region, matching the empty-hand-state precedent.
 */
export function BlackjackScene() {
  return (
    <div data-testid="blackjack-scene" className="felt">
      <div data-testid="blackjack-empty-state">
        <h2>The Blackjack table deals next</h2>
        <p>
          Player hand, dealer upcard, live bust and outcome odds, and Stand-vs-Hit choices land
          here next. Switch back to Hold'em to keep watching odds converge now.
        </p>
      </div>
    </div>
  );
}
