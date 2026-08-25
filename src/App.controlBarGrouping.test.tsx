import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import App from './App';
import * as simulationService from './state/simulationService';
import * as blackjackSimulationService from './state/blackjackSimulationService';
import { useGameStore } from './state/gameStore';
import { useOddsStore } from './state/oddsStore';
import { usePickerStore } from './state/pickerStore';
import { useUiStore } from './state/uiStore';
import { useGameModeStore } from './state/gameModeStore';
import { useBlackjackStore } from './state/blackjackStore';
import { useBlackjackOddsStore } from './state/blackjackOddsStore';
import type { Card } from '@poker-apprentice/types';

// Control-bar reorganization (260825), asked for in these words: "the controls for running the
// simulator are haphazard, please reorganize the UI."
//
// The bar used to be ONE flat wrapping row of five unrelated controls, with a stray visible
// <h2>Street</h2> floating above it. It is now two rows grouped by WHAT A CONTROL DOES —
// session/context, then the hand — identically in both games. This file pins that structure.
//
// WHY THIS FILE IS PART jsdom, PART SOURCE-READ, which no other suite in the repo is.
//
// The repo's convention is a hard split: `*.guard.test.ts` files opt into the bare Node test
// environment (via the per-file docblock directive — deliberately NOT spelled out anywhere in
// this file, because vitest scans leading comments for it and this suite must stay in jsdom)
// and read source text, while rendering suites never touch disk. That split cannot express the
// single most important invariant this change has, because the invariant spans both sides of
// it:
//
//     the three control-bar rules (44px hit area, --elev-raised, --elev-rest) are DIRECT-CHILD
//     selectors, and nesting every button one or two levels deeper silently orphans all three
//
// A source-only guard can prove App.css still contains SOME selector; it cannot prove that
// selector still reaches the buttons. A render-only test can find the buttons; it cannot see
// the stylesheet, because this harness deliberately loads none. So the selector strings below
// are pinned VERBATIM against App.css and then run through `Element.matches()` against the live
// DOM in both modes — the two halves of one claim, checked against each other. If either the
// CSS or the JSX moves without the other, this file goes red.
//
// It is also what proves the NEGATIVE half. The obvious fix for an orphaned `.control-bar >
// button` is to widen it to the descendant `.control-bar button`, which would additionally
// reach the segmented controls' SEGMENTS and, at (0,1,1) against their own (0,1,0) rule,
// out-specify and reflow both of them. The XOR sweep below makes that unrepresentable: every
// button in the bar must match exactly one of the two sizing rules, never both.
//
// Deliberately a NEW sibling file: the five frozen v1 suites (App.test.tsx,
// App.acceptance.test.tsx, App.phase3.acceptance.test.tsx, App.modeErrorBanner.test.tsx,
// App.modeSwitchRace.test.tsx) and the three golden files must not be edited — the same
// precedent as App.modeIsolation.test.tsx / App.holdemDeckToggle.test.tsx /
// App.deckToggleConsolidation.test.tsx.

// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Both services are mocked because <App /> reaches both games' import graphs whichever
// mode is on screen. The runs never settle here on purpose: this file asserts STRUCTURE, and a
// settled snapshot would only add noise to it.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));

vi.mock('./state/blackjackSimulationService', () => ({
  startBlackjackSimulation: vi.fn(),
  cancelBlackjackSimulation: vi.fn(),
}));

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * App.css with every comment removed — the view EVERY assertion below reads, borrowed from
 * ui/depthTypography.guard.test.ts's `withoutComments` for the same reason it exists there:
 * prose that happens to quote a declaration must neither satisfy nor trip a check that is about
 * real declarations. It is load-bearing here rather than defensive: the stylesheet's own
 * comments explain this re-anchoring, and therefore quote both the retired `.control-bar >
 * button` selector and the new branches — against the raw text, the "the retired selector is
 * gone" pin would fail and the "exactly one rule" lookups would find two.
 */
