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
//
// AMENDED 2026-08-24 (Phase 6 plan 06-02, D-07): the <HoldemGame /> extraction moved the odds
// effect — and with it the cancelSimulation( cleanup, the mode gate and the dependency array —
// out of App.tsx into ui/HoldemGame.tsx, so those three assertions were RETARGETED at
// ui/HoldemGame.tsx in the same commit per this file's standing rule (never deleted, never
// weakened), and App.tsx is now additionally pinned as owning ZERO cancellation call sites.
//
// AMENDED 2026-08-24 (Phase 6 plan 06-07, D-13): the Phase 5 placeholder BlackjackScene.tsx
// was RETIRED in favour of the real Blackjack tree (BlackjackGame/BlackjackTable/
// BlackjackControls), so every assertion that named it was RETARGETED in the same commit per
// the standing rule — the D-05 no-Hold'em-store half survives against the three real files,
// the D-03 <button prohibition is superseded by D-13 (the real table has controls BY DESIGN;
// App.modeSwitch.test.tsx now pins the scene's exact control census), the locked-copy pins
// track the Phase 6 Copywriting Contract, and NEW pins land for the blackjack odds effect
// (single cancellation owner, mode gate, dependency tail — D-02/D-07/CR-01) and D-10's
// no-key/field-sharing rule between the two games' store pairs.

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

describe('App.tsx (shell) + ui/HoldemGame.tsx — single cancellation owner, no production gate reset (D-07, D-08)', () => {
  const source = readSource('App.tsx');
  const commentsStripped = stripCommentLines(source);
  // D-07 (06-02): the odds effect — and with it the cancellation cleanup, the mode gate and
  // the dependency array — MOVED verbatim from App.tsx into ui/HoldemGame.tsx. The assertions
  // below were retargeted at their new home in the same commit, not weakened.
  const holdemGameSource = readSource('ui/HoldemGame.tsx');
  const holdemGameCommentsStripped = stripCommentLines(holdemGameSource);

  it('ui/HoldemGame.tsx contains exactly one cancelSimulation( call site, outside of comments', () => {
    // Comment-stripped BEFORE counting (see stripCommentLines doc comment above) — this
    // function's own file-level comments are free to describe cancelSimulation( in prose
    // without flipping this count.
    const occurrences = holdemGameCommentsStripped.split('cancelSimulation(').length - 1;
    expect(
      occurrences,
      'ui/HoldemGame.tsx must contain exactly ONE cancelSimulation( call — the effect-cleanup ' +
        'call site is D-07\'s entire cancellation mechanism for a mode switch; a second call ' +
        'site would mean a competing/duplicate cancellation path was added. This assertion ' +
        'MOVED here from App.tsx because the Hold\'em odds effect moved with the D-07 ' +
        'extraction — it was retargeted, not weakened',
    ).toBe(1);
  });

  it('App.tsx contains zero cancelSimulation( call sites, outside of comments', () => {
    // ADDED with the D-07 extraction (06-02): the shell owns NO cancellation — the single
    // cancelSimulation( call site lives in ui/HoldemGame.tsx's effect cleanup. A call site
    // reappearing in App.tsx would mean a competing cancellation path crept back into the
    // cross-game shell.
    const occurrences = commentsStripped.split('cancelSimulation(').length - 1;
    expect(
      occurrences,
      'App.tsx must contain ZERO cancelSimulation( calls — after the D-07 extraction the shell ' +
        'owns no game state and no cancellation; the single sanctioned call site is ' +
        'ui/HoldemGame.tsx\'s effect cleanup',
    ).toBe(0);
  });

  it.each([
    'App.tsx',
    'ui/HoldemGame.tsx',
    'state/gameModeStore.ts',
    'ui/GameModeSwitcher.tsx',
    // RETARGETED (06-07, D-13): ui/BlackjackScene.tsx was retired with the placeholder; the
    // real Blackjack tree and both blackjack stores inherit its slot in this sweep — the
    // prohibition applies to every production file that could be tempted to "drain" the gate.
    'ui/BlackjackGame.tsx',
    'ui/BlackjackTable.tsx',
    'ui/BlackjackControls.tsx',
    'state/blackjackStore.ts',
    'state/blackjackOddsStore.ts',
  ])(
    '%s contains zero occurrences of resetAnimations',
    (relativePath) => {
      const target = relativePath === 'App.tsx' ? source : readSource(relativePath);
      expect(
        target,
        `${relativePath} must never call resetAnimations — gate-drain on a mode switch happens ` +
          'ONLY via the existing useAnimationGate/useExitGate unmount-cleanup paths (D-07, D-08; ' +
          'ui/HoldemGame.tsx joined this list with the D-07 extraction, the blackjack files with ' +
          'the 06-07 placeholder retirement, D-13); uiStore.resetAnimations is TEST-ONLY and ' +
          'must never appear in production code',
      ).not.toContain('resetAnimations');
    },
  );

  it('the odds effect is mode-scoped: an early return on non-holdem mode exists', () => {
    expect(
      holdemGameSource,
      'ui/HoldemGame.tsx must contain the literal guard `if (mode !== \'holdem\') return;` as ' +
        'the odds effect\'s FIRST check — without it, a live run could start or an odds cache ' +
        'key could be written while Blackjack is on screen (D-05). This assertion MOVED here ' +
        'from App.tsx because the Hold\'em odds effect moved with the D-07 extraction — it was ' +
        'retargeted, not weakened',
    ).toContain("if (mode !== 'holdem') return;");
  });

  it('the odds effect\'s dependency array includes mode as a real trigger', () => {
    expect(
      holdemGameSource,
      'ui/HoldemGame.tsx\'s odds effect dependency array must end with ' +
        '`pendingAnimationCount, mode]` — the early-return guard alone is not enough: `mode` ' +
        'must also be a dependency, or switching modes would not re-run the effect and tear ' +
        'down the previous run (D-05). This assertion MOVED here from App.tsx because the ' +
        'Hold\'em odds effect moved with the D-07 extraction — it was retargeted, not weakened',
    ).toContain('pendingAnimationCount, mode]');
  });
});

