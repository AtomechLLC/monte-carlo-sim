import { motion, useReducedMotion } from 'motion/react';
import { useBlackjackStore } from '../state/blackjackStore';
import { useUiStore } from '../state/uiStore';
import { handTotal, isNatural } from '../engine/blackjackHandValue';

/** UI-SPEC "Animation Choreography Contract" — Outcome banner enter: 150ms fade + 4px rise. */
const BANNER_ENTER_DURATION_S = 0.15;
const BANNER_ENTER_RISE_PX = 4;

interface OutcomeCopyRow {
  heading: string;
  /** `p`/`d` are the final player/dealer totals (06-UI-SPEC's `{p}`/`{d}` substitutions). */
  body: (p: number, d: number) => string;
}

/**
 * The eight-path win/push/lose copy table, LOCKED VERBATIM by 06-UI-SPEC's outcome-banner
 * copy contract. Each string lives here as a single named row so a reword is one edit and
 * the test suite (which transcribes the spec's strings independently) can pin drift.
 */
const OUTCOME_COPY: Record<
  | 'standHigher'
  | 'dealerBusts'
  | 'playerBusts'
  | 'standLower'
  | 'standEqual'
  | 'playerNatural'
  | 'dealerNatural'
  | 'bothNaturals',
  OutcomeCopyRow
> = {
  standHigher: { heading: 'You win', body: (p, d) => `Your ${p} beats the dealer's ${d}.` },
  dealerBusts: { heading: 'You win', body: (_p, d) => `The dealer busts with ${d}.` },
  playerBusts: { heading: 'Dealer wins', body: (p) => `You bust with ${p}.` },
  standLower: { heading: 'Dealer wins', body: (p, d) => `The dealer's ${d} beats your ${p}.` },
  standEqual: { heading: 'Push', body: (p) => `Both hands total ${p}.` },
  playerNatural: { heading: 'Blackjack — you win', body: () => 'Your natural pays 3:2.' },
  dealerNatural: { heading: 'Dealer blackjack', body: (p) => `The dealer's natural beats your ${p}.` },
  bothNaturals: { heading: 'Push', body: () => 'Two naturals — the round is a push.' },
};

/**
 * The round-resolution banner (A6, A16, T-06-28). Renders NOTHING unless the round is
 * resolved AND the animation gate is clear — the banner must never appear while a card is
 * in flight (the Stand playout's draws land first, then the banner enters). `role="status"`
 * (a polite live announcement of an outcome), never `role="alert"`: alert stays reserved
 * for error banners, and losing a round is an outcome, not a fault — which is also why the
 * styling uses the `--seat-badge-*` tokens and never `--destructive` (A6, D-14).
 *
 * Reading `round.dealerHole` here is an OUTCOME-time display read, not a simulation input:
 * the banner only exists when `roundPhase === 'resolved'`, and every resolution path sets
 * `revealedHole` in the same commit, so the hole is already face-up in the DOM (D-02 is
 * about the hidden-hole odds boundary, which this never crosses).
 */
export function BlackjackOutcomeBanner() {
  const roundPhase = useBlackjackStore((state) => state.roundPhase);
  const outcome = useBlackjackStore((state) => state.outcome);
  const playerNaturalWin = useBlackjackStore((state) => state.playerNaturalWin);
  const playerHand = useBlackjackStore((state) => state.playerHand);
  const round = useBlackjackStore((state) => state.round);
  const dealerPlayoutCards = useBlackjackStore((state) => state.dealerPlayoutCards);
  const gateClear = useUiStore((state) => state.pendingAnimationCount === 0);
  const reduce = useReducedMotion();

  if (roundPhase !== 'resolved' || !gateClear || round === null || outcome === null) {
    return null;
  }

  const player = handTotal(playerHand);
  const dealer = handTotal([round.dealerUpcard, round.dealerHole, ...dealerPlayoutCards]);
  // A resolved round's 2-card 21s are naturals by construction: deal() resolves either
  // side's natural immediately (D-03/D-03a), so neither a player-turn nor a Stand playout
  // can ever produce a NON-natural 2-card 21 in a resolved state.
  const dealerNatural = isNatural([round.dealerUpcard, round.dealerHole]);
  const playerNatural = isNatural(playerHand);

  const row =
    playerNatural && dealerNatural
      ? OUTCOME_COPY.bothNaturals
      : playerNaturalWin
        ? OUTCOME_COPY.playerNatural
        : dealerNatural
          ? OUTCOME_COPY.dealerNatural
          : player.bust
            ? OUTCOME_COPY.playerBusts
            : dealer.bust
              ? OUTCOME_COPY.dealerBusts
              : outcome === 'win'
                ? OUTCOME_COPY.standHigher
                : outcome === 'lose'
                  ? OUTCOME_COPY.standLower
                  : OUTCOME_COPY.standEqual;

  return (
    // `x: '-50%'` mirrors the stylesheet's translateX(-50%) centring: Motion writes an
    // inline `transform` while animating `y`, which would otherwise clobber the CSS
    // transform and knock the banner off-centre — carrying x here composes both.
    <motion.div
      data-testid="blackjack-outcome-banner"
      role="status"
      initial={{ opacity: 0, x: '-50%', y: BANNER_ENTER_RISE_PX }}
      animate={{ opacity: 1, x: '-50%', y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: BANNER_ENTER_DURATION_S, ease: 'easeOut' }}
    >
      <p className="bj-outcome-heading">{row.heading}</p>
      <p className="bj-outcome-body">{row.body(player.total, dealer.total)}</p>
    </motion.div>
  );
}
