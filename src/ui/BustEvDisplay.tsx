import { useBlackjackOddsStore } from '../state/blackjackOddsStore';
import { useUiStore } from '../state/uiStore';
import { formatPct } from './formatPct';
import { formatEv } from './formatEv';

// Locked copy (06-UI-SPEC Copywriting Contract — verbatim, no rewording). Each string is a
// named module-scope constant so a guard can pin it and a reword is one edit.
const TRIALS_LABEL = 'Trials';
const BUST_LABEL = 'Bust if you hit';
const STAND_GROUP_CAPTION = 'If you stand';
const WIN_LABEL = 'Win';
const PUSH_LABEL = 'Push';
// A15: display copy says 'Loss' (noun-consistent with Hold'em's shipped Win/Tie/Loss) while
// the testid and store field use `lose` — the two vocabularies are pinned independently in
// the test suite so a future rename of one cannot silently drag the other.
const LOSS_LABEL = 'Loss';
const EV_GROUP_CAPTION = 'Expected value';
const EV_GROUP_SUBTITLE = 'Per unit wagered';
const STAND_TILE_LABEL = 'Stand';
const HIT_TILE_LABEL = 'Hit';
// D-05 (locked verbatim, ALWAYS visible, NEVER a tooltip): every surveyed real-world Hit-EV
// calculator computes optimal continuation, while this project's EV(Hit) is the structurally
// simpler "draw exactly one card then stand" (06-RESEARCH's EV-comparability caveat).
// Presenting the number without that visible basis invites a false comparison against
// basic-strategy calculators — so the sub-copy is mandatory DOM text, never a `title`,
// never an `aria-label`, never conditional.
const HIT_TILE_SUBCOPY = 'hit once, then stand';

/**
 * Rows 1-3 of the odds cluster's A7 order: the Trials + bust-if-hit stat row, the
 * "If you stand" Win/Push/Loss group, and the two per-unit EV tiles (BJ-03, BJ-04).
 * Structurally modelled on `WinTieLossDisplay` (dl/dt/dd with the shipped `.odds-stat*`
 * classes); the `.bj-odds-group*` / `.bj-ev-*` class names are the binding CSS contract
 * defined by plan 06-05 — this file emits them and writes no CSS.
 */
export function BustEvDisplay() {
  // Per-field selectors (06-REVIEW IN-01): the codebase-wide store discipline — a
  // selector-less subscription re-renders on EVERY store write, including settledCache
  // copy-on-write Map replacements and clearCache() calls that change nothing shown here.
  const trialsCompleted = useBlackjackOddsStore((state) => state.trialsCompleted);
  const bustIfHitCount = useBlackjackOddsStore((state) => state.bustIfHitCount);
  const standOutcomes = useBlackjackOddsStore((state) => state.standOutcomes);
  const hitOutcomes = useBlackjackOddsStore((state) => state.hitOutcomes);
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <>
      <dl className="odds-stats">
        <div className="odds-stat">
          <dt className="odds-stat__label">{TRIALS_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="blackjack-trial-counter">
            {pending ? '—' : trialsCompleted.toLocaleString()}
          </dd>
        </div>
        <div className="odds-stat">
          <dt className="odds-stat__label">{BUST_LABEL}</dt>
          <dd className="odds-stat__value" data-testid="blackjack-bust-pct">
            {formatPct(bustIfHitCount, trialsCompleted, pending)}
          </dd>
        </div>
      </dl>
      <section className="bj-odds-group">
        <p className="bj-odds-group__caption">{STAND_GROUP_CAPTION}</p>
        <dl className="odds-stats">
          <div className="odds-stat">
            <dt className="odds-stat__label">{WIN_LABEL}</dt>
            <dd className="odds-stat__value" data-testid="blackjack-stand-win-pct">
              {formatPct(standOutcomes.win, trialsCompleted, pending)}
            </dd>
          </div>
          <div className="odds-stat">
            <dt className="odds-stat__label">{PUSH_LABEL}</dt>
            <dd className="odds-stat__value" data-testid="blackjack-stand-push-pct">
              {formatPct(standOutcomes.push, trialsCompleted, pending)}
            </dd>
          </div>
          <div className="odds-stat">
            <dt className="odds-stat__label">{LOSS_LABEL}</dt>
            <dd className="odds-stat__value" data-testid="blackjack-stand-lose-pct">
              {formatPct(standOutcomes.lose, trialsCompleted, pending)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="bj-odds-group">
        <p className="bj-odds-group__caption">{EV_GROUP_CAPTION}</p>
        <p className="bj-odds-group__subtitle">{EV_GROUP_SUBTITLE}</p>
        <div className="bj-ev-tiles">
          <div className="bj-ev-tile">
            <span className="bj-ev-tile__label">{STAND_TILE_LABEL}</span>
            <span className="bj-ev-tile__value" data-testid="blackjack-ev-stand">
              {formatEv(standOutcomes, trialsCompleted, pending)}
            </span>
          </div>
          <div className="bj-ev-tile">
            <span className="bj-ev-tile__label">{HIT_TILE_LABEL}</span>
            <span className="bj-ev-tile__value" data-testid="blackjack-ev-hit">
              {formatEv(hitOutcomes, trialsCompleted, pending)}
            </span>
            <span className="bj-ev-tile__sub">{HIT_TILE_SUBCOPY}</span>
          </div>
        </div>
      </section>
    </>
  );
}
