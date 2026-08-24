// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Phase 5 mode-shell source-shape guard (D-02/D-05/D-07/D-08/D-10, Pitfall 10, Pitfall 11).
// Mirrors src/engine/shoePath.guard.test.ts: it reads OTHER files' source text, never its own,
// so it cannot self-invalidate by mentioning the very tokens it forbids.
//
// This file pins the negative invariants that behavioral tests structurally cannot express —
// the ABSENCE of a token, call site, or cross-import — for the mode shell built in Plans 01-02:
//   - gameModeStore.ts stays the ONLY cross-game store: no deckCount field, no import of any
//     Hold'em store (D-02, D-05).
//   - No Hold'em store or engine/conditioning.ts ever grows a `blackjack`/`gameMode` branch —
//     PITFALLS Pitfall 10's stated warning sign.
//   - App.tsx keeps exactly ONE `cancelSimulation(` call site (the existing effect cleanup) and
//     zero production `resetAnimations` calls — cancellation and gate-drain stay on the
//     mechanisms Plan 01 already wired, never a second one (D-07, D-08).
//   - The mode-scoped odds effect's early-return guard and its dependency array both exist —
//     one without the other is a silent bug (D-05).
//   - No Phase 5 file mentions `deckCount` at all — the wire path is Phase 6/8's, and nothing
//     here may pass `deckCount: 2` into the Hold'em trial path before Phase 7's duplicate-aware
//     evaluator exists (D-10, WR-02, WR-03).
//   - oddsStore's `knowledgeKey` stays the exact poker-shaped two-part key, no game discriminant
//     bolted on (Pitfall 11 — Phase 6 gets its OWN store instead of widening this one).
//   - The UI-SPEC's locked copy and label strings stay verbatim.
//
// STANDING RULE for future phases: when a later phase legitimately needs one of these tokens
// (for example, Phase 6 adding `deckCount` to `gameModeStore.ts`, or Phase 8 giving it a real
// cross-store read), the correct move is to AMEND this guard in the SAME COMMIT as the feature,
// with the phase decision cited in the updated assertion/comment — never to silently delete or
// weaken an assertion here.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = __dirname;

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8');
}

/**
 * Strips full-line comments (lines whose trimmed form starts with `//` or `*`) before an
 * occurrence count is taken, so a future explanatory comment that happens to mention the
 * counted token (e.g. "the cancelSimulation( call below...") cannot silently inflate the
 * count and flip a `toBe(1)` assertion. Only used ahead of COUNT assertions, never ahead of
 * substring-presence/absence assertions — those already read comments intentionally (the
 * locked-copy checks below must find their strings wherever they live in the source).
 */
function stripCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}

