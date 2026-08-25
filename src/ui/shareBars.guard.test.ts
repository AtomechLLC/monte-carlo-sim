// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Share-column source-shape guard — the negative and CSS-level invariants that no rendered
// assertion can express, in the repo's established `*.guard.test.ts` shape (see
// engine/shoePath.guard.test.ts, App.modeShell.guard.test.ts). It reads OTHER files' source
// text, never its own.
//
// Three things live here and nowhere else:
//
//   1. THE DIGITS ARE NEVER ANIMATED. This is the ABSENCE of a mechanism — no timer, no frame
//      loop, no interpolation state in OddsTable. A rendered test cannot prove an absence, and
//      the cost of getting it wrong is high and delayed: frozen v1 acceptance suites assert
//      `category-pct-N` textContent EXACTLY ('50.0%', '—'), so a count-up would not fail here,
//      it would fail intermittently in files nobody is allowed to edit. A future change that
//      wants moving digits goes red here first, where the reason is written down.
//
//   2. THE BARS DO TRANSITION. The whole point of the Share column is watching a run converge;
//      a bar that snaps between snapshots is a bar chart, not a convergence display. The
//      declaration is in CSS, which jsdom never applies, so source level is the only honest
//      place to pin it.
//
//   3. REDUCED MOTION OPTS OUT. Likewise unobservable: this repo's harness forces
//      `prefers-reduced-motion: reduce` for every test AND loads no stylesheet, so the media
//      query is doubly invisible to a rendered assertion.
//
// Behavioural coverage (widths, leader emphasis, the animation gate, aria-hidden, the 2-deck
// row) is in ui/OddsTable.shareBars.test.tsx; geometry unit/property coverage is in
// ui/categoryShares.test.ts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..');

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8');
}

const oddsTableSource = readSource('ui/OddsTable.tsx');
const cssSource = readSource('App.css');

/**
 * App.css with every `@media` block removed, braces matched.
 *
 * The Share column legitimately declares some of its selectors TWICE — once as the base rule
 * and once inside a media query (the responsive width, the reduced-motion opt-out). The
 * repo's usual "split on `}` and expect one chunk" technique cannot tell a legitimate
 * responsive override from an accidentally duplicated rule block, so the base rules are
 * looked up in this media-free view and the media queries are asserted separately.
 */
function withoutMediaBlocks(css: string): string {
  let out = '';
  let cursor = 0;

  for (;;) {
    const at = css.indexOf('@media', cursor);
    if (at === -1) return out + css.slice(cursor);

    out += css.slice(cursor, at);
    const open = css.indexOf('{', at);
    if (open === -1) return out;

    let depth = 1;
    let scan = open + 1;
    while (scan < css.length && depth > 0) {
      if (css[scan] === '{') depth += 1;
      else if (css[scan] === '}') depth -= 1;
      scan += 1;
    }
    cursor = scan;
  }
}

const baseCss = withoutMediaBlocks(cssSource);

