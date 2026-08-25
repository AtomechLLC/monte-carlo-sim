// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// "Felt & Brass" steps (iv) DEPTH and (v) TYPOGRAPHY — source-shape guard, in the repo's
// established `*.guard.test.ts` shape (see ui/shareBars.guard.test.ts, App.modeShell.guard.
// test.ts, engine/shoePath.guard.test.ts). It reads OTHER files' source text, never its own,
// so naming a forbidden token here cannot self-invalidate.
//
// Everything these two passes shipped is CSS, and this harness deliberately loads NO
// stylesheet and forces `prefers-reduced-motion: reduce` for every test — so a rendered
// assertion can observe literally none of it. Source level is the only honest place to pin:
//
//   1. THE ELEVATION SCALE IS THREE LEVELS. Not two, not five. The whole value of a scale is
//      that "raised" means one specific thing everywhere it is used; the moment a fourth token
//      appears, each shadow is once again a local decision. The sweep below cannot be
//      out-enumerated — it collects every `--elev-*` declaration rather than checking for the
//      three by name.
//
//   2. A CARD IN FLIGHT IS DRAWN IN FLIGHT, AND THE HOOK IT HANGS ON IS THE SHIPPED ONE. The
//      CSS keys on `.card-in-flight`, a class AnimatedCard applies from the animation gate. A
//      rename on the TSX side would silently orphan the rule with nothing going red, so both
//      halves are pinned together.
//
//   3. THE DEPTH PASS TOUCHED NO TIMING. The gate and the Motion choreography contract were
//      off-limits, and "off-limits" is worth exactly as much as its test: the three duration
//      constants are pinned verbatim, and AnimatedCard is pinned to carry no shadow of its own.
//
//   4. THE DISPLAY FACE IS FENCED. A Didone is unreadable at body sizes, so `--display` must
//      reach h1/h2 and nothing else — an ABSENCE (of a second consumer), which no render can
//      show.
//
//   5. THE TYPE SCALE IS 4 SIZES AND 2 WEIGHTS, PROVABLY. Previously prose. The sweeps below
//      collect every `font-size`, `font-weight` and `font` shorthand across both stylesheets,
//      so a fifth size cannot arrive by any of the three routes — including the shorthand,
//      which carries a size and a weight past both of the other two regexes.
//
//   6. THE FONTS ARE SELF-HOSTED, OFFLINE-SAFE AND LATIN-ONLY. A CDN link or a stray subset
//      import is again an absence/shape question, not a behavioural one.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..');
const REPO_ROOT = join(SRC_DIR, '..');

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8');
}

const indexCss = readSource('index.css');
const appCss = readSource('App.css');
const fontsCss = readSource('fonts.css');
const mainSource = readSource('main.tsx');
const appSource = readSource('App.tsx');
const animatedCardSource = readSource('ui/AnimatedCard.tsx');
const indexHtml = readFileSync(join(REPO_ROOT, 'index.html'), 'utf8');

/** Comments stripped, so prose that happens to quote a declaration cannot satisfy — or trip —
 * a check that is about real declarations. Every sweep below runs on this view. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * `css` with every `@media` block removed, braces matched — lifted from
 * ui/shareBars.guard.test.ts for the same reason it exists there: several selectors here
 * legitimately appear twice, once as the base rule and once inside the reduced-motion query,
 * and the repo's usual "split on `}` and expect one chunk" technique cannot tell a legitimate
 * media override from an accidentally duplicated block. Base rules are looked up in this view;
 * the media queries are asserted separately.
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

const baseAppCss = withoutMediaBlocks(appCss);
const baseIndexCss = withoutMediaBlocks(indexCss);

/**
 * The declarations of the single BASE rule whose OPENING line is exactly `${selector} {`.
 *
 * Deliberately line-anchored rather than substring-matched: `.playing-card` is a substring of
 * `.flip-card-face .playing-card`, `.deck-origin .playing-card` and `.card-in-flight
 * .playing-card`, all of which are real, separate rules in App.css. A substring filter would
 * collect five chunks and the `toHaveLength(1)` below would be unfalsifiable noise rather than
 * the duplicate-block detector it is here to be.
 */
