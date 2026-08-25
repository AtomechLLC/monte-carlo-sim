// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
//   - The cross-game shell (App.tsx, gameModeStore.ts, GameModeSwitcher.tsx) stays
//     `deckCount`-free FOREVER — each game's deck count lives in its own game-local store
//     (D-10; Phase 7 D-14), and the only sanctioned Hold'em wire is ui/HoldemGame.tsx's deck
//     toggle (Phase 7 D-01; WR-03 retired by D-12).
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
//
// AMENDED 2026-08-25 (Phase 7 plan 07-05, D-01/D-12): ui/HoldemGame.tsx left the deckCount-zero
// sweep in the SAME COMMIT that added the Hold'em-local deck toggle — the duplicate-aware
// evaluator now ships, so WR-03 (which kept the 2-deck trial path off-limits) is RETIRED and
// the game root legitimately owns the toggle wire (D-01), its deck count living in gameStore
// (D-14, the D-10 store-locality precedent). The three cross-game shell files keep the sweep
// forever; the assertion was retargeted, never deleted or weakened.
//
// AMENDED 2026-08-25 (Phase 8 plan 08-01, D-01/D-02/D-07): the two inline deck toggles were
// EXTRACTED into ONE shared, props-driven component — ui/DeckCountToggle.tsx (SC1) — rendered
// by both BlackjackControls and HoldemGame. Only the segmented MARKUP moved: each game's
// deck-count WIRE (the store read, setDeckCount, the guard predicate and the title
// computation) stayed in its own file, so the deckCount-zero sweep's prose remains true and
// its file list is unchanged. Every Phase 8 pin is ADDITIVE per this file's standing rule:
// ui/DeckCountToggle.tsx joined the resetAnimations sweep on creation, gained its own
// store-free sweep and locked-label pins, and both call sites gained SC1 source-identity
// pins (import/render presence, inline-markup absence, single-source-of-markup sweep).
// Nothing was deleted, relaxed or retargeted.

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
    // ADDED (Phase 8 plan 08-01, D-01): the shared deck toggle joined this list on creation,
    // exactly as ui/HoldemGame.tsx did in 06-02 and the blackjack files did in 06-07 — the
    // prohibition covers every production file that could be tempted to "drain" the gate.
    'ui/DeckCountToggle.tsx',
  ])(
    '%s contains zero occurrences of resetAnimations',
    (relativePath) => {
      const target = relativePath === 'App.tsx' ? source : readSource(relativePath);
      expect(
        target,
        `${relativePath} must never call resetAnimations — gate-drain on a mode switch happens ` +
          'ONLY via the existing useAnimationGate/useExitGate unmount-cleanup paths (D-07, D-08; ' +
          'ui/HoldemGame.tsx joined this list with the D-07 extraction, the blackjack files with ' +
          'the 06-07 placeholder retirement, D-13, and ui/DeckCountToggle.tsx on its creation, ' +
          'Phase 8 D-01); uiStore.resetAnimations is TEST-ONLY and ' +
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

describe('No deckCount anywhere in the cross-game shell (D-10, D-14 — WR-03 retired, D-12)', () => {
  // RETARGETED (07-05, D-01/D-12): ui/HoldemGame.tsx left this sweep in the SAME COMMIT that
  // added the Hold'em-local deck toggle — Phase 7's duplicate-aware evaluator ships, so WR-03
  // is retired (D-12) and the game root legitimately owns the toggle wire (D-01). What
  // survives forever is the cross-game shell's deckCount-freedom: Hold'em's deck count lives
  // in gameStore (D-14) and the blackjack deck count in blackjackStore (D-10), so no shell
  // file ever carries a deck-count field, prop or read — mode plumbing and deck plumbing stay
  // permanently disjoint.
  //
  // Phase 8 note (plan 08-01, D-01 — comment-only, the file list is deliberately UNCHANGED):
  // the extraction moved the segmented MARKUP into ui/DeckCountToggle.tsx, but the deck-count
  // WIRE (store read + setDeckCount) stayed in each game's own file, so this sweep's prose
  // remains true. ui/DeckCountToggle.tsx must NOT be added here: it necessarily carries
  // deckCount as a prop — it is game-parameterized UI, not shell — and this sweep pins the
  // three cross-game SHELL files forever.
  const files = ['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx'];

  it.each(files)('%s contains zero occurrences of deckCount', (relativePath) => {
    expect(
      readSource(relativePath),
      `${relativePath} must never mention deckCount — the cross-game shell stays deckCount-free ` +
        'forever: each game\'s deck count lives in its own game-local store (blackjackStore per ' +
        'D-10, gameStore per Phase 7 D-14), and the only sanctioned Hold\'em wire is ' +
        'ui/HoldemGame.tsx\'s deck toggle (D-01, plan 07-05 — WR-03 retired by D-12 now that ' +
        'the duplicate-aware evaluator ships)',
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

describe('ui/DeckCountToggle.tsx — store-free by construction, locked labels verbatim (Phase 8 D-01, D-02, D-06)', () => {
  // ADDED (Phase 8 plan 08-01, D-01): the shared toggle is props-driven BY CONSTRUCTION — no
  // store read, no owned state, no gate arming; every per-game difference arrives via props
  // from the call sites. This sweep makes that construction rule enforceable. Raw source,
  // comments included (the D-10 disjointness technique above): a comment normalising the
  // shared store vocabulary inside the component would be the first symptom of the drift
  // this pin exists to catch.
  const toggleSource = readSource('ui/DeckCountToggle.tsx');

  it.each([
    'gameStore',
    'oddsStore',
    'pickerStore',
    'uiStore',
    'blackjackStore',
    'gameModeStore',
    'zustand',
  ])('contains zero occurrences of %s, comments included', (token) => {
    expect(
      toggleSource,
      `ui/DeckCountToggle.tsx must never contain "${token}" — Phase 8 D-01 makes the shared ` +
        'control props-driven by construction: both games\' deck counts stay in their own ' +
        'game-local stores (D-10, D-14) and reach the component only as props from the call ' +
        'sites. NOTE (08-REVIEW WR-02): this enumerated list is no longer the only line of ' +
        'defence — it cannot be out-enumerated any more, because the path-level pin below ' +
        'catches every src/state import regardless of the store\'s name',
    ).not.toContain(token);
  });

  // ADDED (08-REVIEW WR-02). The seven-token list above is an ENUMERATION, and substring
  // matching is case-sensitive, so it had a demonstrable hole: `blackjackOddsStore` — a real
  // store in this repo — matches none of the seven ('oddsStore' !== 'OddsStore', and
  // 'blackjackStore' is not a substring of 'blackjackOddsStore'). A future phase reaching for
  // `useBlackjackOddsStore((s) => s.trialsCompleted)` to dim the control mid-run would make it
  // both store-coupled and game-aware — the exact D-01 violation this describe block exists to
  // prevent — while passing all seven assertions, the SC1 pins, the DOM golden and tsc/eslint.
  // The two pins below cannot be out-enumerated: one keys on the import PATH, the other on the
  // game names themselves. Both pass against the shipped component (its only import is
  // '../engine/shoe' and it names neither game). The token list is kept as-is above: it is
  // additive, and it still catches an aliased re-export that never spells '../state/'.
  it('imports nothing from src/state — no store, named or renamed, can reach the shared control (D-01)', () => {
    expect(
      toggleSource,
      'ui/DeckCountToggle.tsx must contain no "../state/" path — D-01 makes the shared control ' +
        'props-driven BY CONSTRUCTION, and a path-level pin is the only form of that rule an ' +
        'enumerated store-name list cannot be smuggled past (08-REVIEW WR-02: blackjackOddsStore ' +
        'passes all seven name tokens)',
    ).not.toContain('../state/');
  });

  it.each(['blackjack', 'holdem'])(
    'contains no reference to %s in any casing — the component holds no game-specific logic (08-UI-SPEC Prop Contract)',
    (game) => {
      // The 08-UI-SPEC Prop Contract's second binding constraint ("The component contains no
      // game-specific logic") had NO pin at all before this: a
      // `testidPrefix === 'blackjack-deck-toggle' ? … : …` branch inside the component would
      // violate the spec and trip nothing. Case-insensitive, so it also catches the
      // capitalised store/component spellings the seven-token sweep above misses.
      expect(
        toggleSource.toLowerCase(),
        `ui/DeckCountToggle.tsx must never mention "${game}" in any casing — every behavioural ` +
          'difference between the two instances arrives via props from the call site ' +
          '(08-UI-SPEC Prop Contract, D-01). The contractual testid prefixes deliberately live ' +
          'at the CALL SITES, never inside the component that renders them',
      ).not.toContain(game);
    },
  );

  it.each(['1 deck', '2 decks', 'Deck count'])(
    'contains the locked string %s verbatim',
    (locked) => {
      // ADDED (Phase 8 plan 08-01): mirrors the GameModeSwitcher locked-label pins below.
      // The testid-pin technique deliberately does NOT transfer to this component — after
      // the extraction the literal prefixes live at the two CALL SITES (see the SC1 block).
      expect(
        toggleSource,
        `the 08-UI-SPEC Copywriting Contract locks "${locked}" verbatim on the shared toggle ` +
          '— a reword must go through the UI-SPEC, never silently drift in code (D-06)',
      ).toContain(locked);
    },
  );
});

describe('SC1 — the deck-count markup lives in exactly ONE shared component, rendered at both call sites (Phase 8 D-01, D-02, 08-UI-SPEC A3)', () => {
  // ADDED (Phase 8 plan 08-01): the source-level half of ROADMAP SC1's verification. The
  // comment-stripped pins prove both games import AND render the shared module; the raw
  // absence pins prove no inline segmented markup survives at either call site. The two
  // absence markers below are the only clean ones: `1 deck` survives in BlackjackControls'
  // WR-01 essay, and stripCommentLines only strips lines beginning with // or *, never JSX
  // comment blocks. (`aria-pressed` used to survive in HoldemGame's JSX rationale comment as
  // well; 08-REVIEW IN-01 trimmed that prose back to call-site concerns, so that particular
  // collision is gone — but the marker choice stands on its own and is left unchanged.)
  const callSites = ['ui/BlackjackControls.tsx', 'ui/HoldemGame.tsx'];

  it.each(callSites)('%s imports the shared component module, outside of comments', (relativePath) => {
    expect(
      stripCommentLines(readSource(relativePath)),
      `${relativePath} must import ui/DeckCountToggle.tsx — SC1 requires both games to render ` +
        'the ONE shared component (Phase 8 D-01)',
    ).toContain("from './DeckCountToggle'");
  });

  it.each(callSites)('%s renders the shared component, outside of comments', (relativePath) => {
    expect(
      stripCommentLines(readSource(relativePath)),
      `${relativePath} must render <DeckCountToggle — SC1 requires the shared component at ` +
        'both call sites, never a re-inlined copy (Phase 8 D-01)',
    ).toContain('<DeckCountToggle');
  });

  it.each(callSites)('%s retains zero group-role markup, in any quoting style', (relativePath) => {
    // STRENGTHENED (08-REVIEW WR-03 item 3): was `.not.toContain('role="group"')`, which
    // only saw the double-quoted form — role='group' and role={'group'} walked straight
    // past it. The regex covers every JSX quoting style; role="alert" and the other roles
    // these files legitimately carry are unaffected because it anchors on the value.
    expect(
      readSource(relativePath),
      `${relativePath} must not contain a role="group" attribute in ANY quoting style, comments ` +
        'included — the inline segmented markup was extracted (Phase 8 D-01, 08-UI-SPEC A3); ' +
        'its reappearance would mean SC1\'s single-source claim regressed',
    ).not.toMatch(/role\s*=\s*[{("'`]*group/);
  });

  it.each(callSites)('%s retains zero occurrences of the group label, in any form', (relativePath) => {
    // STRENGTHENED (08-REVIEW WR-03 item 3): was `.not.toContain('aria-label="Deck count"')`.
    // Pinning the BARE label literal is quoting-agnostic and additionally catches the hoisted
    // -constant evasion (`const GROUP_LABEL = 'Deck count'` + aria-label={GROUP_LABEL}), which
    // the attribute-shaped pin could not see. Neither call site contains the string today.
    expect(
      readSource(relativePath),
      `${relativePath} must not contain the group label "Deck count" anywhere, in any quoting ` +
        'style and comments included — the wrapper markup and its label live only in ' +
        'ui/DeckCountToggle.tsx (Phase 8 D-01, 08-UI-SPEC A3)',
    ).not.toContain('Deck count');
  });

  it('each call site keeps its own locked testid prefix, and the component builds the segment testids from the prefix (D-02)', () => {
    // The prefixes are CONTRACTUAL and unchanged (D-02): they arrive as a prop, so the
    // literal strings live at the call sites and the segment testids are constructed inside
    // the shared component.
    expect(
      readSource('ui/BlackjackControls.tsx'),
      'the contractual prefix "blackjack-deck-toggle" must stay at the blackjack call site (D-02)',
    ).toContain('blackjack-deck-toggle');
    expect(
      readSource('ui/HoldemGame.tsx'),
      'the contractual prefix "holdem-deck-toggle" must stay at the Hold\'em call site (D-02)',
    ).toContain('holdem-deck-toggle');
    const toggleSource = readSource('ui/DeckCountToggle.tsx');
    expect(
      toggleSource,
      'ui/DeckCountToggle.tsx must build the first segment\'s testid as `${testidPrefix}-1` (D-02)',
    ).toContain('${testidPrefix}-1');
    expect(
      toggleSource,
      'ui/DeckCountToggle.tsx must build the second segment\'s testid as `${testidPrefix}-2` (D-02)',
    ).toContain('${testidPrefix}-2');
  });

  it.each(['blackjack-deck-toggle', 'holdem-deck-toggle'])(
    'ui/deckTogglePrefix.ts still admits the contractual prefix %s (D-02)',
    (prefix) => {
      // ADDED (08-REVIEW IN-03): the prefix prop is typed as a two-value union instead of a
      // bare string, so a typo fails at the boundary where D-02 is stated rather than as a
      // downstream "unable to find an element by data-testid". The union lives in its own
      // module because ui/DeckCountToggle.tsx is pinned above to name neither game — see that
      // module's header. This pin keeps the union's MEMBERS contractual: narrowing or
      // renaming one silently would break the isolation sweeps and both testid registries.
      expect(
        readSource('ui/deckTogglePrefix.ts'),
        `ui/deckTogglePrefix.ts must keep "${prefix}" in the DeckTogglePrefix union — D-02 ` +
          'makes exactly these two prefixes contractual, and the union is what type-checks ' +
          'them at the shared control\'s prop boundary',
      ).toContain(prefix);
    },
  );

  it('exactly ONE production .tsx file in ALL of src/ contains the deck-count group markup — and it is ui/DeckCountToggle.tsx', () => {
    // WIDENED (08-REVIEW WR-03). This sweep previously read a FLAT, non-test listing of
    // src/ui only, which pinned SC1's "the markup lives in exactly ONE component" claim three
    // sizes too small:
    //   1. Directory scope — src/App.tsx is a .tsx component OUTSIDE src/ui, so re-inlining
    //      the group markup there left all 11 SC1 assertions green.
    //   2. { recursive: false } — the first src/ui/blackjack/ or src/ui/shared/ directory
    //      would have silently dropped its files out of the sweep's view.
    //   3. Literal quoting — keying on the double-quoted form let role='group' /
    //      aria-label={'Deck count'} / a hoisted `const GROUP_LABEL = 'Deck count'` evade it.
    //
    // One change subsumes all three, reusing the complete, already-proven in-repo pattern from
    // the sibling guard src/engine/shoePath.guard.test.ts (productionSourceFiles): walk src/
    // with { recursive: true } and normalize Windows separators. Matching on the BARE literal
    // `Deck count` rather than on an aria-label= form is deliberately STRONGER than the
    // previous pin — it is quoting-agnostic and it also catches the hoisted-constant evasion,
    // where the label never appears next to the attribute at all.
    //
    // The `.test.` exclusion stays, and stays LOAD-BEARING — it is exercised by two real
    // files, not merely asserted: src/ui/DeckCountToggle.test.tsx deliberately contains the
    // literal markup string (see its own comment on the wrapper case) and
    // src/App.deckToggleDom.golden.test.tsx carries it inside all nine frozen constants.
    // Still deliberately NOT swept on `1 deck` / `2 decks`: ui/BlackjackGame.tsx's locked idle
    // copy contains "2 decks" and BlackjackControls' surviving WR-01 essay contains "1 deck".
    // { recursive: true } also satisfies the narrow node-builtins.d.ts shim (IMP-02), which
    // types readdirSync with a REQUIRED options argument.
    const productionTsxFiles = readdirSync(SRC_DIR, { recursive: true })
      .map((entry) => String(entry).replaceAll('\\', '/'))
      .filter((relativePath) => relativePath.endsWith('.tsx') && !relativePath.includes('.test.'));

    const emitters = productionTsxFiles.filter((relativePath) =>
      readSource(relativePath).includes('Deck count'),
    );

    expect(
      emitters,
      'exactly ONE production .tsx file under src/ may contain the deck-count group markup — ' +
        'SC1\'s single-source-of-markup rule (Phase 8 D-01, 08-UI-SPEC A3). A second entry ' +
        'means the markup was re-inlined somewhere: App.tsx and every src/ui subdirectory are ' +
        'now in scope, whatever quoting style the copy is written in',
    ).toEqual(['ui/DeckCountToggle.tsx']);

    // Falsifiability control for the sweep itself: a green result above must not be reachable
    // from an empty or still-ui-only listing. App.tsx's invisibility to the old flat src/ui
    // read was the WR-03 hole, so its presence here is what proves the walk actually widened.
    expect(
      productionTsxFiles,
      'the sweep must see src/App.tsx — a .tsx component outside src/ui, invisible to the flat ' +
        'src/ui listing this pin replaced (08-REVIEW WR-03)',
    ).toContain('App.tsx');

    // The single emitter must still carry the markup in the exact double-quoted JSX form the
    // nine-state DOM golden serializes. The sweep above is quoting-agnostic BY DESIGN (that is
    // what closes evasion 3), so the canonical form needs its own pin rather than riding along.
    expect(
      readSource('ui/DeckCountToggle.tsx'),
      'ui/DeckCountToggle.tsx must carry the group markup as aria-label="Deck count" — the ' +
        'exact form the nine-state DOM golden freezes (08-UI-SPEC A2)',
    ).toContain('aria-label="Deck count"');
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

describe('App.css — Phase 7 styles are selector-list extensions of the shared rules, never duplicated blocks (D-11, 07-05)', () => {
  // What this block protects: the D-11 isolation contract requires blackjack's computed styles
  // to be PROVABLY unchanged by Phase 7. A duplicated rule block (a second copy of the
  // segmented-control or disabled-dimming declarations carrying only holdem selectors) would
  // pass every behavioral test while silently letting the two games' appearance diverge on the
  // next edit — so each shared rule is pinned at source level to contain BOTH games' selectors
  // in ONE selector list. Same readSource technique as every other pin in this file: it reads
  // App.css's source text, never its own.
  const cssSource = readSource('App.css');
  // Each chunk produced by splitting on `}` carries exactly one rule's selector prelude (plus
  // any preceding comments) and its declarations — two selectors landing in the SAME chunk
  // therefore share one rule, which is what "extension, not duplication" means at source level.
  const ruleChunks = cssSource.split('}');

  function theChunkWith(...tokens: string[]): string {
    const matches = ruleChunks.filter((chunk) => tokens.every((token) => chunk.includes(token)));
    expect(
      matches,
      `expected exactly one App.css rule containing all of: ${tokens.join(' + ')} — zero means ` +
        'the shared rule was removed; more than one means a duplicated rule block appeared (D-11)',
    ).toHaveLength(1);
    return matches[0];
  }

  it('the segmented-control wrapper rule carries both deck toggles in one selector list', () => {
    const chunk = theChunkWith("[data-testid='blackjack-deck-toggle']", 'display: inline-flex');
    expect(
      chunk,
      "the wrapper rule must gain [data-testid='holdem-deck-toggle'] as a selector-list " +
        'extension of the SHARED rule — a second holdem-only rule block would violate D-11',
    ).toContain("[data-testid='holdem-deck-toggle']");
  });

  it('the segment sizing/typography rule carries both deck toggles in one selector list', () => {
    const chunk = theChunkWith("[data-testid^='blackjack-deck-toggle-']", 'min-width: 44px');
    expect(
      chunk,
      "the segment sizing rule must gain [data-testid^='holdem-deck-toggle-'] as a " +
        'selector-list extension of the SHARED rule (D-11)',
    ).toContain("[data-testid^='holdem-deck-toggle-']");
  });

  it('the internal-divider rule carries both first segments in one selector list', () => {
    const chunk = theChunkWith("[data-testid='blackjack-deck-toggle-1']", 'border-right');
    expect(
      chunk,
      "the internal-divider rule must gain [data-testid='holdem-deck-toggle-1'] as a " +
        'selector-list extension of the SHARED rule (D-11)',
    ).toContain("[data-testid='holdem-deck-toggle-1']");
  });

  it('the active-segment rule carries both deck toggles in one selector list', () => {
    const chunk = theChunkWith("[data-testid^='blackjack-deck-toggle-'][aria-pressed='true']");
    expect(
      chunk,
      "the active-segment rule must gain [data-testid^='holdem-deck-toggle-'][aria-pressed='true'] " +
        'as a selector-list extension of the SHARED rule (D-11)',
    ).toContain("[data-testid^='holdem-deck-toggle-'][aria-pressed='true']");
  });

  it('the disabled-dimming list carries the A4 guard segment alongside the blackjack one', () => {
    const chunk = theChunkWith("[data-testid='blackjack-deck-toggle-1']:disabled");
    expect(
      chunk,
      "the shipped disabled-dimming selector list must gain [data-testid='holdem-deck-toggle-1']" +
        ':disabled (UI-SPEC A4) — in the SAME rule as the blackjack guard segment, never a ' +
        'duplicated dimming block (D-11)',
    ).toContain("[data-testid='holdem-deck-toggle-1']:disabled");
  });

  it('the copy-cue block exists, uses only the felt/badge tokens, and touches no reserved colour', () => {
    expect(cssSource, 'plan 07-04 emitted .card-slot--cued as a binding class contract — 07-05 must style it').toContain(
      '.card-slot--cued {',
    );
    expect(cssSource, 'plan 07-04 emitted .copy-cue as a binding class contract — 07-05 must style it').toContain(
      '.copy-cue {',
    );
    const cueChunk = theChunkWith('.copy-cue {');
    expect(
      cueChunk,
      'the copy-cue badge must use the solid felt-dark token as its fill (UI-SPEC A6: the ' +
        'translucent seat-badge background composites below AA on a white card face)',
    ).toContain('var(--felt-dark)');
    expect(
      cueChunk,
      'the copy-cue badge must use the shipped seat-badge text token (A6) — no new colour token',
    ).toContain('var(--seat-badge-text)');
    expect(
      cueChunk,
      'the copy cue is a physical table fact, never an error state — the reserved accent ' +
        'colour role must not appear anywhere in its block (07-UI-SPEC Color: Phase 7 ' +
        'introduces ZERO accent usage)',
    ).not.toContain('--accent');
    expect(
      cueChunk,
      'the copy cue is a physical table fact, never an error state — the reserved destructive ' +
        'colour role must not appear anywhere in its block (07-UI-SPEC Color)',
    ).not.toContain('--destructive');
  });
});