describe('No deckCount anywhere in the cross-game shell or the Hold\'em game root (D-10, WR-02, WR-03)', () => {
  // RETARGETED (06-07, D-13): ui/BlackjackScene.tsx was retired, and its successors
  // (BlackjackGame/BlackjackControls, blackjackStore) legitimately OWN the blackjack-local
  // deckCount wire-through (D-10, BJ-07) — so its slot in this sweep passes to
  // ui/HoldemGame.tsx instead: the Hold'em game root must never grow a deckCount wire until
  // Phase 7's duplicate-aware evaluator exists (WR-03), and the cross-game shell files stay
  // deckCount-free forever (the blackjack deck count lives in blackjackStore, D-10).
  const files = ['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx', 'ui/HoldemGame.tsx'];

  it.each(files)('%s contains zero occurrences of deckCount', (relativePath) => {
    expect(
      readSource(relativePath),
      `${relativePath} must never mention deckCount — the blackjack-local deck count lives in ` +
        'blackjackStore (D-10), and nothing may pass deckCount: 2 into the Hold\'em trial path ' +
        'before Phase 7\'s duplicate-aware evaluator exists (WR-02, WR-03)',
    ).not.toContain('deckCount');
  });
});

describe('Blackjack UI reads no Hold\'em-owned store (D-05, retargeted D-03 -> D-13)', () => {
  // RETARGETED (06-07): this block was `BlackjackScene.tsx — honest, control-free placeholder
  // (D-03, D-05)`. The `<button` prohibition encoded D-03 ("the placeholder has no controls"),
  // which D-13 supersedes BY DESIGN — the real table HAS controls (Deal/Hit/Stand, the deck
  // toggle, the hole reveal), so that half is retired here and retargeted behaviourally:
  // App.modeSwitch.test.tsx now pins the scene subtree's exact control census (exactly one
  // button, the hole reveal). The D-05 half SURVIVES, retargeted at the real Blackjack tree:
  // no Hold'em-owned store may ever be read from a blackjack component.
  const blackjackUiFiles = ['ui/BlackjackGame.tsx', 'ui/BlackjackTable.tsx', 'ui/BlackjackControls.tsx'];

  it.each(
    blackjackUiFiles.flatMap((file) => ['gameStore', 'oddsStore', 'pickerStore'].map((token) => [file, token] as const)),
  )('%s contains no occurrence of %s', (relativePath, token) => {
    expect(
      readSource(relativePath),
      `${relativePath} must never contain "${token}" — D-05 requires the Blackjack tree to read ` +
        'no Hold\'em-owned store (retargeted from the retired BlackjackScene placeholder to the ' +
        'real Phase 6 components, D-13); the blackjack odds live in blackjackOddsStore (D-10)',
    ).not.toContain(token);
  });

  it('ui/BlackjackControls.tsx contains no occurrence of uiStore', () => {
    // The shared animation-gate store is the one store the OLD prohibition list carried that
    // the real tree partially inherits: BlackjackGame and BlackjackTable legitimately read it
    // (the gate is cross-game by design, D-11/TBL-04), but the controls must NOT — the gate
    // is armed by blackjackStore's own actions in the same tick as their set() (D-13), never
    // from a control's click handler (06-07 Task 1's read-only-blackjackStore contract).
    expect(
      readSource('ui/BlackjackControls.tsx'),
      'ui/BlackjackControls.tsx must never contain "uiStore" — controls read only ' +
        'useBlackjackStore (D-10); gate arming belongs to the store actions (D-13)',
    ).not.toContain('uiStore');
  });
});