function ruleFor(css: string, selector: string, options?: { excluding?: string }): string {
  const matches = css.split('}').filter((chunk) => {
    const lines = chunk.split('\n').map((line) => line.trim());
    if (!lines.includes(`${selector} {`)) return false;
    // `excluding` names another line of a DIFFERENT rule's selector list, for the one case
    // where a bare selector legitimately opens two rules: index.css has both `h1,\nh2 {` (the
    // shared family/weight/colour rule) and a standalone `h2 { ... }` for the size.
    return options?.excluding === undefined || !lines.includes(options.excluding);
  });
  expect(
    matches,
    `expected exactly one base rule opening with "${selector} {" — zero means it was removed ` +
      'or reformatted, more than one means a duplicated block appeared (media-query overrides ' +
      'are excluded from this view and asserted separately)',
  ).toHaveLength(1);
  return matches[0];
}

/**
 * The BODIES of every `@media (prefers-reduced-motion: reduce)` block, brace-matched.
 *
 * Not a `split()` on the query text (the technique ui/shareBars.guard.test.ts uses): that
 * yields everything from the query to the end of the FILE, which is fine for the positive
 * `toContain` assertions there but would make the negative assertion below — "this block
 * contains no box-shadow" — read the whole remainder of the stylesheet and fail against rules
 * that have nothing to do with reduced motion.
 */
function reducedMotionBodies(css: string): string {
  const QUERY = '@media (prefers-reduced-motion: reduce)';
  const bodies: string[] = [];
  let cursor = 0;

  for (;;) {
    const at = css.indexOf(QUERY, cursor);
    if (at === -1) return bodies.join('\n');

    const open = css.indexOf('{', at);
    if (open === -1) return bodies.join('\n');

    let depth = 1;
    let scan = open + 1;
    while (scan < css.length && depth > 0) {
      if (css[scan] === '{') depth += 1;
      else if (css[scan] === '}') depth -= 1;
      scan += 1;
    }
    bodies.push(css.slice(open + 1, scan - 1));
    cursor = scan;
  }
}

describe('index.css — the elevation scale is exactly three levels (Felt & Brass iv)', () => {
  const declarations = withoutComments(indexCss);
  const elevTokens = [...declarations.matchAll(/(--elev-[a-z-]+):\s*([^;]+);/g)].map((match) => ({
    name: match[1],
    value: match[2].replace(/\s+/g, ' ').trim(),
  }));

  it('declares the three levels and the settle duration, and nothing else named --elev-*', () => {
    // Collected, not checked off by name: a scale's whole value is that "raised" means ONE
    // thing everywhere. A fourth level makes each shadow a local decision again, and an
    // enumerated `toContain` per token would never notice it arriving.
    expect(
      elevTokens.map((token) => token.name),
      'the scale is rest / raised / in-flight plus the settle duration — an object on this ' +
        'table is lying on it, lifted off it, or in the air between two places, and there is ' +
        'no fourth thing a shadow means here',
    ).toEqual(['--elev-rest', '--elev-raised', '--elev-in-flight', '--elev-settle']);
  });

  it.each(['--elev-rest', '--elev-raised', '--elev-in-flight'])(
    '%s is a two-part contact + cast shadow',
    (name) => {
      const value = elevTokens.find((token) => token.name === name)?.value ?? '';
      expect(
        value.split(',').filter((part) => part.includes('rgba(')),
        `${name} must be TWO shadows — a tight contact shadow saying where the object touches ` +
          'and a long soft cast shadow saying how far it is from what it sits on. A single ' +
          'blurred blob has no contact/cast ratio and never reads as height',
      ).toHaveLength(2);
    },
  );

  it('spends no accent — depth is the absence of light, not a colour', () => {
    for (const token of elevTokens) {
      expect(
        token.value,
        `${token.name} must not reference the reserved accent role: the brass budget is the ` +
          'three Hold\'em uses (street label, filled picker slot, enabled Advance) and a ' +
          'shadow is not a fourth (UI-SPEC A2)',
      ).not.toContain('--accent');
      expect(token.value).not.toContain('--destructive');
    }
  });

  it('retires --shadow, the scaffold token the scale replaces', () => {
    // Its last consumer went with the Phase 2 selector cleanup. Swept across BOTH stylesheets
    // so it cannot come back as a one-off in App.css either.
    expect(withoutComments(indexCss)).not.toContain('--shadow');
    expect(withoutComments(appCss)).not.toContain('--shadow');
  });
});

