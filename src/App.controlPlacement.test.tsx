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

// Control reorganization (260825). The user asked for it in three steps: "the controls for
// running the simulator are haphazard, please reorganize the UI", then "leave the mode buttons
// above it [the table]", then "move the action buttons to float over the bottom left of the
// table."
//
// What shipped before: ONE flat wrapping row above the felt holding five unrelated controls,
// with a stray visible <h2>Street</h2> floating over it. What ships now is a split by WHAT A
// CONTROL ACTS ON, with each half placed where it acts — the same split in both games:
//
//   above the felt   .control-bar--session   game-mode switcher + shoe size
//   on the felt      .felt-controls          the actions on the hand in front of you
//
// This file pins that placement, and the three things about it that are easy to break silently.
//
// WHY THIS FILE IS PART jsdom, PART SOURCE-READ, which no other suite in the repo is.
//
// The repo's convention is a hard split: `*.guard.test.ts` files opt into the bare Node test
// environment (via the per-file docblock directive — deliberately NOT spelled out anywhere in
// this file, because vitest scans leading comments for it and this suite must stay in jsdom)
// and read source text, while rendering suites never touch disk. Two invariants here span both
// sides of that line, so neither half can check them alone:
//
//   1. SELECTOR REACH. The 44px hit area and both elevation levels were `.control-bar > button`
//      — DIRECT-CHILD selectors. Every plain button moved out of the bar, onto the felt, and one
//      level deeper into a `.control-group`, which orphans all three rules. A source-only guard
//      can prove App.css still contains SOME selector; it cannot prove that selector still
//      reaches the buttons. A render-only test can find the buttons; it cannot see the
//      stylesheet, because this harness loads none. So the selectors are pinned VERBATIM against
//      App.css AND executed against the live DOM via `Element.matches()` — including the
//      selector App.css actually declares, not just this file's memory of it.
//
//      It is also what proves the NEGATIVE half. The obvious repair for an orphaned rule is to
//      widen it to a descendant selector, which would reach the segmented controls' SEGMENTS and,
//      at (0,1,1) against their own (0,1,0) rule, out-specify and reflow both of them. The XOR
//      sweep below makes that unrepresentable: every button must match exactly one sizing rule.
//
//   2. GEOMETRY. `.felt` is an ELLIPSE, so "bottom left of the table" is not its bounding box's
//      bottom-left corner — that point is off the green entirely. jsdom lays nothing out, so the
//      only honest check is to read the anchor percentages, the felt's size and the card widths
//      out of the stylesheets and do the ellipse arithmetic here. That is what the geometry block
//      below does, and it re-derives everything from source so a future felt resize re-checks
//      itself instead of silently invalidating the placement.
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
 * A stylesheet with every comment removed — the view EVERY assertion below reads, borrowed from
 * ui/depthTypography.guard.test.ts's `withoutComments` for the same reason it exists there:
 * prose that happens to quote a declaration must neither satisfy nor trip a check that is about
 * real declarations. It is load-bearing rather than defensive here: App.css's own comments
 * explain this re-anchoring and therefore quote the retired selectors, which would make the
 * "exactly one rule" lookups find two.
 */