describe('ui/BlackjackGame.tsx — single cancellation owner, gate order, sole-reader conditioning (D-02, D-07, 05-REVIEW CR-01)', () => {
  const source = readSource('ui/BlackjackGame.tsx');
  const commentsStripped = stripCommentLines(source);

  it('contains exactly one cancelBlackjackSimulation( call site, outside of comments', () => {
    // Comment-stripped BEFORE counting (see stripCommentLines doc comment above) — the
    // component's own comments are free to describe the cancellation path in prose without
    // flipping this count.
    const occurrences = commentsStripped.split('cancelBlackjackSimulation(').length - 1;
    expect(
      occurrences,
      'ui/BlackjackGame.tsx must contain exactly ONE cancelBlackjackSimulation( call — the ' +
        'odds effect\'s cleanup is D-07\'s entire cancellation mechanism for a mode switch; a ' +
        'second call site would mean a competing/duplicate cancellation path was added ' +
        '(the mirror of ui/HoldemGame.tsx\'s cancelSimulation( pin above)',
    ).toBe(1);
  });

  it('contains exactly one startBlackjackSimulation( call site, outside of comments', () => {
    const occurrences = commentsStripped.split('startBlackjackSimulation(').length - 1;
    expect(
      occurrences,
      'ui/BlackjackGame.tsx must contain exactly ONE startBlackjackSimulation( call — the ' +
        'gated odds effect is the sole launch point for blackjack runs (D-07); a second call ' +
        'site would bypass the mode/animation/roundPhase/cache gate order',
    ).toBe(1);
  });

  it('the odds effect is mode-scoped: an early return on non-blackjack mode exists', () => {
    expect(
      source,
      'ui/BlackjackGame.tsx must contain the literal guard `if (mode !== \'blackjack\') ' +
        'return;` as the odds effect\'s FIRST check — without it, a live run could start or a ' +
        'blackjack cache key could be written while Hold\'em is on screen (D-07, the mirror of ' +
        'HoldemGame\'s D-05 mode gate)',
    ).toContain("if (mode !== 'blackjack') return;");
  });

  it('the odds effect\'s dependency array includes mode as a real trigger', () => {
    expect(
      source,
      'ui/BlackjackGame.tsx\'s odds effect dependency array must end with ' +
        '`pendingAnimationCount, mode]` — the early-return guard alone is not enough: `mode` ' +
        'must also be a dependency, or switching modes would not re-run the effect and tear ' +
        'down the previous run, and `pendingAnimationCount` must stay subscribed or the ' +
        'CR-01 animation gate could deadlock (D-07, 05-REVIEW CR-01, T-06-36)',
    ).toContain('pendingAnimationCount, mode]');
  });

  it('never references the raw hole-card field (D-02 sole-reader rule)', () => {
    // Raw source, comments included: the token must not exist ANYWHERE in that file — the
    // predetermined hole card reaches the worker only through the engine's sole
    // conditioning reader, never through a raw round slice (D-02, T-06-35). This guard
    // reads OTHER files' source, never its own (see the file header), so naming the
    // forbidden token here cannot self-invalidate.
    expect(
      source,
      'ui/BlackjackGame.tsx must never contain "dealerHole" — the only sanctioned reader of ' +
        'the predetermined round for odds input is deriveBlackjackConditionedState (D-02, ' +
        'T-06-35)',
    ).not.toContain('dealerHole');
  });

  it('derives its conditioned state through the sole reader', () => {
    expect(
      source,
      'ui/BlackjackGame.tsx must call deriveBlackjackConditionedState( — the odds effect\'s ' +
        'worker payload comes from the engine\'s sole conditioning reader (D-02)',
    ).toContain('deriveBlackjackConditionedState(');
  });
});

describe('blackjack stores share no key/field vocabulary with the Hold\'em stores (D-10)', () => {
  // D-10's "NO key/field sharing" rule made enforceable rather than advisory: the blackjack
  // store pair must never mention the poker stores\' knowledge dimensions (street /
  // revealedMask), the poker cache\'s key function name, or the Hold\'em store modules
  // themselves. Raw-source checks (comments included) — a comment normalising the shared
  // vocabulary would be the first symptom of the drift this pin exists to catch.
  const storeFiles = ['state/blackjackStore.ts', 'state/blackjackOddsStore.ts'];

  it.each(
    storeFiles.flatMap((file) =>
      ['street', 'revealedMask', 'knowledgeKey', 'gameStore', 'pickerStore'].map(
        (token) => [file, token] as const,
      ),
    ),
  )('%s contains no occurrence of %s', (relativePath, token) => {
    expect(
      readSource(relativePath),
      `${relativePath} must never contain "${token}" — D-10 forbids any key or field sharing ` +
        'between the two games\' store pairs; blackjack keys on (playerHandLength, ' +
        'revealedHole) via its OWN blackjackKnowledgeKey (Pitfall 11: Phase 6 got its own ' +
        'store instead of widening the poker one)',
    ).not.toContain(token);
  });
});

