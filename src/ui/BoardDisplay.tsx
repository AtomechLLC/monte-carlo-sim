import { AnimatePresence, useReducedMotion } from 'motion/react';
import { useGameStore } from '../state/gameStore';
import { STREET_BOARD_COUNT, previousStreet } from '../engine/streets';
import { BOARD_SIZE } from '../engine/cards';
import { PlayingCard } from './PlayingCard';
import { AnimatedCard } from './AnimatedCard';
import { dealOriginOffset, type PositionKey } from './tableGeometry';
import { useExitGate } from './useAnimationGate';

/** `0` -> `'community-0'` ... `4` -> `'community-4'` — the only cast site for this narrowing,
 * mirroring Seat.tsx's `${...} as const as 'seat-opponent-0' | ...` pattern for the same reason:
 * `PositionKey` is a closed union and TypeScript cannot narrow a template-literal `string` back
 * into it without an explicit assertion. */
function communityPositionKey(index: number): PositionKey {
  return `community-${index}` as const as PositionKey;
}

/**
 * The stagger index (0-based position within THIS street's newly-visible cards) for community
 * board index `index`, given how many cards were already visible at the previous street. At the
 * flop (0 previously visible) this yields 0, 1, 2 for board indices 0-2; at the turn (3
 * previously visible) it yields 0 for board index 3; at the river (4 previously visible) it
 * yields 0 for board index 4. Exported so BoardDisplay.test.tsx can assert the computation
 * directly rather than inspecting Motion's inline transition-delay style.
 */
// react-refresh/only-export-components: this pure helper is co-located with BoardDisplay
// because it computes BoardDisplay's own stagger-index contract (03-04-PLAN.md target_contracts)
// and is exported solely so BoardDisplay.test.tsx can assert the computation directly instead of
// inspecting Motion's inline transition-delay style — the same co-location tradeoff PlayingCard.tsx
// already accepts for cardAssetPath/cardAltText (Fast Refresh still works, it just can't prove it
// statically for this one extra export).
// eslint-disable-next-line react-refresh/only-export-components
export function communityDealIndex(index: number, previouslyVisibleCount: number): number {
  return index - previouslyVisibleCount;
}

export function BoardDisplay() {
  const street = useGameStore((state) => state.street);
  const runout = useGameStore((state) => state.runout);
  const dealNonce = useGameStore((state) => state.dealNonce);
  const reduce = useReducedMotion();

  const visibleBoard = runout ? runout.board.slice(0, STREET_BOARD_COUNT[street]) : [];
  const placeholderCount = BOARD_SIZE - visibleBoard.length;
  const previouslyVisibleCount = STREET_BOARD_COUNT[previousStreet(street)];

  // Container-level exit gate (03-04, D-08/D-12): registers when visibleBoard.length DROPS (a
  // rewind removing board cards) so the earlier street's cached odds wait for the departing
  // cards to actually finish leaving before a cache-hit snapshot is applied. `dealNonce` is the
  // reset key — see useExitGate's own doc comment for why a re-deal must re-baseline the count
  // tracking rather than register a hold for what is an instant replacement, not an exit.
  const releaseExitGate = useExitGate(visibleBoard.length, !reduce, dealNonce);

  return (
    <div className="community-area">
      <h2 className="visually-hidden">Board</h2>
      {visibleBoard.length === 0 ? (
        <div data-testid="board-empty-state">No community cards yet</div>
      ) : (
        <div data-testid="board-cards">
          {/* Keyed by dealNonce so a re-deal replaces the WHOLE presence tree instantly rather
              than letting AnimatePresence diff old-keyed children against new ones and play an
              exit transition on them — removing old-keyed children under AnimatePresence IS an
              exit by default, so without this key the "Re-deal cancellation" row (instant, no
              exit) would regress into playing the "Rewind exit" transition on the old board. */}
          <AnimatePresence key={dealNonce} onExitComplete={releaseExitGate}>
            {visibleBoard.map((card, index) => (
              <AnimatedCard
                key={`community-${index}-${dealNonce}`}
                animationKey={`community-${index}-${dealNonce}`}
                origin={dealOriginOffset(communityPositionKey(index))}
                dealIndex={communityDealIndex(index, previouslyVisibleCount)}
                className="card-slot card-slot--community"
              >
                <PlayingCard card={card} />
              </AnimatedCard>
            ))}
          </AnimatePresence>
        </div>
      )}
      {/* UI-SPEC A8: not-yet-revealed community positions render as dashed placeholders,
          siblings of board-cards/board-empty-state — never children of board-cards, since
          existing acceptance tests assert board-cards' child count equals the visible count. */}
      {Array.from({ length: placeholderCount }, (_, i) => (
        <div key={i} className="card-slot card-slot--community card-placeholder" aria-hidden="true" />
      ))}
    </div>
  );
}