describe('App.css — settled cards rest, cards in flight are lifted (Felt & Brass iv)', () => {
  const playingCard = withoutComments(ruleFor(baseAppCss, '.playing-card'));
  const inFlightCard = withoutComments(ruleFor(baseAppCss, '.card-in-flight .playing-card'));

  it('a settled card takes the rest level, with no hardcoded shadow left', () => {
    expect(playingCard).toContain('box-shadow: var(--elev-rest)');
    expect(
      playingCard,
      '.playing-card carried a one-off `0 2px 6px rgba(0, 0, 0, 0.35)` before the scale ' +
        'existed; a raw shadow literal reappearing here means the scale was bypassed',
    ).not.toMatch(/box-shadow:[^;]*rgba?\(/);
  });

  it('a card in flight takes the in-flight level', () => {
    expect(
      inFlightCard,
      'the lift is the whole point: a card between the deck and its slot must be drawn in the ' +
        'air, not printed flat on the felt',
    ).toContain('box-shadow: var(--elev-in-flight)');
  });

  it('the lift hangs on the SHIPPED gate hook, which AnimatedCard still applies', () => {
    // Both halves together, deliberately. The CSS keys on a class the TSX owns; a rename on
    // either side alone would orphan the rule with nothing else going red.
    expect(
      animatedCardSource,
      'AnimatedCard must still co-apply `card-in-flight` while its useAnimationGate reports ' +
        'pending — that window IS the definition of "in flight", and the CSS rule above has ' +
        'no other way to know it',
    ).toContain("'card-in-flight'");
  });

  it('nothing else in the scale can out-specify the in-flight state', () => {
    // The hover lift is a far more specific selector than `.card-in-flight .playing-card`
    // ((0,6,0) against (0,2,0)), so a pointer left resting over a seat during a deal would
    // otherwise draw an airborne card as merely raised — the one level in the scale that is
    // about physics rather than about the pointer, defeated by where the mouse happened to be.
    for (const chunk of withoutComments(baseAppCss).split('}')) {
      if (!/:hover|:focus-visible/.test(chunk)) continue;
      if (!chunk.includes('.playing-card')) continue;
      expect(
        chunk,
        'an interactive elevation rule that reaches .playing-card must exclude ' +
          '.card-in-flight — excluding the class outright is stronger than specificity ' +
          'tuning, because then the two states cannot contend at all',
      ).toContain(':not(.card-in-flight)');
    }
  });

  it('the settle is a CSS transition on one non-layout property', () => {
    const transition = /transition:\s*([^;]+);/.exec(playingCard)?.[1] ?? '';
    expect(transition, '.playing-card must transition its box-shadow').toContain('box-shadow');
    expect(transition, 'the duration comes from the scale, never a magic number').toContain(
      'var(--elev-settle)',
    );
    expect(transition, 'never `all` — it would sweep up properties nobody chose').not.toContain('all');
    expect(transition.split(','), 'exactly one transitioned property').toHaveLength(1);
  });

  it.each(['transform', 'opacity', 'width', 'height', 'top', 'left'])(
    'the settle never transitions %s — Motion owns every property that moves a card',
    (property) => {
      const transition = /transition:\s*([^;]+);/.exec(playingCard)?.[1] ?? '';
      expect(
        transition,
        `a CSS transition on ${property} would fight AnimatedCard's inline Motion styles for ` +
          'the same property — the depth pass is allowed to change how a card is SHADED while ' +
          'it flies, never how or when it moves',
      ).not.toContain(property);
    },
  );
});

describe('AnimatedCard.tsx — the depth pass touched no timing and no gate (Felt & Brass iv)', () => {
  it.each([
    'const DEAL_DURATION_S = 0.3;',
    'const DEAL_STAGGER_INTERVAL_S = 0.08;',
    'const EXIT_DURATION_S = 0.15;',
  ])('the choreography constant `%s` is unchanged', (constant) => {
    expect(
      animatedCardSource,
      'the UI-SPEC Animation Choreography Contract was off-limits to this pass, and ' +
        '"off-limits" is worth exactly as much as its test',
    ).toContain(constant);
  });

  it.each(['box-shadow', 'boxShadow', 'elev'])(
    'contains no occurrence of %s — the lift is CSS-only',
    (token) => {
      expect(
        animatedCardSource,
        `AnimatedCard must never contain "${token}": the in-flight elevation is one CSS rule ` +
          'keyed on the class the gate already applies. An inline shadow here would put the ' +
          'visual state on a second, competing mechanism',
      ).not.toContain(token);
    },
  );
});

describe('App.css — reduced motion removes the settle, never the state (Felt & Brass iv)', () => {
  const reducedMotionBlocks = reducedMotionBodies(appCss);

  it('the card opts out of its transition', () => {
    expect(reducedMotionBlocks, 'App.css must carry a prefers-reduced-motion block').not.toBe('');
    expect(reducedMotionBlocks).toMatch(/\.playing-card\s*\{[^}]*transition:\s*none/);
  });

  it('opts out of the TRANSITION only — every box-shadow declaration stays outside the query', () => {
    // The distinction this whole block exists for: a user who asks for less motion still gets
    // the lifted card, the hovered seat and the settled card drawn correctly. They just arrive
    // instantly. A `box-shadow` inside the query would be removing the STATE, not the easing.
    expect(
      withoutComments(reducedMotionBlocks),
      'the reduced-motion block must contain no box-shadow declaration — the styled end state ' +
        'is identical for every user; only the easing between states is dropped',
    ).not.toContain('box-shadow');
  });

  it('extends the shipped block rather than replacing it', () => {
    expect(
      reducedMotionBlocks,
      "the Share column's own opt-out must survive — this pass adds to that block, it does " +
        'not take it over',
    ).toMatch(/\.category-bar__fill\s*\{[^}]*transition:\s*none/);
  });
});

describe('App.css — the felt is lit and framed, not re-laid-out (Felt & Brass iv)', () => {
  const felt = withoutComments(ruleFor(baseAppCss, '.felt'));

  it.each([
    'width: min(100%, 760px)',
    'aspect-ratio: 16 / 10',
    'margin-inline: auto',
    'border-radius: 50%',
    'z-index: var(--z-felt)',
  ])('keeps the shipped geometry declaration `%s`', (declaration) => {
    expect(
      felt,
      'this pass is lighting and framing (03-02 D-04 owns the table geometry) — a changed ' +
        'dimension here would move every percentage-positioned seat on the table',
    ).toContain(declaration);
  });

  it('keeps the shipped felt gradient, values and all, as the base layer', () => {
    expect(
      felt,
      'the --felt/--felt-dark pair was tuned against the card art and the badge contrast; the ' +
        'lamp is layered OVER it, never in place of it',
    ).toContain('radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 100%)');
  });

  it('hangs a light source above the table', () => {
    const gradients = felt.match(/radial-gradient\(/g) ?? [];
    expect(
      gradients.length,
      'two background layers: the overhead lamp over the shipped felt gradient. One layer ' +
        'means the lamp was dropped and the table is flat again',
    ).toBe(2);

    // The lamp's own centre, read out of the source rather than pinned to a literal — what
    // matters is that light comes from ABOVE the table (which is where a lamp is, and what
    // makes the dealer's end the bright end), not that it sits at any exact percentage.
    const lampCentre = /ellipse\s+[\d.]+%\s+[\d.]+%\s+at\s+[\d.]+%\s+(-?[\d.]+)%/.exec(felt);
    expect(lampCentre, 'the added gradient must declare an explicit `at x% y%` centre').not.toBeNull();
    expect(
      Number(lampCentre?.[1]),
      'the lamp must be centred above the vertical midpoint of the table — a highlight below ' +
        'it would light the felt from the floor',
    ).toBeLessThan(50);
  });

  it('keeps the rail on the shipped token at the shipped thickness, and lights it', () => {
    expect(
      felt,
      'the rail ring is the shipped 03-02 declaration verbatim: same --felt-rail token, same ' +
        '12px, so the top seats overlap it by exactly as much as they always did',
    ).toContain('inset 0 0 0 12px var(--felt-rail)');

    const insetLayers = felt.match(/inset\s/g) ?? [];
    expect(
      insetLayers.length,
      'at least three inset layers: the rail body, something lighting it, and the rim the ' +
        'felt falls into. One inset layer is the flat outline this pass replaced',
    ).toBeGreaterThanOrEqual(3);
  });

  it('still casts onto the room', () => {
    const boxShadow = /box-shadow:\s*([^;]+);/.exec(felt)?.[1] ?? '';
    const outerLayers = boxShadow.split(',').filter((layer) => !layer.includes('inset'));
    expect(
      outerLayers.length,
      'a table with only inset shadows is a hole in the page, not an object on it',
    ).toBeGreaterThanOrEqual(1);
  });

  it('spends no accent — the depth pass introduces zero new brass', () => {
    expect(felt).not.toContain('--accent');
    expect(felt).not.toContain('--destructive');
  });
});

describe('App.css — the accent budget is still exactly three Hold\'em uses (UI-SPEC A2)', () => {
  // The one colour invariant this pass could plausibly have broken. `var(--accent)` (the full
  // accent, not the --accent-bg/--accent-border tints, which the Share column legitimately
  // uses) may appear in exactly two rules: the reserved-uses rule listing the three roles, and
  // the leading probability bar.
  const consumers = withoutComments(baseAppCss)
    .split('}')
    .filter((chunk) => /(?:^|[^-])var\(--accent\)/.test(chunk));

  it('exactly two rules spend the full accent, and they are the shipped two', () => {
    expect(consumers).toHaveLength(2);
    expect(consumers.join('\n')).toContain("[data-testid='street-label']");
    expect(consumers.join('\n')).toContain('.picker-slot-filled');
    expect(consumers.join('\n')).toContain("[data-testid='advance-button']:not(:disabled)");
    expect(consumers.join('\n')).toContain('.category-bar__fill--leading');
  });
});

describe('index.css — the type stacks (Felt & Brass v)', () => {
  const declarations = withoutComments(indexCss);

  it('--display is the Didone, with a serif fallback chain', () => {
    const value = /--display:\s*([^;]+);/.exec(declarations)?.[1].trim();
    expect(value, 'index.css must declare a --display stack').toBeDefined();
    expect(value).toContain("'Bodoni Moda Variable'");
    expect(
      value,
      'every fallback must be the same KIND of face — a Didone degrading to a sans would ' +
        'change the wordmark\'s voice entirely on a failed load',
    ).toMatch(/serif$/);
  });

  it('--sans leads with the self-hosted face and keeps the shipped stack behind it', () => {
    const value = /--sans:\s*([^;]+);/.exec(declarations)?.[1].trim();
    expect(value).toMatch(/^'IBM Plex Sans',/);
    expect(
      value,
      'system-ui must stay in the stack: a failed font load then degrades to precisely what ' +
        'shipped before, not to a UA default nobody chose',
    ).toContain('system-ui');
  });

  it('--mono is untouched — the hand-category card ranks are set in it', () => {
    expect(declarations).toContain('--mono: ui-monospace, Consolas, monospace;');
    expect(withoutComments(appCss)).toContain('var(--mono)');
  });

  it('--heading is gone, renamed to the role it now names', () => {
    expect(declarations).not.toContain('--heading');
    expect(withoutComments(appCss)).not.toContain('--heading');
  });
});

describe('The display face is fenced to the two heading roles (Felt & Brass v)', () => {
  it('exactly one rule in the whole app consumes var(--display), and it is h1 + h2', () => {
    // A Didone's character IS the hairline/stem contrast, and below roughly 20px the hairlines
    // stop resolving and the face just looks weak. "Display only" is therefore a rule about
    // where the token may appear, and this is the only place that fact can be checked: it is
    // an ABSENCE of other consumers.
    const consumers = [
      ...withoutComments(indexCss).split('}'),
      ...withoutComments(appCss).split('}'),
    ].filter((chunk) => chunk.includes('var(--display)'));

    expect(
      consumers,
      'a second consumer means the display face escaped the heading roles — the next stop is ' +
        'Bodoni on a 14px label, which is illegible',
    ).toHaveLength(1);
    expect(consumers[0].split('\n').map((line) => line.trim())).toContain('h1,');
    expect(consumers[0].split('\n').map((line) => line.trim())).toContain('h2 {');
  });

  it('the h1 display role is set at 32px', () => {
    expect(withoutComments(ruleFor(baseIndexCss, 'h1'))).toContain('font-size: 32px');
  });

  it('the h2 heading role is set at 20px — the floor, never below it', () => {
    // `excluding: 'h1,'` skips the shared h1+h2 family rule, which opens with the same `h2 {`
    // line. Both stylesheets are checked: index.css states the scale, and App.css's h2 rule is
    // the one with the authority (it loads second), so a 5th size could enter from either.
    expect(withoutComments(ruleFor(baseIndexCss, 'h2', { excluding: 'h1,' }))).toContain(
      'font-size: 20px',
    );
    expect(withoutComments(ruleFor(baseAppCss, 'h2'))).toContain('font-size: 20px');
  });

  it('Bodoni is never named outside the token and its own @font-face', () => {
    expect(withoutComments(appCss)).not.toContain('Bodoni');
  });
});

describe('index.css — the h1 is a wordmark (Felt & Brass v)', () => {
  const h1 = withoutComments(ruleFor(baseIndexCss, 'h1'));

  it('is tracked out, and re-centred by the same amount', () => {
    const tracking = /letter-spacing:\s*([^;]+);/.exec(h1)?.[1].trim();
    expect(tracking, 'the wordmark treatment IS the tracking — without it this is body copy at 32px').toBeDefined();
    expect(
      /text-indent:\s*([^;]+);/.exec(h1)?.[1].trim(),
      'letter-spacing adds its space after the LAST letter too, and centring counts that ' +
        'trailing space — a matching text-indent puts the same space back at the start so the ' +
        'line sits where it looks like it should',
    ).toBe(tracking);
  });

  it('spends no colour to do it', () => {
    expect(
      h1,
      'a permanently gold banner would quietly become a fourth accent use (UI-SPEC A2) — the ' +
        'wordmark earns its presence from the letterforms and the tracking, not from brass',
    ).not.toContain('--accent');
  });

  it('the wordmark text itself is untouched', () => {
    expect(appSource).toContain('<h1>Monte Carlo Poker Simulator</h1>');
  });
});

describe('The type scale is 4 sizes and 2 weights, provably (Felt & Brass v)', () => {
  const stylesheets = withoutComments(indexCss) + '\n' + withoutComments(appCss);
  const collect = (pattern: RegExp): string[] => [
    ...new Set([...stylesheets.matchAll(pattern)].map((match) => match[1].trim())),
  ];

  it('every font-size declaration is one of the four scale steps (plus the one SVG exception)', () => {
    expect(
      new Set(collect(/font-size:\s*([^;]+);/g)),
      'the locked scale is Display 32 / Heading 20 / Body 16 / Label 14. `16px` also appears ' +
        "as the responsive root step, which is the same value, not a fifth size. `7.2px` is " +
        'the ONE documented exception: the two-character rank glyph inside the 21px-tall ' +
        'hand-category illustration (.hand-icon__rank--wide) — card art, not document type. ' +
        'Anything else in this set is a fifth size',
    ).toEqual(new Set(['32px', '20px', '16px', '14px', '7.2px']));
  });

  it('every font-weight declaration is one of the two locked weights', () => {
    expect(
      new Set(collect(/font-weight:\s*([^;]+);/g)),
      'two weights app-wide (UI-SPEC A6): 400 and 600. The scaffold\'s orphan 500 was retired ' +
        'in Phase 3 and nothing may bring a third weight back — note also that index.css sets ' +
        '`font-synthesis: none`, so a weight with no loaded face would not even be faked, it ' +
        'would silently snap to the nearest one that is',
    ).toEqual(new Set(['400', '600']));
  });

  it('the `font` shorthand — which carries a size AND a weight past both sweeps above — is the shipped three', () => {
    expect(
      collect(/(?:^|[^-\w])font:\s*([^;]+);/gm).sort(),
      'the shorthand is the hole in the two sweeps above: `font: 500 18px ...` sets a weight ' +
        'and a size while matching neither `font-size:` nor `font-weight:`. These three are ' +
        'the root step and the two hand-icon SVG glyph styles; a fourth needs justifying here',
    ).toEqual(['18px/145% var(--sans)', '400 6.5px / 1 var(--mono)', '600 9px / 1 var(--mono)']);
  });
});

describe('The fonts are self-hosted, offline-safe and latin-only (Felt & Brass v)', () => {
  it('nothing reaches out to a font CDN', () => {
    // The app ships as a static bundle served from a GitHub Pages subpath and has to work with
    // no network at all. A CDN <link> also silently reintroduces a third-party dependency into
    // an app that currently has none at runtime.
    for (const [name, source] of [
      ['index.html', indexHtml],
      ['src/main.tsx', mainSource],
      ['src/fonts.css', fontsCss],
      ['src/index.css', indexCss],
    ] as const) {
      expect(source, `${name} must not link a remote font`).not.toContain('fonts.googleapis');
      expect(source, `${name} must not link a remote font`).not.toContain('fonts.gstatic');
      expect(source, `${name} must not link a remote font`).not.toContain('https://');
    }
  });

  it('main.tsx imports exactly three font stylesheets', () => {
    const fontImports = [...mainSource.matchAll(/^import\s+'([^']*(?:fontsource|fonts\.css)[^']*)';?$/gm)].map(
      (match) => match[1],
    );
    expect(
      fontImports,
      'three, deliberately: the display face at its one variable weight axis, and the sans at ' +
        'exactly the two weights the locked scale uses. A fourth import is a type-scale ' +
        'decision (a new weight or a new subset), not plumbing, and should be argued for here',
    ).toEqual([
      './fonts.css',
      '@fontsource/ibm-plex-sans/latin-400.css',
      '@fontsource/ibm-plex-sans/latin-600.css',
    ]);
  });

  it('every @fontsource stylesheet imported is a latin subset', () => {
    for (const specifier of [...mainSource.matchAll(/'(@fontsource[^']+)'/g)].map((m) => m[1])) {
      expect(
        specifier,
        `${specifier} must name a latin-only stylesheet — a package's bare entry point declares ` +
          'every subset it ships, and Vite bundles every file a stylesheet references whether ' +
          'a browser would ever fetch it or not',
      ).toMatch(/\/latin-\d{3}\.css$/);
    }
  });

  it('the hand-rolled Bodoni face references exactly one file, and it is the latin one', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    expect(urls, 'one @font-face, one file').toHaveLength(1);
    expect(urls[0]).toContain('bodoni-moda-latin-wght-normal.woff2');
    for (const unusedSubset of ['latin-ext', 'math', 'symbols', 'italic']) {
      expect(
        urls[0],
        `the ${unusedSubset} subset would be bundled into dist and never downloaded by anyone`,
      ).not.toContain(unusedSubset);
    }
  });

  it('that file actually exists in node_modules', () => {
    // Falsifiability control for the pin above: a typo'd specifier would satisfy every string
    // assertion in this block and fail only at build time, or — worse — silently resolve to
    // nothing and leave the wordmark rendering in Georgia.
    expect(
      existsSync(
        join(
          REPO_ROOT,
          'node_modules',
          '@fontsource-variable',
          'bodoni-moda',
          'files',
          'bodoni-moda-latin-wght-normal.woff2',
        ),
      ),
      'the woff2 the @font-face names must be a real file in the installed package',
    ).toBe(true);
  });

  it('the hand-rolled face copies upstream\'s family name and weight range', () => {
    // These three lines are the contract between src/fonts.css and the package: the family
    // name has to match what --display asks for, and the weight range has to cover both locked
    // weights or `font-synthesis: none` leaves a heading rendering at the wrong one.
    expect(fontsCss).toContain("font-family: 'Bodoni Moda Variable';");
    expect(fontsCss).toContain('font-weight: 400 900;');
    expect(fontsCss).toContain('font-display: swap;');
  });
});