describe('Locked copy and labels stay verbatim (D-01, D-13, D-14, 06-UI-SPEC Copywriting Contract)', () => {
  // RETARGETED (06-07, D-03 -> D-13): the Phase 5 placeholder copy pins moved with the
  // placeholder's retirement — they now pin the Phase 6 Copywriting Contract's locked
  // strings (the A10 idle block, the A14 error banner, the eight-path outcome-banner
  // headings, the D-05 Hit-tile sub-copy and the dealer-table caption) instead of the
  // retired "The Blackjack table deals next" copy. Same technique, same bar: a reword must
  // go through the UI-SPEC, never silently drift in code.
  const BLACKJACK_IDLE_HEADING = 'No round dealt yet';
  const BLACKJACK_IDLE_BODY =
    'Click Deal to start a round. Switch the shoe between 1 and 2 decks to see the odds shift.';
  const BLACKJACK_ERROR_COPY =
    'The simulation hit an unexpected error and stopped updating. Deal a new round to try again.';
  const OUTCOME_HEADINGS = ['You win', 'Dealer wins', 'Push', 'Blackjack — you win', 'Dealer blackjack'];
  const HIT_TILE_SUBCOPY = 'hit once, then stand';
  const DEALER_TABLE_CAPTION = "Dealer's final hand";
  const HOLDEM_LABEL = "Hold'em";
  const BLACKJACK_LABEL = 'Blackjack';
  const SWITCHER_TESTIDS = ['game-mode-switcher', 'game-mode-switch-holdem', 'game-mode-switch-blackjack'];

  it('BlackjackGame.tsx contains the locked idle heading, idle body and error copy verbatim', () => {
    const source = readSource('ui/BlackjackGame.tsx');
    expect(
      source,
      'the 06-UI-SPEC Copywriting Contract locks the A10 idle heading string — a reword must ' +
        'go through the UI-SPEC, not silently drift in code (D-13, D-14)',
    ).toContain(BLACKJACK_IDLE_HEADING);
    // Whitespace-normalized (see normalizeWhitespace doc comment above): the JSX source wraps
    // these long strings across lines with indentation, which is invisible in the RENDERED
    // text (JSX collapses whitespace) but would break a raw substring match against the
    // single-line locked-copy constants.
    expect(
      normalizeWhitespace(source),
      'the 06-UI-SPEC Copywriting Contract locks the A10 idle body string verbatim, including ' +
        'the "Switch the shoe" sentence — a reword must go through the UI-SPEC (D-13, D-14)',
    ).toContain(normalizeWhitespace(BLACKJACK_IDLE_BODY));
    expect(
      normalizeWhitespace(source),
      'the 06-UI-SPEC Copywriting Contract locks the A14 error-banner recovery copy verbatim ' +
        '("Deal a new round to try again.") — a reword must go through the UI-SPEC (D-14)',
    ).toContain(normalizeWhitespace(BLACKJACK_ERROR_COPY));
  });

  it.each(OUTCOME_HEADINGS)('BlackjackOutcomeBanner.tsx contains the locked outcome heading %s', (heading) => {
    // The eight outcome-banner rows share these five distinct heading strings (06-UI-SPEC
    // outcome-banner copy table) — each is pinned verbatim (D-13, D-14).
    expect(
      readSource('ui/BlackjackOutcomeBanner.tsx'),
      `the 06-UI-SPEC outcome-banner copy table locks the heading "${heading}" verbatim — a ` +
        'reword must go through the UI-SPEC (D-13, D-14)',
    ).toContain(heading);
  });

  it('BustEvDisplay.tsx contains the locked Hit-tile sub-copy verbatim', () => {
    expect(
      readSource('ui/BustEvDisplay.tsx'),
      'D-05 locks "hit once, then stand" as ALWAYS-visible DOM text — the Hit EV is a ' +
        'single-draw EV, not an optimal-continuation EV, and presenting the number without ' +
        'its basis invites a false comparison against basic-strategy calculators',
    ).toContain(HIT_TILE_SUBCOPY);
  });

  it('DealerDistributionDisplay.tsx contains the locked dealer-table caption verbatim', () => {
    expect(
      readSource('ui/DealerDistributionDisplay.tsx'),
      'the 06-UI-SPEC Copywriting Contract locks the dealer-table caption "Dealer\'s final ' +
        'hand" verbatim (D-13, D-14)',
    ).toContain(DEALER_TABLE_CAPTION);
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