/** Declarations (and leading comments) with all comments stripped, for literal-value checks. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('OddsTable — the percentage digits have no way to move', () => {
  const forbidden = [
    'requestAnimationFrame',
    'setInterval',
    'setTimeout',
    'useState',
    'useSpring',
    'useMotionValue',
    'animate(',
  ];

  it.each(forbidden)('OddsTable.tsx contains no %s', (token) => {
    expect(
      oddsTableSource,
      `OddsTable must not use ${token}: every percentage cell renders straight from formatPct ` +
        'on each snapshot, and frozen v1 suites assert their exact textContent. Convergence is ' +
        'shown by the CSS width transition on the bars — never by mutating a digit.',
    ).not.toContain(token);
  });

  it('still renders the percentage straight from the shared formatter', () => {
    // The complement of the prohibitions above: proves the digits come from `formatPct` on the
    // current snapshot rather than from some intermediate the prohibitions failed to name.
    expect(oddsTableSource).toContain(
      'formatPct(categoryCounts[index] ?? 0, trialsCompleted, pending)',
    );
  });

  it('derives bar geometry from the shared pure helper, not from an inline calculation', () => {
    // Keeps the gate condition in ONE place. An inline `count / max` here could drift out of
    // step with formatPct's em-dash rule and reintroduce stale-shape-behind-a-dash (TBL-04).
    expect(oddsTableSource).toContain('categoryShares(categoryCounts, labels.length, trialsCompleted, pending)');
  });
});

describe('App.css — the bar width is the one thing allowed to move', () => {
  /** The declarations of the BASE (non-media) rule whose prelude contains `selector`. */
  function ruleFor(selector: string): string {
    const matches = baseCss.split('}').filter((chunk) => chunk.includes(`${selector} {`));
    expect(
      matches,
      `expected exactly one base App.css rule for ${selector} — zero means it was removed, ` +
        'more than one means a duplicated block appeared (media-query overrides are excluded ' +
        'from this view and asserted separately)',
    ).toHaveLength(1);
    return matches[0];
  }

  it('transitions the bar fill width', () => {
    expect(
      ruleFor('.category-bar__fill'),
      'the width transition IS the convergence affordance — without it the bars snap between ' +
        'streamed snapshots and there is nothing to watch',
    ).toMatch(/transition:\s*width\s+\d+m?s/);
  });

  it('transitions ONLY width — never a property that could animate text', () => {
    const rule = ruleFor('.category-bar__fill');
    const transition = /transition:\s*([^;]+);/.exec(rule)?.[1] ?? '';
    expect(transition).not.toContain('all');
    expect(transition.split(',')).toHaveLength(1);
  });

  it('spends the accent role on the leading bar and the quieter tokens on the rest', () => {
    expect(ruleFor('.category-bar__fill--leading')).toContain('var(--accent)');
    const base = ruleFor('.category-bar__fill');
    expect(base, 'non-leading fills use --accent-bg over --border, never the full accent').toContain(
      'var(--accent-bg)',
    );
    expect(base).toContain('var(--border)');
  });

  it('tints the track from the border token rather than a new colour', () => {
    expect(ruleFor('.category-bar')).toContain('var(--border)');
  });

  it('introduces no raw colour literal anywhere in the Share column rules', () => {
    for (const selector of ['.category-bar', '.category-bar__fill', '.category-bar__fill--leading', '.category-table__share']) {
      const rule = ruleFor(selector);
      // Comments are stripped first so prose (e.g. a hex quoted in an explanation) cannot trip
      // this; what is banned is a hex/rgb literal in an actual declaration.
      const declarations = withoutComments(rule);
      expect(declarations, `${selector} must use tokens only`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(declarations, `${selector} must use tokens only`).not.toMatch(/\brgba?\(/);
    }
  });
});

describe('App.css — reduced motion disables the transition', () => {
  // Everything after the LAST media-query opener; asserted as a block so a rule that merely
  // mentions the bar outside the query cannot satisfy this.
  const reducedMotionBlocks = cssSource
    .split('@media (prefers-reduced-motion: reduce)')
    .slice(1)
    .join('\n');

  it('App.css carries a prefers-reduced-motion block', () => {
    expect(
      reducedMotionBlocks,
      'the bars must be able to arrive instantly for users who ask for less motion — the shape ' +
        'is still correct, only the settling is removed',
    ).not.toBe('');
  });

  it('that block opts the bar fill out of its transition', () => {
    expect(reducedMotionBlocks).toContain('.category-bar__fill');
    expect(reducedMotionBlocks).toMatch(/\.category-bar__fill\s*\{[^}]*transition:\s*none/);
  });
});

describe('App.css — the settled cue', () => {
  const settledRule =
    baseCss.split('}').find((chunk) => chunk.includes('.odds-panel--settled')) ?? '';
  const settledDeclarations = withoutComments(settledRule);

  it('attaches a hairline to the trial counter', () => {
    expect(settledRule, 'App.css must style .odds-panel--settled').not.toBe('');
    expect(settledRule).toContain("data-testid='trial-counter'");
  });

  it('uses an existing token and introduces no new colour', () => {
    expect(settledDeclarations).toContain('var(--accent-border)');
    expect(settledDeclarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(settledDeclarations).not.toMatch(/\brgba?\(/);
  });

  it('is drawn as a box-shadow so appearing cannot shift the layout', () => {
    // A border/padding pair would either nudge the stats row when a run finishes, or require a
    // counterpart declaration on the SHARED .odds-stat__value rule that blackjack's panel also
    // consumes — changing that game's computed styles for a Hold'em-only feature.
    expect(settledDeclarations).toContain('box-shadow');
    expect(settledDeclarations).not.toContain('border-bottom');
    expect(settledDeclarations).not.toContain('padding');
  });

  it('is scoped to the Hold\'em panel — the blackjack panel never receives the class', () => {
    expect(readSource('ui/OddsPanel.tsx')).toContain('odds-panel--settled');
    expect(readSource('ui/BlackjackOddsPanel.tsx')).not.toContain('odds-panel--settled');
  });
});

describe('OddsPanel — the settled flag is derived, never stored', () => {
  it('computes settled from the snapshot fields oddsStore already owns', () => {
    const source = readSource('ui/OddsPanel.tsx');
    expect(
      source,
      'the settled cue must be a derived value — a new store field could drift out of sync ' +
        'with the numbers it describes',
    ).toContain('const settled = done && !pending && trialsCompleted > 0;');
  });

  it('oddsStore gained no field for it', () => {
    const store = readSource('state/oddsStore.ts');
    expect(store).not.toContain('settled:');
    expect(store).not.toContain('isSettled');
  });
});