const appCss = readFileSync(join(SRC_DIR, 'App.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ---------------------------------------------------------------------------
// The selector contract, stated ONCE and used both ways: pinned verbatim against App.css
// (below) and executed against the live DOM via Element.matches().
// ---------------------------------------------------------------------------

/** The bar's plain action buttons — Deal, Set Up Scenario, Blackjack's Deal/Hit/Stand, and
 *  Rewind/Advance. Re-anchored from the shipped `.control-bar > button` by the 260825
 *  reorganization. */
const BAR_BUTTON_BRANCHES = [
  '.control-bar__row > button',
  '.control-bar__row .control-group > button',
] as const;

/** The segmented controls' SEGMENTS, which carry their own sizing rule (8px 16px padding, not
 *  8px 12px) and must therefore never be reached by the branches above. */
const SEGMENT_BRANCHES = [
  "[data-testid^='game-mode-switch-']",
  "[data-testid^='blackjack-deck-toggle-']",
  "[data-testid^='holdem-deck-toggle-']",
] as const;

/** The segmented control WRAPPERS, which is where the raised shadow hangs — one rocker lifting
 *  off the page, rather than a shadow on each segment inside it. */
const SEGMENT_WRAPPER_BRANCHES = [
  "[data-testid='game-mode-switcher']",
  "[data-testid='blackjack-deck-toggle']",
  "[data-testid='holdem-deck-toggle']",
] as const;

const SEPARATOR_SELECTOR = '.control-bar__row--hand > .control-group + .control-group';

const barButtonSelector = BAR_BUTTON_BRANCHES.join(', ');
const barButtonDisabledSelector = BAR_BUTTON_BRANCHES.map((s) => `${s}:disabled`).join(', ');
const segmentSelector = SEGMENT_BRANCHES.join(', ');
const segmentWrapperSelector = SEGMENT_WRAPPER_BRANCHES.join(', ');

/**
 * The single App.css rule containing all of `tokens`. Each chunk produced by splitting on `}`
 * carries one rule's selector prelude (plus any preceding comments) and its declarations — the
 * technique App.modeShell.guard.test.ts already uses on this stylesheet. Asserting exactly one
 * match is what makes a duplicated block detectable rather than silently tolerated.
 */
function ruleChunkWith(...tokens: string[]): string {
  const matches = appCss.split('}').filter((chunk) => tokens.every((token) => chunk.includes(token)));
  expect(
    matches,
    `expected exactly one App.css rule containing all of: ${tokens.join(' + ')} — zero means it ` +
      'was removed or reformatted, more than one means a duplicated block appeared',
  ).toHaveLength(1);
  return matches[0];
}

/**
 * The SELECTOR PRELUDE that App.css actually declares for the rule containing `tokens`, ready to
 * hand to `Element.matches()`.
 *
 * This is what closes the last gap. The pinned constants above bind the stylesheet to this file,
 * and running those constants against the DOM binds this file to the JSX — but a stylesheet edit
 * would then be caught only by the literal pin, one assertion deep. Executing the stylesheet's
 * OWN prelude against the live DOM means the negative claim ("no segment is reached") is checked
 * against whatever App.css really says today, not against what this file remembers it saying.
 */
function selectorOf(...tokens: string[]): string {
  const prelude = ruleChunkWith(...tokens).split('{')[0].trim();
  expect(prelude, `the rule for ${tokens.join(' + ')} must declare a selector`).not.toBe('');
  return prelude;
}

function resetStores() {
  useGameStore.setState({
    runout: null,
    street: 'preflop',
    revealedMask: 0,
    dealNonce: 0,
    deckCount: 1,
  });
  useBlackjackStore.setState({
    round: null,
    playerHand: [] as Card[],
    dealerPlayoutCards: [] as Card[],
    roundPhase: 'idle',
    revealedHole: false,
    outcome: null,
    playerNaturalWin: false,
    deckCount: 1,
    roundNonce: 0,
  });
  // Placed AFTER the store resets (every App-level harness in this repo does this): a reset must
  // never leave a stale armed count behind from a previous test.
  useUiStore.getState().resetAnimations();
  useOddsStore.getState().reset();
  useOddsStore.getState().clearCache();
  useBlackjackOddsStore.getState().reset();
  useBlackjackOddsStore.getState().clearCache();
  usePickerStore.getState().clearAll();
  useGameModeStore.setState({ mode: 'holdem' });
  vi.mocked(simulationService.startSimulation).mockReset();
  vi.mocked(simulationService.cancelSimulation).mockReset();
  vi.mocked(blackjackSimulationService.startBlackjackSimulation).mockReset();
  vi.mocked(blackjackSimulationService.cancelBlackjackSimulation).mockReset();
}

beforeEach(() => {
  resetStores();
});

/** The one control bar on screen. */
function controlBar(): HTMLElement {
  const bar = document.querySelector<HTMLElement>('.control-bar');
  expect(bar, 'exactly one .control-bar must be on screen').not.toBeNull();
  expect(
    document.querySelectorAll('.control-bar'),
    'the mode fork mounts one game at a time — two bars would mean both games are on screen',
  ).toHaveLength(1);
  return bar as HTMLElement;
}

function rowsOf(bar: HTMLElement): HTMLElement[] {
  return Array.from(bar.children) as HTMLElement[];
}

/** Blackjack is selected BEFORE the first render — no gate arming, no mode-switch round trip. */
function renderInBlackjack() {
  useGameModeStore.setState({ mode: 'blackjack' });
  return render(<App />);
}

describe('the bar is two rows, grouped by what a control DOES', () => {
  it("Hold'em: session/context row, then the-hand row, and nothing else", () => {
    render(<App />);
    const rows = rowsOf(controlBar());

    expect(
      rows,
      'exactly two rows: the flat five-control line the user called haphazard is gone, and a ' +
        'third row would mean a control found no home in either purpose',
    ).toHaveLength(2);
    expect(rows[0]).toHaveClass('control-bar__row', 'control-bar__row--session');
    expect(rows[1]).toHaveClass('control-bar__row', 'control-bar__row--hand');
  });

  it('Blackjack: the same two rows, in the same order — the two games stay coherent', () => {
    renderInBlackjack();
    const rows = rowsOf(controlBar());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('control-bar__row', 'control-bar__row--session');
    expect(rows[1]).toHaveClass('control-bar__row', 'control-bar__row--hand');
  });

  it('the session row pushes its two controls to opposite edges (space-between, not a lump on the left)', () => {
    // The stylesheet is not loaded in this harness, so the placement rule is pinned at source
    // level — the rendered half (which control is first, which is last) is asserted below.
    expect(
      ruleChunkWith('.control-bar__row--session {'),
      'the session row must space its two controls apart: they are the two things that persist ' +
        'across hands, and the shoe belongs at the far edge, not crowded against the switcher',
    ).toContain('justify-content: space-between');
  });
});

describe('every control is in the group that matches its purpose', () => {
  it("Hold'em session row: the game-mode switcher leads, the deck toggle trails, and nothing else is in it", () => {
    render(<App />);
    const [session] = rowsOf(controlBar());
    const children = Array.from(session.children);

    expect(children).toHaveLength(2);
    expect(children[0]).toBe(screen.getByTestId('game-mode-switcher'));
    expect(children[1]).toBe(screen.getByTestId('holdem-deck-toggle'));
  });

  it("Hold'em hand row: the Deal cluster, then the street transport", () => {
    render(<App />);
    const [, hand] = rowsOf(controlBar());
    const groups = Array.from(hand.children) as HTMLElement[];

    expect(
      groups,
      'two groups: "start/construct a hand" and "step through the hand" are different jobs, and ' +
        'the decorative rule between them is drawn by CSS on the second group, not by an element',
    ).toHaveLength(2);

    const [actions, street] = groups;
    expect(actions).toHaveClass('control-group', 'control-group--hand-actions');
    expect(Array.from(actions.children).map((el) => el.textContent)).toEqual([
      'Deal',
      'Set Up Scenario',
    ]);
    expect(actions.children[0]).toBe(screen.getByRole('button', { name: /^deal$/i }));
    expect(actions.children[1]).toBe(screen.getByTestId('set-up-scenario-button'));

    expect(street).toHaveClass('control-group', 'control-group--street');
    // The transport reads Rewind · label · Advance, after its visually-hidden heading.
    const transport = Array.from(street.children);
    expect(transport).toHaveLength(4);
    expect(transport[0].tagName).toBe('H2');
    expect(transport[1]).toBe(screen.getByTestId('rewind-button'));
    expect(transport[2]).toBe(screen.getByTestId('street-label'));
    expect(transport[3]).toBe(screen.getByTestId('advance-button'));
  });

  it("Hold'em: the two purposes do not leak into each other", () => {
    render(<App />);
    const [session, hand] = rowsOf(controlBar());

    // A cross-group placement is the exact regression this reorganization exists to prevent, so
    // it is asserted directly rather than left implied by the positive checks above.
    expect(session.contains(screen.getByRole('button', { name: /^deal$/i }))).toBe(false);
    expect(session.contains(screen.getByTestId('advance-button'))).toBe(false);
    expect(hand.contains(screen.getByTestId('holdem-deck-toggle'))).toBe(false);
    expect(hand.contains(screen.getByTestId('game-mode-switcher'))).toBe(false);
  });

  it('Blackjack session row: the same switcher, then the blackjack-prefixed deck toggle', () => {
    renderInBlackjack();
    const [session] = rowsOf(controlBar());
    const children = Array.from(session.children);

    expect(children).toHaveLength(2);
    expect(children[0]).toBe(screen.getByTestId('game-mode-switcher'));
    expect(children[1]).toBe(screen.getByTestId('blackjack-deck-toggle'));
  });

  it('Blackjack hand row: one cluster holding Deal / Hit / Stand — and so no separator to draw', () => {
    renderInBlackjack();
    const [, hand] = rowsOf(controlBar());
    const groups = Array.from(hand.children) as HTMLElement[];

    expect(
      groups,
      'blackjack has no transport, so its hand row holds ONE group — which is why the separator ' +
        'rule is written as `.control-group + .control-group`: it is self-limiting',
    ).toHaveLength(1);
    expect(groups[0]).toHaveClass('control-group', 'control-group--hand-actions');
    const actions = Array.from(groups[0].children);
    expect(actions).toHaveLength(3);
    expect(actions[0]).toBe(screen.getByTestId('blackjack-deal-button'));
    expect(actions[1]).toBe(screen.getByTestId('blackjack-hit-button'));
    expect(actions[2]).toBe(screen.getByTestId('blackjack-stand-button'));
  });

  it('Blackjack: the deck toggle is the session row\'s last child, mirroring Hold\'em', () => {
    renderInBlackjack();
    const [session] = rowsOf(controlBar());
    expect(session.lastElementChild).toBe(screen.getByTestId('blackjack-deck-toggle'));
  });
});

describe('the Street heading is hidden, not deleted — and it is what names its group', () => {
  it('is still an <h2> reading "Street", still in the accessibility tree', () => {
    render(<App />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Street' });
    expect(heading.tagName).toBe('H2');
    expect(
      heading,
      'the heading was a stray visible <h2> floating above an undifferentiated control row; the ' +
        'visible street label between the two buttons already says which street it is, so the ' +
        'heading does only a11y work now — and `.visually-hidden` is what keeps that work',
    ).toHaveClass('visually-hidden');
    // Hiding it from the accessibility tree too would be deletion by another route.
    expect(heading).not.toHaveAttribute('aria-hidden');
    expect(heading).not.toHaveAttribute('hidden');
  });

  it('names the transport group via aria-labelledby, so hiding it costs no structure', () => {
    render(<App />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Street' });
    expect(heading.id, 'aria-labelledby needs a real id to point at').not.toBe('');

    const group = heading.parentElement as HTMLElement;
    expect(group).toHaveClass('control-group--street');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-labelledby', heading.id);
    // The accessible name really resolves — an id typo would leave the group nameless while
    // every attribute assertion above still passed.
    expect(screen.getByRole('group', { name: 'Street' })).toBe(group);
  });

  it('the .visually-hidden utility really removes the box (falsifiability control)', () => {
    // Without this, the class name above could be a no-op typo and the "hidden" claim vacuous.
    const rule = ruleChunkWith('.visually-hidden {');
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('clip: rect(0, 0, 0, 0)');
    expect(rule).toContain('height: 1px');
  });

  it('Blackjack has no street transport, and therefore no Street heading', () => {
    renderInBlackjack();
    expect(screen.queryByRole('heading', { level: 2, name: 'Street' })).toBeNull();
  });
});

describe('the separator is decorative: no element, no character, no tab stop', () => {
  it('is a CSS border on the second group, and generates no content', () => {
    const rule = ruleChunkWith(`${SEPARATOR_SELECTOR} {`);
    expect(
      rule,
      'the separator must be drawn as a border — a rule between two clusters is presentation, ' +
        'and presentation belongs in the stylesheet',
    ).toContain('border-left: 1px solid var(--border)');
    expect(rule, 'no new colour: the separator reuses the shipped border token').not.toContain(
      '--accent',
    );
  });

  it('no control-bar rule generates a character through ::before/::after', () => {
    // The other way a separator can become a text character — one a DOM assertion cannot see,
    // because generated content is not in the DOM. A screen reader may still announce it.
    //
    // Anchored on a property BOUNDARY, not on the bare substring: `justify-content:` (which the
    // session row legitimately declares) ends in the six characters `ontent:` preceded by a
    // letter, and a naive `.includes('content:')` reports it as generated content.
    const GENERATED_CONTENT = /(?:^|[^-\w])content\s*:/;
    for (const chunk of appCss.split('}')) {
      if (!/\.control-bar|\.control-group/.test(chunk)) continue;
      expect(
        chunk,
        'a `content:` declaration on a control-bar rule would inject a glyph into the ' +
          'accessibility tree that no DOM test could find',
      ).not.toMatch(GENERATED_CONTENT);
    }
  });

  it.each([
    ['holdem', () => render(<App />)],
    ['blackjack', renderInBlackjack],
  ])('%s: the bar contains no separator element and no separator glyph', (_mode, doRender) => {
    doRender();
    const bar = controlBar();

    expect(bar.querySelector('hr'), 'a separator must not be an element').toBeNull();
    for (const glyph of ['|', '·', '•', '—', '/', '–']) {
      expect(
        bar.textContent ?? '',
        `the bar's visible text must not contain "${glyph}" — a separator drawn as a character ` +
          'gets announced by a screen reader as if it were content',
      ).not.toContain(glyph);
    }
  });

  it.each([
    ['holdem', () => render(<App />), 8],
    ['blackjack', renderInBlackjack, 7],
  ])('%s: every focusable thing in the bar is one of its real buttons', (_mode, doRender, expectedButtons) => {
    doRender();
    const bar = controlBar();

    // No tabindex anywhere: a separator (or a group wrapper) that took a tab stop would put an
    // inert element into the keyboard order between two real controls.
    expect(bar.querySelector('[tabindex]')).toBeNull();
    expect(bar.querySelector('a, input, select, textarea, [contenteditable]')).toBeNull();
    expect(
      bar.querySelectorAll('button'),
      'the bar\'s button census — a change here means a control was added, removed or moved out',
    ).toHaveLength(expectedButtons);
  });
});

describe('the 44px hit area and the elevation treatment still reach every button', () => {
  it('App.css states the re-anchored selectors verbatim, in all three rules', () => {
    // The source half of the contract. The rendered half is below; neither is worth much alone.
    const hitArea = ruleChunkWith('min-width: 44px', '.control-bar__row');
    const raised = ruleChunkWith('box-shadow: var(--elev-raised)', '.control-bar__row');
    const rest = ruleChunkWith('box-shadow: var(--elev-rest)', '.control-bar__row');

    for (const branch of BAR_BUTTON_BRANCHES) {
      expect(hitArea, `the hit-area rule must carry the branch \`${branch}\``).toContain(branch);
      expect(raised, `the raised-elevation rule must carry the branch \`${branch}\``).toContain(branch);
      expect(rest, `the disabled-flat rule must carry \`${branch}:disabled\``).toContain(
        `${branch}:disabled`,
      );
    }

    // The declarations are the shipped ones, unchanged by the re-anchoring.
    expect(hitArea).toContain('min-height: 44px');
    expect(hitArea).toContain('padding: 8px 12px');

    // And the shipped direct-child form really is gone, so nothing is relying on a rule that no
    // longer matches anything.
    expect(
      appCss,
      'a surviving `.control-bar > button` would match nothing now that every button is nested ' +
        'inside a row and a group — dead CSS that reads like a live guarantee',
    ).not.toContain('.control-bar > button');
  });

  it.each([
    [
      'holdem',
      () => render(<App />),
      ['set-up-scenario-button', 'rewind-button', 'advance-button'],
    ],
    [
      'blackjack',
      renderInBlackjack,
      ['blackjack-deal-button', 'blackjack-hit-button', 'blackjack-stand-button'],
    ],
  ])('%s: every plain action button matches the hit-area and raised-elevation selector', (_mode, doRender, testids) => {
    doRender();

    for (const testid of testids) {
      const button = screen.getByTestId(testid);
      expect(
        button.matches(barButtonSelector),
        `${testid} must still be reached by \`${barButtonSelector}\` — nesting it deeper without ` +
          're-anchoring the selector would silently drop its 44px floor and its shadow',
      ).toBe(true);
    }
  });

  it("Hold'em: the Deal button — which has no testid of its own — matches too", () => {
    render(<App />);
    // Deal is the one bar control identified only by its label, which is exactly why the shipped
    // rule was written as a structural selector rather than a testid-scoped one.
    expect(screen.getByRole('button', { name: /^deal$/i }).matches(barButtonSelector)).toBe(true);
  });

  it.each([
    ['holdem', () => render(<App />), ['holdem-deck-toggle-1', 'holdem-deck-toggle-2']],
    ['blackjack', renderInBlackjack, ['blackjack-deck-toggle-1', 'blackjack-deck-toggle-2']],
  ])('%s: no segmented-control SEGMENT is reached by the bar-button selector', (_mode, doRender, toggleSegments) => {
    doRender();

    for (const testid of [...toggleSegments, 'game-mode-switch-holdem', 'game-mode-switch-blackjack']) {
      const segment = screen.getByTestId(testid);
      expect(
        segment.matches(barButtonSelector),
        `${testid} must NOT match \`${barButtonSelector}\` — it is a child of the segmented ` +
          'WRAPPER, which is neither a row nor a .control-group. Widening the rule to the ' +
          'descendant selector `.control-bar button` is the tempting fix that breaks this: at ' +
          "(0,1,1) it out-specifies the segment's own (0,1,0) rule and reflows it from 8px 16px " +
          'padding to 8px 12px',
      ).toBe(false);
      expect(
        segment.matches(segmentSelector),
        `${testid} must still be covered by the segmented control's own sizing rule`,
      ).toBe(true);
    }
  });

  it.each([
    ['holdem', () => render(<App />)],
    ['blackjack', renderInBlackjack],
  ])('%s: every button in the bar is sized by EXACTLY ONE of the two rules', (_mode, doRender) => {
    doRender();
    const bar = controlBar();

    // The 44px floor made total rather than enumerated: no button may fall through both rules
    // (losing the floor), and none may match both (which is the specificity collision that
    // reflows the segmented controls).
    for (const button of Array.from(bar.querySelectorAll('button'))) {
      const matchedRules = [
        button.matches(barButtonSelector) && 'the bar-button rule',
        button.matches(segmentSelector) && "the segmented control's rule",
      ].filter((matched) => matched !== false);
      const label = button.dataset.testid ?? button.textContent ?? '(unlabelled)';
      expect(
        matchedRules,
        `${label} must be sized by exactly one rule — matching NEITHER means it lost the 44px ` +
          'floor entirely, matching BOTH means the two rules now contend for its padding',
      ).toHaveLength(1);
    }
  });

  it.each([
    ['holdem', () => render(<App />)],
    ['blackjack', renderInBlackjack],
  ])('%s: the raised shadow hangs on the segmented WRAPPER, never on its segments', (_mode, doRender) => {
    doRender();
    const bar = controlBar();

    for (const segment of Array.from(bar.querySelectorAll<HTMLElement>(segmentSelector))) {
      expect(
        segment.matches(barButtonSelector),
        'a shadow on each segment would turn one rocker into two or three stacked chips',
      ).toBe(false);
      const wrapper = segment.parentElement as HTMLElement;
      expect(wrapper.matches(segmentWrapperSelector)).toBe(true);
    }
    expect(
      ruleChunkWith('display: inline-flex', "[data-testid='game-mode-switcher']"),
      'the wrapper rule is where the raised level is applied for all three segmented controls',
    ).toContain('box-shadow: var(--elev-raised)');
  });

  it("Hold'em: a boundary-disabled transport button drops to the flat level, and an enabled one does not", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Idle: no hand, so both transport buttons are disabled and both must read as flat.
    const rewind = screen.getByTestId('rewind-button');
    expect(rewind).toBeDisabled();
    expect(
      rewind.matches(barButtonDisabledSelector),
      'an unavailable control must not be left hovering above the page waiting for a click',
    ).toBe(true);

    // Deal, and the now-enabled Advance must be back on the raised level only.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    const advance = screen.getByTestId('advance-button');
    expect(advance).not.toBeDisabled();
    expect(advance.matches(barButtonDisabledSelector)).toBe(false);
    expect(advance.matches(barButtonSelector)).toBe(true);
  });

  it('Blackjack: Hit and Stand read as flat while there is nothing to act on', () => {
    renderInBlackjack();

    for (const testid of ['blackjack-hit-button', 'blackjack-stand-button']) {
      const button = screen.getByTestId(testid);
      expect(button).toBeDisabled();
      expect(button.matches(barButtonDisabledSelector)).toBe(true);
    }
    // Deal is never disabled (06-UI-SPEC A2), so it must NOT be flattened.
    expect(screen.getByTestId('blackjack-deal-button').matches(barButtonDisabledSelector)).toBe(false);
  });

  it.each([
    ['holdem', () => render(<App />), ['holdem-deck-toggle-1', 'holdem-deck-toggle-2']],
    ['blackjack', renderInBlackjack, ['blackjack-deck-toggle-1', 'blackjack-deck-toggle-2']],
  ])(
    "%s: the selector App.css ACTUALLY declares behaves the same way — the stylesheet checked against the live DOM, not against this file's memory of it",
    (_mode, doRender, toggleSegments) => {
      doRender();

      // Read out of the stylesheet at run time rather than restated: if someone "fixes" an
      // orphaned rule by widening it to the descendant selector `.control-bar button`, the
      // literal pin above goes red AND so does this — from the other direction, by showing that
      // the widened selector now reaches a segment it must never reach.
      const hitArea = selectorOf('min-width: 44px', '.control-bar__row');
      const raised = selectorOf('box-shadow: var(--elev-raised)', '.control-bar__row');

      for (const testid of [...toggleSegments, 'game-mode-switch-holdem', 'game-mode-switch-blackjack']) {
        const segment = screen.getByTestId(testid);
        expect(
          segment.matches(hitArea),
          `${testid} is reached by the hit-area selector App.css declares (\`${hitArea}\`) — it ` +
            "would out-specify the segment's own 8px 16px padding rule",
        ).toBe(false);
        expect(
          segment.matches(raised),
          `${testid} is reached by the raised-elevation selector App.css declares — the shadow ` +
            'belongs to the segmented wrapper, not to each segment inside it',
        ).toBe(false);
      }

      // …and the positive direction, so a selector that reaches nothing at all cannot pass by
      // being vacuously "not reaching a segment".
      const barButtons = Array.from(
        controlBar().querySelectorAll<HTMLElement>('button'),
      ).filter((button) => !button.matches(segmentSelector));
      expect(barButtons.length).toBeGreaterThan(0);
      for (const button of barButtons) {
        const label = button.dataset.testid ?? button.textContent ?? '(unlabelled)';
        expect(button.matches(hitArea), `${label} lost the 44px floor App.css declares`).toBe(true);
        expect(button.matches(raised), `${label} lost the raised elevation App.css declares`).toBe(true);
      }
    },
  );

  it('the card picker\'s buttons are untouched by the control-bar rules', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('set-up-scenario-button'));
    const picker = document.getElementById('card-picker');
    expect(picker, 'Set Up Scenario must disclose the picker region').not.toBeNull();

    const pickerButtons = Array.from((picker as HTMLElement).querySelectorAll('button'));
    expect(pickerButtons.length, 'the picker must actually render buttons for this to prove anything').toBeGreaterThan(0);
    for (const button of pickerButtons) {
      expect(
        button.matches(barButtonSelector),
        `${button.dataset.testid ?? button.textContent} must not be reached by the control-bar ` +
          'rules — the picker sits outside the bar and carries its own treatment',
      ).toBe(false);
    }
  });
});