/**
 * Collapses all whitespace runs (including the newline + indentation Prettier inserts when it
 * wraps a long JSX text child across lines) to a single space, then trims. JSX collapses
 * whitespace identically at render time, so this normalization compares the RENDERED text
 * contract, not incidental source line-wrapping — a Prettier reformat of the same copy must
 * never flip this assertion.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('gameModeStore.ts — the only cross-game store (D-02, D-05)', () => {
  // Comment-stripped BEFORE these checks (same technique as the cancelSimulation( count below):
  // gameModeStore.ts's own guard comment explicitly NAMES gameStore/oddsStore/pickerStore/uiStore
  // in prose to document that it must import none of them (05-01-SUMMARY.md "Issues Encountered"
  // — this exact wording tension was identified and deliberately resolved by Plan 01, keeping the
  // explanatory comment over a vaguer one). Checking the raw unfiltered source would make this
  // guard permanently red against Plan 01's approved, already-committed code. Stripping comment
  // lines means this assertion catches what actually matters: a real `import` statement or a real
  // field/property referencing one of these tokens in executable code.
  const source = stripCommentLines(readSource('state/gameModeStore.ts'));

  it.each(['deckCount', 'gameStore', 'oddsStore', 'pickerStore', 'uiStore'])(
    'contains no occurrence of %s outside of comments',
    (token) => {
      expect(
        source,
        `gameModeStore.ts must never contain "${token}" in executable code — it is the ONLY ` +
          'cross-game store this phase (D-02) and must import nothing from the Hold\'em-owned ' +
          'stores (D-05); a `deckCount` field belongs to Phase 6/8, not this phase (D-10)',
      ).not.toContain(token);
    },
  );
});

describe('Hold\'em stores and engine/conditioning.ts — no mode branch (Pitfall 10)', () => {
  const holdemOnlyFiles = [
    'state/gameStore.ts',
    'state/oddsStore.ts',
    'state/pickerStore.ts',
    'state/uiStore.ts',
    'engine/conditioning.ts',
  ];

  it.each(holdemOnlyFiles)('%s contains neither "blackjack" nor "gameMode" (case-insensitive)', (relativePath) => {
    const lowered = readSource(relativePath).toLowerCase();
    expect(
      lowered,
      `${relativePath} must never mention "blackjack" — PITFALLS Pitfall 10's warning sign is ` +
        'any if (mode === \'blackjack\') branch appearing inside a Hold\'em-owned store or ' +
        'conditioning.ts; these files must stay entirely unaware Blackjack exists (D-05)',
    ).not.toContain('blackjack');
    expect(
      lowered,
      `${relativePath} must never mention "gameMode" (in any case) — importing useGameModeStore ` +
        'or branching on a mode value inside a Hold\'em-owned store is exactly the mode-leakage ' +
        'PITFALLS Pitfall 10 warns against (D-05)',
    ).not.toContain('gamemode');
  });
});

describe('App.tsx — single cancellation owner, no production gate reset (D-07, D-08)', () => {
  const source = readSource('App.tsx');
  const commentsStripped = stripCommentLines(source);

  it('contains exactly one cancelSimulation( call site, outside of comments', () => {
    // Comment-stripped BEFORE counting (see stripCommentLines doc comment above) — this
    // function's own file-level comments are free to describe cancelSimulation( in prose
    // without flipping this count.
    const occurrences = commentsStripped.split('cancelSimulation(').length - 1;
    expect(
      occurrences,
      'App.tsx must contain exactly ONE cancelSimulation( call — the existing effect-cleanup ' +
        'call site is D-07\'s entire cancellation mechanism for a mode switch; a second call ' +
        'site would mean a competing/duplicate cancellation path was added',
    ).toBe(1);
  });

  it.each(['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx', 'ui/BlackjackScene.tsx'])(
    '%s contains zero occurrences of resetAnimations',
    (relativePath) => {
      const target = relativePath === 'App.tsx' ? source : readSource(relativePath);
      expect(
        target,
        `${relativePath} must never call resetAnimations — gate-drain on a mode switch happens ` +
          'ONLY via the existing useAnimationGate/useExitGate unmount-cleanup paths (D-08); ' +
          'uiStore.resetAnimations is TEST-ONLY and must never appear in production code',
      ).not.toContain('resetAnimations');
    },
  );

  it('the odds effect is mode-scoped: an early return on non-holdem mode exists', () => {
    expect(
      source,
      'App.tsx must contain the literal guard `if (mode !== \'holdem\') return;` as the odds ' +
        'effect\'s FIRST check — without it, a live run could start or an odds cache key could ' +
        'be written while Blackjack is on screen (D-05)',
    ).toContain("if (mode !== 'holdem') return;");
  });

  it('the odds effect\'s dependency array includes mode as a real trigger', () => {
    expect(
      source,
      'App.tsx\'s odds effect dependency array must end with `pendingAnimationCount, mode]` — ' +
        'the early-return guard alone is not enough: `mode` must also be a dependency, or ' +
        'switching modes would not re-run the effect and tear down the previous run (D-05)',
    ).toContain('pendingAnimationCount, mode]');
  });
});

describe('No deckCount anywhere in the Phase 5 mode-shell files (D-10, WR-02, WR-03)', () => {
  const files = ['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx', 'ui/BlackjackScene.tsx'];

  it.each(files)('%s contains zero occurrences of deckCount', (relativePath) => {
    expect(
      readSource(relativePath),
      `${relativePath} must never mention deckCount — the deck-count wire path is Phase 6/8's, ` +
        'and nothing in this phase may pass deckCount: 2 into the Hold\'em trial path before ' +
        'Phase 7\'s duplicate-aware evaluator exists (D-10, WR-02, WR-03)',
    ).not.toContain('deckCount');
  });
});

describe('BlackjackScene.tsx — honest, control-free placeholder (D-03, D-05)', () => {
  const source = readSource('ui/BlackjackScene.tsx');

  it.each(['<button', 'gameStore', 'oddsStore', 'pickerStore', 'uiStore'])(
    'contains no occurrence of %s',
    (token) => {
      expect(
        source,
        `ui/BlackjackScene.tsx must never contain "${token}" — D-03 forbids ANY interactive ` +
          'gameplay control (live or disabled) on the placeholder, and D-05 requires this ' +
          'component to read no Hold\'em-owned store',
      ).not.toContain(token);
    },
  );
});

describe('Locked copy and labels stay verbatim (D-01, D-03, UI-SPEC Copywriting Contract)', () => {
  const BLACKJACK_HEADING = 'The Blackjack table deals next';
  const BLACKJACK_BODY =
    'Player hand, dealer upcard, live bust and outcome odds, and Stand-vs-Hit choices land here next. Switch back to Hold\'em to keep watching odds converge now.';
  const HOLDEM_LABEL = "Hold'em";
  const BLACKJACK_LABEL = 'Blackjack';
  const SWITCHER_TESTIDS = ['game-mode-switcher', 'game-mode-switch-holdem', 'game-mode-switch-blackjack'];

  it('BlackjackScene.tsx contains the locked heading and body copy verbatim', () => {
    const source = readSource('ui/BlackjackScene.tsx');
    expect(
      source,
      'the UI-SPEC Copywriting Contract locks this exact heading string — a reword must go ' +
        'through the UI-SPEC, not silently drift in code (D-01, D-03)',
    ).toContain(BLACKJACK_HEADING);
    // Whitespace-normalized (see normalizeWhitespace doc comment above): the JSX source wraps
    // this long paragraph across two lines with indentation, which is invisible in the RENDERED
    // text (JSX collapses whitespace) but would break a raw substring match against the
    // single-line locked-copy constant.
    expect(
      normalizeWhitespace(source),
      'the UI-SPEC Copywriting Contract locks this exact body string verbatim, including the ' +
        '"Switch back to Hold\'em" sentence — a reword must go through the UI-SPEC (D-01, D-03)',
    ).toContain(normalizeWhitespace(BLACKJACK_BODY));
  });

  it('GameModeSwitcher.tsx contains the locked labels verbatim', () => {
    const source = readSource('ui/GameModeSwitcher.tsx');
    expect(source, 'D-01 locks the exact label "Hold\'em" on the switcher').toContain(HOLDEM_LABEL);
    expect(source, 'D-01 locks the exact label "Blackjack" on the switcher').toContain(BLACKJACK_LABEL);
  });

  it.each(SWITCHER_TESTIDS)('GameModeSwitcher.tsx contains the locked testid %s', (testid) => {
    const source = readSource('ui/GameModeSwitcher.tsx');
    expect(
      source,
      `the UI-SPEC "Testids — NEW this phase" section locks "${testid}" — behavioral tests and ` +
        'future phases depend on this exact string',
    ).toContain(testid);
  });
});

describe('oddsStore.ts — knowledgeKey stays the exact two-part poker-shaped key (Pitfall 11)', () => {
  it('knowledgeKey still returns `${street}|${revealedMask}` with no game discriminant prefix', () => {
    const source = readSource('state/oddsStore.ts');
    expect(
      source,
      'Pitfall 11: knowledgeKey must stay exactly `${street}|${revealedMask}` — no game ' +
        'discriminant may be bolted onto this key this phase; Phase 6 gets its OWN store ' +
        'instead of widening this one',
    ).toContain('return `${street}|${revealedMask}`;');
  });
});