function withoutComments(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const appCss = withoutComments('App.css');
const indexCss = withoutComments('index.css');

// ---------------------------------------------------------------------------
// The selector contract, stated ONCE and used both ways.
// ---------------------------------------------------------------------------

/** The plain action buttons — Deal, Set Up Scenario, Rewind/Advance, Blackjack's Deal/Hit/Stand.
 *  All of them now live on the felt, which is what these branches say. */
const ACTION_BUTTON_BRANCHES = [
  '.felt-controls > button',
  '.felt-controls .control-group > button',
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

const SEPARATOR_SELECTOR = '.felt-controls > .control-group + .control-group';

const actionButtonSelector = ACTION_BUTTON_BRANCHES.join(', ');
const actionButtonDisabledSelector = ACTION_BUTTON_BRANCHES.map((s) => `${s}:disabled`).join(', ');
const segmentSelector = SEGMENT_BRANCHES.join(', ');
const segmentWrapperSelector = SEGMENT_WRAPPER_BRANCHES.join(', ');

/**
 * The single rule in `css` containing all of `tokens`. Each chunk produced by splitting on `}`
 * carries one rule's selector prelude and its declarations — the technique
 * App.modeShell.guard.test.ts already uses on this stylesheet. Asserting exactly one match is
 * what makes a duplicated block detectable rather than silently tolerated.
 */
function ruleWith(css: string, ...tokens: string[]): string {
  const matches = css.split('}').filter((chunk) => tokens.every((token) => chunk.includes(token)));
  expect(
    matches,
    `expected exactly one rule containing all of: ${tokens.join(' + ')} — zero means it was ` +
      'removed or reformatted, more than one means a duplicated block appeared',
  ).toHaveLength(1);
  return matches[0];
}

/**
 * The SELECTOR PRELUDE App.css actually declares for a rule, ready for `Element.matches()`.
 *
 * This closes the last gap. The pinned constants above bind the stylesheet to this file, and
 * running those constants against the DOM binds this file to the JSX — but a stylesheet edit
 * would then be caught only by the literal pin, one assertion deep. Executing the stylesheet's
 * OWN prelude against the live DOM means the negative claim ("no segment is reached") is checked
 * against whatever App.css really says today.
 */
function selectorOf(...tokens: string[]): string {
  const prelude = ruleWith(appCss, ...tokens).split('{')[0].trim();
  expect(prelude, `the rule for ${tokens.join(' + ')} must declare a selector`).not.toBe('');
  return prelude;
}

/** A single declaration's value out of a rule, e.g. `left` -> `14%`. */
function declaration(rule: string, property: string): string {
  const match = new RegExp(`(?:^|[^-\\w])${property}\\s*:\\s*([^;]+);`).exec(rule);
  expect(match, `expected a \`${property}\` declaration`).not.toBeNull();
  return (match as RegExpExecArray)[1].trim();
}

/** A percentage declaration as a fraction, e.g. `14%` -> 0.14. */
function percent(rule: string, property: string): number {
  const value = declaration(rule, property);
  expect(value, `\`${property}: ${value}\` must be a percentage — the placement is anchored to the felt's own box, never fixed px`).toMatch(/^[\d.]+%$/);
  return Number.parseFloat(value) / 100;
}

function pxToken(css: string, token: string): number {
  const match = new RegExp(`${token}:\\s*(\\d+(?:\\.\\d+)?)px;`).exec(css);
  expect(match, `expected the token ${token}`).not.toBeNull();
  return Number.parseFloat((match as RegExpExecArray)[1]);
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

function sessionBar(): HTMLElement {
  const bars = document.querySelectorAll<HTMLElement>('.control-bar--session');
  expect(bars, 'exactly one session bar — the mode fork mounts one game at a time').toHaveLength(1);
  return bars[0];
}

function feltControls(): HTMLElement {
  const clusters = document.querySelectorAll<HTMLElement>('.felt-controls');
  expect(clusters, 'exactly one on-felt action cluster').toHaveLength(1);
  return clusters[0];
}

/** Blackjack is selected BEFORE the first render — no gate arming, no mode-switch round trip. */
function renderInBlackjack() {
  useGameModeStore.setState({ mode: 'blackjack' });
  return render(<App />);
}

/** `true` when `first` precedes `second` in document order. */
function precedes(first: Node, second: Node): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('the session controls sit ABOVE the felt, and only they do', () => {
  it.each([
    ['holdem', () => render(<App />), 'table-scene', 'holdem-deck-toggle'],
    ['blackjack', renderInBlackjack, 'blackjack-scene', 'blackjack-deck-toggle'],
  ])('%s: the switcher leads, the shoe trails, and the bar precedes the felt', (_mode, doRender, sceneTestid, toggleTestid) => {
    doRender();
    const bar = sessionBar();
    const children = Array.from(bar.children);

    expect(
      children,
      'exactly two controls up here: which game, and which shoe. Anything else has drifted back ' +
        'out of the felt cluster it belongs in',
    ).toHaveLength(2);
    expect(children[0]).toBe(screen.getByTestId('game-mode-switcher'));
    expect(children[1]).toBe(screen.getByTestId(toggleTestid));
    expect(bar.lastElementChild).toBe(screen.getByTestId(toggleTestid));

    // "leave the mode buttons above it" — document order is the honest form of "above" in a
    // harness that lays nothing out.
    expect(precedes(bar, screen.getByTestId(sceneTestid))).toBe(true);
  });

  it('the session bar pushes its two controls to opposite edges', () => {
    expect(
      ruleWith(appCss, '.control-bar--session {'),
      'the two controls bracket the bar rather than lumping together on the left',
    ).toContain('justify-content: space-between');
  });

  it.each([
    ['holdem', () => render(<App />)],
    ['blackjack', renderInBlackjack],
  ])('%s: no action button ever appears in the session bar', (_mode, doRender) => {
    doRender();
    const bar = sessionBar();

    // Every button up here must be a SEGMENT of one of the two segmented controls. A Deal button
    // finding its way back into this bar is the exact regression the split exists to prevent.
    for (const button of Array.from(bar.querySelectorAll('button'))) {
      expect(
        button.matches(segmentSelector),
        `${button.textContent} is in the session bar but is not a segmented-control segment — ` +
          'the session bar holds session context only',
      ).toBe(true);
    }
  });
});

describe('the action cluster floats ON the felt', () => {
  it.each([
    ['holdem', () => render(<App />), 'table-scene'],
    ['blackjack', renderInBlackjack, 'blackjack-scene'],
  ])('%s: the cluster is a DOM child of the felt itself, not a sibling of it', (_mode, doRender, sceneTestid) => {
    doRender();
    const scene = screen.getByTestId(sceneTestid);
    const cluster = feltControls();

    // Load-bearing, not incidental: `.felt` is the positioning ancestor everything on the table
    // is anchored against, so `position: absolute` + percentage offsets only mean what they are
    // supposed to mean while the cluster is inside it. Being a sibling would silently re-anchor
    // every offset to some distant positioned ancestor.
    expect(cluster.parentElement).toBe(scene);
    expect(scene).toHaveClass('felt');
  });

  it("Hold'em: the cluster holds the Deal pair and the street transport, in that order", () => {
    render(<App />);
    const groups = Array.from(feltControls().children) as HTMLElement[];

    expect(
      groups,
      'two groups: "start/construct a hand" and "step through it" are different jobs, and the ' +
        'decorative rule between them is drawn by CSS on the second group, not by an element',
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
    const transport = Array.from(street.children);
    expect(transport).toHaveLength(4);
    expect(transport[0].tagName).toBe('H2');
    expect(transport[1]).toBe(screen.getByTestId('rewind-button'));
    expect(transport[2]).toBe(screen.getByTestId('street-label'));
    expect(transport[3]).toBe(screen.getByTestId('advance-button'));
  });

  it('Blackjack: the cluster holds one group — Deal / Hit / Stand — and so draws no separator', () => {
    renderInBlackjack();
    const groups = Array.from(feltControls().children) as HTMLElement[];

    expect(
      groups,
      'blackjack has no transport, so its cluster holds ONE group — which is why the separator ' +
        'rule is written as `.control-group + .control-group`: it is self-limiting',
    ).toHaveLength(1);
    expect(groups[0]).toHaveClass('control-group', 'control-group--hand-actions');
    const actions = Array.from(groups[0].children);
    expect(actions).toHaveLength(3);
    expect(actions[0]).toBe(screen.getByTestId('blackjack-deal-button'));
    expect(actions[1]).toBe(screen.getByTestId('blackjack-hit-button'));
    expect(actions[2]).toBe(screen.getByTestId('blackjack-stand-button'));
  });

  it.each([
    ['holdem', () => render(<App />), 'holdem-deck-toggle'],
    ['blackjack', renderInBlackjack, 'blackjack-deck-toggle'],
  ])('%s: session context never leaks onto the felt', (_mode, doRender, toggleTestid) => {
    doRender();
    const cluster = feltControls();

    expect(cluster.contains(screen.getByTestId(toggleTestid))).toBe(false);
    expect(cluster.contains(screen.getByTestId('game-mode-switcher'))).toBe(false);
  });

  it("Hold'em: the picker panel follows the trigger that discloses it", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByTestId('set-up-scenario-button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const region = document.getElementById(trigger.getAttribute('aria-controls') as string);
    expect(region, 'aria-controls must point at a region that exists').not.toBeNull();
    // The trigger moved onto the felt; the panel could not follow it there (it is full-width),
    // so it moved BELOW the table instead. What must not happen is the panel rendering before
    // its own trigger — `aria-controls` describes a relationship document order should reflect.
    expect(precedes(trigger, region as HTMLElement)).toBe(true);
  });
});

describe('the cluster really is on the green, at EVERY width the felt renders at', () => {
  // jsdom lays nothing out, so this is arithmetic on the declared values rather than
  // measurement. What it is NOT, any more, is arithmetic at one convenient size.
  //
  // THE FLAW THIS BLOCK WAS REWRITTEN TO FIX. The first version computed every clearance at the
  // 1040px reference felt and stopped there. But `.felt` is `width: min(100%, 1040px)` — 1040 is
  // a MAXIMUM, and in the shipped layout the odds cluster takes its share of `.table-row`, so
  // the felt renders around 911px. That difference is not a rounding error, it inverts the
  // result: the cluster's offsets are PERCENTAGES (they shrink with the felt) while its buttons
  // are TEXT (they do not), so the cluster is proportionally WIDER at smaller felt sizes —
  // exactly when the pocket it sits in is narrowest. The reference-only check reported 37px of
  // hero clearance while the shipped app had a 10px x 62px COLLISION.
  //
  // So every check below runs at BOTH widths, and the narrow one is the binding case.
  const felt = ruleWith(appCss, '.felt {');
  const REFERENCE_FELT_W = Number.parseFloat(
    (/width:\s*min\(100%,\s*(\d+(?:\.\d+)?)px\)/.exec(felt) as RegExpExecArray)[1],
  );

  /**
   * The width the felt actually renders at in the shipped layout, MEASURED in the running app
   * (felt 911 x 569). It cannot be derived from the stylesheet: it is whatever `.table-row`'s
   * flex distribution leaves the felt after the odds cluster and the 32px gap, inside `#root`'s
   * `min(100%, 1560px)`. Pinned as a constant with its provenance rather than computed, because
   * a wrong-but-derived number here would be worse than an honest measured one.
   */
  const RENDERED_FELT_W = 911;

  const [aspectW, aspectH] = declaration(felt, 'aspect-ratio')
    .split('/')
    .map((part) => Number.parseFloat(part));

  /** The rail is an inset ring drawn inside the ellipse, so the usable green is inset by it. */
  const RAIL = Number.parseFloat(
    (/inset 0 0 0 (\d+(?:\.\d+)?)px var\(--felt-rail\)/.exec(felt) as RegExpExecArray)[1],
  );

  /**
   * One control row's outer height, MEASURED in the running app (the cluster measured 120px tall
   * for two rows at 8px padding and an 8px gap). The 44px hit-area floor plus the button's
   * border box lands here; it is the one value in this block that cannot be read out of the
   * stylesheet, so it is pinned with its provenance and everything else is derived from CSS.
   */
  const ROW_HEIGHT = 48;

  /**
   * The cluster's ACTUAL rendered width, MEASURED in the running app after the padding/gap trim
   * (right edge x=336.5 against left:13% of a 911px felt = x=118.4). Text metrics cannot be
   * derived from a stylesheet and jsdom lays nothing out, so this is pinned with its provenance.
   *
   * It exists because the width CAP is a poor proxy for the real width — the cap is deliberately
   * set above the content so the rows never wrap, which makes cap-based arithmetic pessimistic
   * (19px where the truth is 29px). The checks below therefore use BOTH: the cap for what is
   * GUARANTEED whatever the labels do, and this for what is actually on screen.
   */
  const MEASURED_CLUSTER_W = 218;

  const cluster = ruleWith(appCss, '.felt-controls {');
  const LEFT_FRACTION = percent(cluster, 'left');
  const MAX_WIDTH_FRACTION = percent(cluster, 'max-width');

  /** Block padding of the cluster plate — first value of whichever `padding` shorthand is set. */
  const CLUSTER_PAD_BLOCK = Number.parseFloat(declaration(cluster, 'padding').split(/\s+/)[0]);
  const CLUSTER_GAP = Number.parseFloat(declaration(cluster, 'gap'));
  const SEPARATOR_PAD = Number.parseFloat(
    declaration(ruleWith(appCss, SEPARATOR_SELECTOR + ' {'), 'padding-top'),
  );

  /** Hold'em stacks two groups with the separator's padding between them; Blackjack has one.
   *  Derived from the CSS above, so a padding or gap change re-checks the fit rather than
   *  silently invalidating it. */
  const HOLDEM_CLUSTER_HEIGHT =
    CLUSTER_PAD_BLOCK * 2 + ROW_HEIGHT * 2 + CLUSTER_GAP + SEPARATOR_PAD;

  /** Blackjack carries a single row (Deal / Hit / Stand) — no gap, no separator. */
  const BLACKJACK_CLUSTER_HEIGHT = CLUSTER_PAD_BLOCK * 2 + ROW_HEIGHT;

  function geometry(feltWidth: number) {
    const feltHeight = (feltWidth * aspectH) / aspectW;
    const a = feltWidth / 2 - RAIL;
    const b = feltHeight / 2 - RAIL;
    const heroCardW = pxToken(indexCss, '--card-w-hero');
    const heroGap = Number.parseFloat(
      (/\[data-testid='hero-hole'\][\s\S]*?gap:\s*(\d+)px/.exec(appCss) as RegExpExecArray)[1],
    );
    const communityTop = percent(ruleWith(appCss, '.community-area {'), 'top') * feltHeight;
    const playerBottom = percent(ruleWith(appCss, '.bj-player-area {'), 'bottom') * feltHeight;

    return {
      xLeft: LEFT_FRACTION * feltWidth,
      // The cap is the cluster's width ONLY because `min-width: 0` lets it bind — pinned below.
      xRight: (LEFT_FRACTION + MAX_WIDTH_FRACTION) * feltWidth,
      // What is actually on screen: the content, unless the cap is tighter and clamps it.
      xRightActual:
        LEFT_FRACTION * feltWidth +
        Math.min(MAX_WIDTH_FRACTION * feltWidth, MEASURED_CLUSTER_W),
      heroLeftEdge: feltWidth / 2 - (heroCardW * 2 + heroGap) / 2,
      communityBottom: communityTop + (pxToken(indexCss, '--card-w-community') * 7) / 5,
      playerTop: feltHeight - playerBottom - (heroCardW * 7) / 5,
      /** How far out of centre a point is, where 1.0 is the inner edge of the green. */
      radial: (x: number, y: number) =>
        Math.hypot((x - feltWidth / 2) / a, (y - feltHeight / 2) / b),
      /**
       * The same measure against the felt's OUTLINE rather than the rail-inset green. Used by
       * the straddle assertion: the plate is meant to cross the rail, so the rail's inner edge
       * is no longer the boundary that matters — the table's own edge is.
       */
      radialOuter: (x: number, y: number) =>
        Math.hypot((x - feltWidth / 2) / (feltWidth / 2), (y - feltHeight / 2) / (feltHeight / 2)),
      bottomOf: (modifier: string) =>
        feltHeight - percent(ruleWith(appCss, modifier), 'bottom') * feltHeight,
      topOf: (modifier: string) =>
        feltHeight -
        percent(ruleWith(appCss, modifier), 'bottom') * feltHeight -
        (modifier.includes('holdem') ? HOLDEM_CLUSTER_HEIGHT : BLACKJACK_CLUSTER_HEIGHT),
    };
  }

  const WIDTHS: readonly (readonly [string, number])[] = [
    ['reference max 1040', REFERENCE_FELT_W],
    ['as actually rendered 911', RENDERED_FELT_W],
  ];

  it('the width cap can actually bind — without this every width check below is fiction', () => {
    // THE ROOT CAUSE of the shipped collision. A flex item defaults to `min-width: auto`, which
    // refuses to shrink below max-content, so the button rows OVERFLOWED the percentage cap
    // instead of wrapping inside it: the cluster measured 27.1% of the felt against a 26% cap.
    // Every "at its width cap" assertion below assumes the cap is real, so the cap's binding
    // mechanism gets its own pin rather than riding along on the arithmetic.
    expect(
      ruleWith(appCss, '.felt-controls .control-group {'),
      'the in-cluster groups must set `min-width: 0`, or `max-width` on the cluster is merely ' +
        'advisory and the rows spill rightward into the hero seat',
    ).toContain('min-width: 0');
  });

  it('derives sane felts (falsifiability control for everything below)', () => {
    expect(REFERENCE_FELT_W).toBeGreaterThan(0);
    expect(RAIL).toBeGreaterThan(0);
    expect(LEFT_FRACTION).toBeGreaterThan(0);
    expect(MAX_WIDTH_FRACTION).toBeGreaterThan(0);
    expect(HOLDEM_CLUSTER_HEIGHT).toBeGreaterThan(2 * ROW_HEIGHT);
    expect(
      RENDERED_FELT_W,
      'the rendered felt must be NARROWER than the reference — if it were not, this whole ' +
        'two-width block would be checking one case twice',
    ).toBeLessThan(REFERENCE_FELT_W);
  });

  it.each(
    WIDTHS.flatMap(([label, w]) =>
      (
        [
          ['holdem', '.felt-controls--holdem {'],
          ['blackjack', '.felt-controls--blackjack {'],
        ] as const
      ).map(([mode, modifier]) => [mode + ' @ ' + label, w, modifier] as const),
    ),
  )('%s: the plate deliberately CROSSES the table edge', (_label, feltWidth, modifier) => {
    const g = geometry(feltWidth);
    const yBottom = g.bottomOf(modifier);

    // RETARGETED (user request): "move the control buttons down and left more so that they
    // aren't 'on' the table, have it cross the edge."
    //
    // This assertion used to demand the opposite — both bottom corners strictly INSIDE the
    // rail-inset ellipse — because the cluster was meant to sit on the green. The intent is now
    // inverted, so the test is inverted with it rather than deleted: the plate must genuinely
    // straddle the outline, which means proving BOTH halves. A cluster that drifted fully back
    // onto the felt, or fully off it, is just as wrong as the overlap this file originally
    // caught, and either would slip past a one-sided check.
    //
    // Radial value is measured against the felt OUTLINE here, not the rail-inset ellipse:
    // crossing the rail is the point, so the rail inset is not the relevant boundary any more.
    const outerBottomLeft = g.radialOuter(g.xLeft, yBottom);
    const innerTopRight = g.radialOuter(g.xRight, g.topOf(modifier));

    expect(
      outerBottomLeft,
      'the bottom-left corner sits at ' + outerBottomLeft.toFixed(3) + ' of the felt outline at ' +
        'a ' + feltWidth + 'px felt — it must be > 1.0, i.e. off the table, or the plate no ' +
        'longer crosses the edge',
    ).toBeGreaterThan(1);

    expect(
      innerTopRight,
      'the top-right corner sits at ' + innerTopRight.toFixed(3) + ' — it must stay < 1.0 (on ' +
        'the green), or the plate has drifted off the table entirely instead of straddling it',
    ).toBeLessThan(1);
  });

  it.each(WIDTHS)(
    "Hold'em @ %s: the cluster does not reach the hero seat, even at its width cap",
    (_label, feltWidth) => {
      const g = geometry(feltWidth);

      // TWO TIERS, because they answer different questions and only one of them was ever
      // checked before.
      //
      // Tier 1 — what is GUARANTEED. Uses the cap, so it holds whatever the labels render at.
      // The floor is 15px rather than 0: at a 27% cap this arithmetic returned 1.1px of
      // "clearance" at the rendered felt, which passed a `> 0` check while guaranteeing
      // nothing. A fence that leaves a millimetre is not a fence.
      expect(
        g.heroLeftEdge - g.xRight,
        'at a ' + feltWidth + 'px felt the width CAP does not fence the cluster off the hero ' +
          'seat. The offsets are percentages and the buttons are text, so the cluster is ' +
          'proportionally WIDER at smaller felt sizes — exactly when this pocket is narrowest',
      ).toBeGreaterThan(15);

      // Tier 2 — what is actually on screen, from the measured content width.
      expect(
        g.heroLeftEdge - g.xRightActual,
        'at a ' + feltWidth + 'px felt the rendered cluster crowds the hero seat',
      ).toBeGreaterThan(25);
    },
  );

  it.each(WIDTHS)("Hold'em @ %s: the cluster top clears the community row", (_label, feltWidth) => {
    const g = geometry(feltWidth);
    const yTop = g.bottomOf('.felt-controls--holdem {') - HOLDEM_CLUSTER_HEIGHT;

    expect(
      yTop,
      'at a ' + feltWidth + 'px felt the cluster would cover the board cards. The pocket is ' +
        'bounded on three sides — the ellipse below and left, this row above, the hero seat to ' +
        'the right — so there is nowhere to absorb a third row',
    ).toBeGreaterThan(g.communityBottom);
  });

  it.each(WIDTHS)(
    'Blackjack @ %s: the cluster clears a wide player hand at bottom-centre',
    (_label, feltWidth) => {
      const g = geometry(feltWidth);
      // A blackjack hand can run to five or six cards, which spreads far enough left to sit
      // under the cluster's x range — so the clearance has to be VERTICAL, not horizontal.
      expect(
        g.bottomOf('.felt-controls--blackjack {'),
        'at a ' + feltWidth + "px felt the cluster's bottom edge reaches the player's cards",
      ).toBeLessThan(g.playerTop);
    },
  );

  it('records what the pocket actually affords, so the trade-off stays visible', () => {
    // A LEDGER, not a threshold. The bottom-left pocket is small and hard-bounded, and the
    // Hold'em cluster very nearly fills it at the rendered width. Writing the numbers into the
    // failure message means the next person to ask "can we get more clearance here?" gets the
    // arithmetic instead of re-measuring, and any anchor change moves them visibly in the diff.
    const ledger = WIDTHS.map(([label, feltWidth]) => {
      const g = geometry(feltWidth);
      const yBottom = g.bottomOf('.felt-controls--holdem {');
      return (
        label +
        ': hero ' + (g.heroLeftEdge - g.xRightActual).toFixed(1) + 'px actual / ' +
        (g.heroLeftEdge - g.xRight).toFixed(1) + 'px guaranteed, ' +
        'community ' + (yBottom - HOLDEM_CLUSTER_HEIGHT - g.communityBottom).toFixed(1) + 'px, ' +
        'corner r=' + g.radial(g.xLeft, yBottom).toFixed(3)
      );
    });

    // WHY THERE IS NO 40px ASSERTION HERE, though 40px was the target asked for.
    //
    // It is not reachable in this pocket at the rendered felt, and the arithmetic says so
    // rather than the attempt failing. With 40px reserved for the hero seat, the pocket at
    // 911px is ~217px wide and ~122px tall. Two rows fit that height exactly; the cluster's
    // content is ~218px, so it is ~1px too wide. Narrowing it below the transport row's width
    // forces a THIRD row, and at three rows the cluster must drop 56px to clear the community
    // row — where the ellipse has closed in and the usable width collapses to ~120px. So the
    // pocket admits either a wide-enough cluster or a 40px gap, never both.
    //
    // The honest floors are asserted in the two-tier test above (15px guaranteed, 25px actual).
    // If more is genuinely needed, the levers are structural, not positional: shrink the felt's
    // hero seat, move the cluster off the felt, or make `.table-row` give the felt more width.
    for (const [label, feltWidth] of WIDTHS) {
      const g = geometry(feltWidth);
      expect(
        g.heroLeftEdge - g.xRightActual,
        label + ' has no clearance left. Ledger — ' + ledger.join(' | '),
      ).toBeGreaterThan(0);
    }
    expect(ledger).toHaveLength(2);
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
    const rule = ruleWith(appCss, '.visually-hidden {');
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
    const rule = ruleWith(appCss, `${SEPARATOR_SELECTOR} {`);
    expect(
      rule,
      'the separator must be drawn as a border — a rule between two clusters is presentation, ' +
        'and presentation belongs in the stylesheet',
    ).toMatch(/border-(top|left|inline-start|block-start):\s*1px solid var\(--border\)/);
    expect(rule, 'no new colour: the separator reuses the shipped border token').not.toContain(
      '--accent',
    );
  });

  it('no control rule generates a character through ::before/::after', () => {
    // The other way a separator can become a text character — one a DOM assertion cannot see,
    // because generated content is not in the DOM. A screen reader may still announce it.
    //
    // Anchored on a property BOUNDARY, not on the bare substring: `justify-content:` (which the
    // session bar legitimately declares) ends in the six characters `ontent:` preceded by a
    // letter, and a naive `.includes('content:')` reports it as generated content.
    const GENERATED_CONTENT = /(?:^|[^-\w])content\s*:/;
    for (const chunk of appCss.split('}')) {
      if (!/\.control-bar|\.control-group|\.felt-controls/.test(chunk)) continue;
      expect(
        chunk,
        'a `content:` declaration on a control rule would inject a glyph into the accessibility ' +
          'tree that no DOM test could find',
      ).not.toMatch(GENERATED_CONTENT);
    }
  });

  it.each([
    ['holdem', () => render(<App />)],
    ['blackjack', renderInBlackjack],
  ])('%s: the controls contain no separator element and no separator glyph', (_mode, doRender) => {
    doRender();

    for (const region of [sessionBar(), feltControls()]) {
      expect(region.querySelector('hr'), 'a separator must not be an element').toBeNull();
      for (const glyph of ['|', '·', '•', '—', '/', '–']) {
        expect(
          region.textContent ?? '',
          `visible control text must not contain "${glyph}" — a separator drawn as a character ` +
            'gets announced by a screen reader as if it were content',
        ).not.toContain(glyph);
      }
    }
  });

  it.each([
    ['holdem', () => render(<App />), 4, 4],
    ['blackjack', renderInBlackjack, 4, 3],
  ])('%s: every focusable thing in the controls is one of their real buttons', (_mode, doRender, sessionButtons, actionButtons) => {
    doRender();

    for (const [label, region, expected] of [
      ['session bar', sessionBar(), sessionButtons],
      ['felt cluster', feltControls(), actionButtons],
    ] as const) {
      // No tabindex anywhere: a separator (or a group wrapper) that took a tab stop would put an
      // inert element into the keyboard order between two real controls.
      expect(region.querySelector('[tabindex]'), `${label} must add no tab stop`).toBeNull();
      expect(region.querySelector('a, input, select, textarea, [contenteditable]')).toBeNull();
      expect(
        region.querySelectorAll('button'),
        `${label}'s button census — a change here means a control was added, removed or moved`,
      ).toHaveLength(expected);
    }
  });
});

describe('the 44px hit area and the elevation treatment still reach every action button', () => {
  it('App.css states the re-anchored selectors verbatim, in all three rules', () => {
    // Disambiguated on `.felt-controls > button` rather than on `.felt-controls`: the cluster's
    // own rule legitimately declares `box-shadow: var(--elev-raised)` too (that is what makes it
    // float over the table), so the bare class name selects two rules, not one.
    const hitArea = ruleWith(appCss, 'min-width: 44px', '.felt-controls > button');
    const raised = ruleWith(appCss, 'box-shadow: var(--elev-raised)', '.felt-controls > button');
    const rest = ruleWith(appCss, 'box-shadow: var(--elev-rest)', '.felt-controls > button');

    for (const branch of ACTION_BUTTON_BRANCHES) {
      expect(hitArea, `the hit-area rule must carry the branch \`${branch}\``).toContain(branch);
      expect(raised, `the raised-elevation rule must carry the branch \`${branch}\``).toContain(branch);
      expect(rest, `the disabled-flat rule must carry \`${branch}:disabled\``).toContain(
        `${branch}:disabled`,
      );
    }

    // The declarations are the shipped ones, unchanged by the re-anchoring.
    expect(hitArea).toContain('min-height: 44px');
    expect(hitArea).toContain('padding: 8px 12px');

    // The shipped direct-child form is gone, so nothing relies on a rule that would now match
    // nothing: every plain button left the bar for the felt.
    expect(
      appCss,
      'a surviving `.control-bar > button` would match nothing now that every action button ' +
        'lives on the felt — dead CSS that reads like a live guarantee',
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
  ])('%s: every action button matches the hit-area and raised-elevation selector', (_mode, doRender, testids) => {
    doRender();

    for (const testid of testids) {
      const button = screen.getByTestId(testid);
      expect(
        button.matches(actionButtonSelector),
        `${testid} must still be reached by \`${actionButtonSelector}\` — moving it onto the ` +
          'felt without re-anchoring the selector would silently drop its 44px floor and its ' +
          'shadow, over a lit green background where the shadow is the whole illusion',
      ).toBe(true);
    }
  });

  it("Hold'em: the Deal button — which has no testid of its own — matches too", () => {
    render(<App />);
    // Deal is the one control identified only by its label, which is exactly why the shipped
    // rule was written as a structural selector rather than a testid-scoped one.
    expect(screen.getByRole('button', { name: /^deal$/i }).matches(actionButtonSelector)).toBe(true);
  });

  it.each([
    ['holdem', () => render(<App />), ['holdem-deck-toggle-1', 'holdem-deck-toggle-2']],
    ['blackjack', renderInBlackjack, ['blackjack-deck-toggle-1', 'blackjack-deck-toggle-2']],
  ])('%s: no segmented-control SEGMENT is reached by the action-button selector', (_mode, doRender, toggleSegments) => {
    doRender();

    for (const testid of [...toggleSegments, 'game-mode-switch-holdem', 'game-mode-switch-blackjack']) {
      const segment = screen.getByTestId(testid);
      expect(
        segment.matches(actionButtonSelector),
        `${testid} must NOT match \`${actionButtonSelector}\` — widening the rule to a ` +
          "descendant selector is the tempting repair that breaks this: it out-specifies the " +
          "segment's own (0,1,0) rule and reflows it from 8px 16px padding to 8px 12px",
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
  ])('%s: every button on screen is sized by EXACTLY ONE of the two rules', (_mode, doRender) => {
    doRender();

    // The 44px floor made total rather than enumerated, across BOTH regions: no button may fall
    // through both rules (losing the floor), and none may match both (the specificity collision
    // that reflows the segmented controls).
    const buttons = [
      ...Array.from(sessionBar().querySelectorAll('button')),
      ...Array.from(feltControls().querySelectorAll('button')),
    ];
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const matchedRules = [
        button.matches(actionButtonSelector) && 'the action-button rule',
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

    for (const segment of Array.from(sessionBar().querySelectorAll<HTMLElement>(segmentSelector))) {
      expect(
        segment.matches(actionButtonSelector),
        'a shadow on each segment would turn one rocker into two or three stacked chips',
      ).toBe(false);
      expect((segment.parentElement as HTMLElement).matches(segmentWrapperSelector)).toBe(true);
    }
    expect(
      ruleWith(appCss, 'display: inline-flex', "[data-testid='game-mode-switcher']"),
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
      rewind.matches(actionButtonDisabledSelector),
      'an unavailable control must not be left hovering above the table waiting for a click',
    ).toBe(true);

    // Deal, and the now-enabled Advance must be back on the raised level only.
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    const advance = screen.getByTestId('advance-button');
    expect(advance).not.toBeDisabled();
    expect(advance.matches(actionButtonDisabledSelector)).toBe(false);
    expect(advance.matches(actionButtonSelector)).toBe(true);
  });

  it('Blackjack: Hit and Stand read as flat while there is nothing to act on', () => {
    renderInBlackjack();

    for (const testid of ['blackjack-hit-button', 'blackjack-stand-button']) {
      const button = screen.getByTestId(testid);
      expect(button).toBeDisabled();
      expect(button.matches(actionButtonDisabledSelector)).toBe(true);
    }
    // Deal is never disabled (06-UI-SPEC A2), so it must NOT be flattened.
    expect(screen.getByTestId('blackjack-deal-button').matches(actionButtonDisabledSelector)).toBe(
      false,
    );
  });

  it.each([
    ['holdem', () => render(<App />), ['holdem-deck-toggle-1', 'holdem-deck-toggle-2']],
    ['blackjack', renderInBlackjack, ['blackjack-deck-toggle-1', 'blackjack-deck-toggle-2']],
  ])(
    "%s: the selector App.css ACTUALLY declares behaves the same way — the stylesheet checked against the live DOM, not against this file's memory of it",
    (_mode, doRender, toggleSegments) => {
      doRender();

      const hitArea = selectorOf('min-width: 44px', '.felt-controls > button');
      const raised = selectorOf('box-shadow: var(--elev-raised)', '.felt-controls > button');

      for (const testid of [...toggleSegments, 'game-mode-switch-holdem', 'game-mode-switch-blackjack']) {
        const segment = screen.getByTestId(testid);
        expect(
          segment.matches(hitArea),
          `${testid} is reached by the hit-area selector App.css declares (\`${hitArea}\`)`,
        ).toBe(false);
        expect(
          segment.matches(raised),
          `${testid} is reached by the raised-elevation selector App.css declares — the shadow ` +
            'belongs to the segmented wrapper, not to each segment inside it',
        ).toBe(false);
      }

      // …and the positive direction, so a selector that reaches nothing at all cannot pass by
      // being vacuously "not reaching a segment".
      const actionButtons = Array.from(feltControls().querySelectorAll<HTMLElement>('button'));
      expect(actionButtons.length).toBeGreaterThan(0);
      for (const button of actionButtons) {
        const label = button.dataset.testid ?? button.textContent ?? '(unlabelled)';
        expect(button.matches(hitArea), `${label} lost the 44px floor App.css declares`).toBe(true);
        expect(button.matches(raised), `${label} lost the raised elevation App.css declares`).toBe(
          true,
        );
      }
    },
  );

  it("the card picker's buttons are untouched by the control rules", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('set-up-scenario-button'));
    const picker = document.getElementById('card-picker');
    expect(picker, 'Set Up Scenario must disclose the picker region').not.toBeNull();

    const pickerButtons = Array.from((picker as HTMLElement).querySelectorAll('button'));
    expect(pickerButtons.length, 'the picker must actually render buttons for this to prove anything').toBeGreaterThan(0);
    for (const button of pickerButtons) {
      expect(
        button.matches(actionButtonSelector),
        `${button.dataset.testid ?? button.textContent} must not be reached by the on-felt ` +
          'control rules — the picker sits outside the table and carries its own treatment',
      ).toBe(false);
    }
  });
});

describe('the cluster is legible over lit green, and spends no new colour', () => {
  const cluster = ruleWith(appCss, '.felt-controls {');

  it('takes its own surface from the token that exists for UI on the felt', () => {
    // The buttons used to sit on the dark page ground. Over green they need a surface, and
    // --seat-badge-bg is the shipped token for exactly that — the seat labels a few pixels away
    // already use it, so this is the table's existing vocabulary rather than a new one.
    expect(cluster).toContain('background: var(--seat-badge-bg)');
    expect(cluster).toContain('color: var(--seat-badge-text)');
    expect(
      cluster,
      'over a lit felt the raised shadow is what makes the cluster read as floating above the ' +
        'table rather than printed on it',
    ).toContain('box-shadow: var(--elev-raised)');
  });

  it('introduces no colour of its own — no literal, no fourth accent use', () => {
    expect(
      cluster,
      'every colour here must come from a shipped token; a raw hex or rgb() is a new colour ' +
        'decision made locally',
    ).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(/i);
    expect(
      cluster,
      'the accent budget is the three reserved Hold\'em uses (street label, filled picker slot, ' +
        'enabled Advance) — a floating panel is not a fourth',
    ).not.toContain('--accent');
    expect(cluster).not.toContain('--destructive');
  });

  it('leaves the two reserved accent consumers inside it still spending accent', () => {
    // The cluster sets `color` at (0,1,0). The shipped accent rule is (0,2,0) for Advance and
    // (0,1,0)-but-later for the street label, so both still win — this asserts the OUTCOME
    // rather than trusting the arithmetic.
    render(<App />);
    // Disambiguated on `.picker-slot-filled`, the first selector in the reserved-uses list —
    // `color: var(--accent)` alone also matches the leading-share-bar rule.
    const accentRule = ruleWith(appCss, 'color: var(--accent)', '.picker-slot-filled');
    const accentSelector = accentRule.split('{')[0].trim();

    expect(screen.getByTestId('street-label').matches(accentSelector)).toBe(true);
    // Advance is accent only while it is the actionable next step, so it needs a hand first.
    expect(screen.getByTestId('advance-button').matches(accentSelector)).toBe(false);
  });

  it('stacks above the settled table and below a card in flight', () => {
    const level = (token: string) =>
      Number.parseInt(
        (new RegExp(`${token}:\\s*(\\d+);`).exec(indexCss) as RegExpExecArray)[1],
        10,
      );

    expect(cluster).toContain('z-index: var(--z-felt-controls)');
    expect(level('--z-felt-controls')).toBeGreaterThan(level('--z-seat'));
    expect(level('--z-felt-controls')).toBeGreaterThan(level('--z-seat-label'));
    expect(level('--z-felt-controls')).toBeLessThan(level('--z-in-flight'));
  });
});
