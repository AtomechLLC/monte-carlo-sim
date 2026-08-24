// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// DECK-01 source-shape guard (T-04-22, D-01, D-03): proves no value-based `Set<Card>`
// membership survives anywhere in the shoe path. A card VALUE is a COUNT in this codebase,
// never a boolean membership fact — the moment a future contributor reaches for
// `new Set(cards)` out of habit on one of the five files below, this test goes red. The one
// legitimate numeric Set (`VALID_BOARD_LENGTHS` in `simulationApi.ts`) is allowlisted by a
// line-level assertion, not a blanket exemption, so the allowance can't silently widen to
// cover a reintroduced card Set.
//
// This file also pins the D-07/D-10 untouchable artefacts (T-04-23): the exact property
// titles/assertions in `equity.property.test.ts` and `conditioning.test.ts`, and the exact
// frozen error strings in `simulationApi.test.ts` — so a later phase cannot quietly loosen
// them. The correct way to add a 2-deck invariant is a NEW sibling test, never an edit here
// (PITFALLS.md Pitfall 12).

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..');

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf8');
}

describe('DECK-01 shoe-path guard: no value-based Set<Card> dedup', () => {
  const noSetFiles = ['engine/shoe.ts', 'engine/conditioning.ts', 'state/pickerStore.ts', 'ui/CardPicker.tsx'];

  it.each(noSetFiles)('%s contains no Set<Card> and no new Set( occurrence', (relativePath) => {
    const source = readSource(relativePath);
    expect(
      source,
      `${relativePath} must never declare a Set<Card> — DECK-01 requires counts, not boolean membership`,
    ).not.toContain('Set<Card>');
    expect(
      source,
      `${relativePath} must never call new Set( — DECK-01 requires count-aware logic (Map<Card, number>), not value-based Set dedup`,
    ).not.toContain('new Set(');
  });

  it('simulationApi.ts contains no Set<Card>, and exactly one new Set( call, pinned to VALID_BOARD_LENGTHS', () => {
    const source = readSource('worker/simulationApi.ts');
    expect(source, 'worker/simulationApi.ts must never declare a Set<Card>').not.toContain('Set<Card>');

    const newSetOccurrences = source.split('new Set(').length - 1;
    expect(
      newSetOccurrences,
      'worker/simulationApi.ts must contain exactly one `new Set(` call — the single allowlisted VALID_BOARD_LENGTHS numeric Set. A second occurrence likely means a card Set crept back in.',
    ).toBe(1);

    const lineWithNewSet = source.split('\n').find((line) => line.includes('new Set('));
    expect(lineWithNewSet, 'the single new Set( call in worker/simulationApi.ts must be found on some line').toBeDefined();
    expect(
      lineWithNewSet,
      'the single new Set( call in worker/simulationApi.ts must sit on the VALID_BOARD_LENGTHS line — this pins the allowance to that specific numeric Set so it cannot silently become cover for a reintroduced card Set',
    ).toContain('VALID_BOARD_LENGTHS');
  });
});

describe('D-03/PITFALLS-12: cards.ts is the deliberately untouched single-deck baseline', () => {
  it('still exports FULL_DECK, deckWithout, and its new Set(excluded) body unchanged', () => {
    // cards.ts is intentionally frozen as the single-deck baseline that shoeWithout is
    // property-tested against (PITFALLS Pitfall 12, D-03) — its Set is correct code, not
    // debt, and FULL_DECK must never be redefined to be deck-count-parametric.
    const source = readSource('engine/cards.ts');
    expect(source).toContain('export const FULL_DECK: readonly Card[] = ALL_CARDS;');
    expect(source).toContain('export function deckWithout(');
    expect(source).toContain('new Set(excluded)');
  });
});

describe('D-07/D-10: untouchable v1 test artefacts stay byte-intact', () => {
  it('equity.property.test.ts still pins the exact "13 unique cards" property title and assertion', () => {
    // This is precisely the 1-deck invariant a 2-deck Hold'em hand is allowed to violate by
    // design (PITFALLS Pitfall 12) — the correct way to add a 2-deck-aware version is a new,
    // additive sibling property test, never an edit to this one.
    const source = readSource('engine/equity.property.test.ts');
    expect(source).toContain('(c) every trial produces exactly 13 unique cards regardless of known/unknown split');
    expect(source).toContain('expect(new Set(allCards).size).toBe(13);');
  });

  it('conditioning.test.ts still pins the exact 52-card reconstitution property title', () => {
    const source = readSource('engine/conditioning.test.ts');
    expect(source).toContain(
      'every (street, revealedMask) combination reconstitutes exactly the 52-card FULL_DECK with no duplicates',
    );
  });

  it('simulationApi.test.ts still pins the exact frozen overlap/length error strings', () => {
    // D-07: the entire simulationApi.test.ts suite passes UNCHANGED after the runner
    // extraction — this is roadmap success criterion 4 and is non-negotiable.
    const source = readSource('worker/simulationApi.test.ts');
    expect(source).toContain('remainingDeck must have exactly 50 cards, got 49');
    expect(source).toContain('remainingDeck overlaps known cards:');
  });

  it('simulationApi.test.ts was never quietly parameterised with deckCount', () => {
    // Proves the D-07 freeze held: this file is a 1-deck-shaped test suite, and it must
    // stay that way. A 2-deck worker-validation invariant belongs in a NEW sibling test
    // file, never a deckCount-aware edit to this frozen one.
    const source = readSource('worker/simulationApi.test.ts');
    expect(source).not.toContain('deckCount');
  });
});

describe('D-08: the v1-parity goldens exist and were not neutered', () => {
  const goldenFiles = ['engine/deckParity.golden.test.ts', 'worker/streamingParity.golden.test.ts'];

  it.each(goldenFiles)('%s exists, is tagged GOLDEN, and is never .skip/.todo-ed', (relativePath) => {
    const source = readSource(relativePath);
    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain('GOLDEN');
    expect(source).not.toContain('.skip');
    expect(source).not.toContain('.todo');
  });
});
