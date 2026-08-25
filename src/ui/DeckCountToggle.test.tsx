import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCountToggle } from './DeckCountToggle';
import type { DeckTogglePrefix } from './deckTogglePrefix';
import { useGameStore } from '../state/gameStore';
import { useBlackjackStore } from '../state/blackjackStore';

// Component-level contract suite for the ONE shared deck-count segmented control (Phase 8
// D-01, SC1), mirroring the src/ui/GameModeSwitcher.test.tsx checklist — default active state,
// aria-pressed flip, already-active click, never-disabled, labels-never-change, wrapper group
// semantics — but rendered from PROP FIXTURES instead of a store, because that is the whole
// point of this component: it is the only place the props-only contract can be tested in
// isolation, with no <App />, no store wiring and no service mocks (the component's only
// import is a type-only DeckCount).
//
// The three sibling proofs of SC1 live elsewhere and are deliberately not duplicated here:
// src/App.modeShell.guard.test.ts holds the source-identity + single-source-of-markup sweeps
// (08-UI-SPEC A3), src/App.deckToggleDom.golden.test.tsx holds the nine-state byte-identity
// golden (A2), and src/App.deckToggleConsolidation.test.tsx exercises both games through the
// rendered control.
//
// Most cases use a FABRICATED testid prefix so the suite proves the prefix is genuinely a
// parameter rather than accidentally coupled to either game's contractual value; one dedicated
// case uses the two real prefixes, since D-02 makes those strings contractual.

// `testidPrefix` is typed as the two-value DeckTogglePrefix union in production (D-02,
// 08-REVIEW IN-03). The widening happens HERE, at the test boundary, and only here: the
// fabricated prefixes below are the whole reason this suite can prove the prefix is genuinely
// a runtime parameter rather than accidentally coupled to either game's contractual value, so
// they must stay fabricated. The cast affects nothing at runtime — the rendered attributes
// asserted throughout this file are the real proof.
const PREFIX = 'test-deck-toggle' as DeckTogglePrefix;

/** Locked title copy from the two CALL SITES (06/07 Copywriting Contracts, carried verbatim by
 * 08-UI-SPEC). Used here purely as realistic fixtures: the component hard-codes no title
 * string — the cases below prove the rendered value tracks whatever prop arrives. */
const BLACKJACK_GUARD_TITLE = 'The dealt cards include a duplicate — impossible with one deck';
const HOLDEM_GUARD_TITLE = 'Your picked cards include a duplicate — impossible with one deck';
const FRESH_DEAL_TITLE = 'Switching the shoe deals a fresh hand';

const noop = () => {};

describe('DeckCountToggle — the shared, props-only deck-count control (Phase 8 D-01, 08-UI-SPEC Prop Contract)', () => {
  afterEach(() => {
    // Only the props-only case writes either store; restoring both to the shipped default
    // keeps that one setup from leaking into anything that runs after it.
    useGameStore.setState({ deckCount: 1 });
    useBlackjackStore.setState({ deckCount: 1 });
  });

  it('wraps exactly two native buttons in a role="group" labelled "Deck count"', () => {
    render(<DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={noop} />);

    const wrapper = screen.getByTestId(PREFIX);
    expect(wrapper).toHaveAttribute('role', 'group');
    expect(wrapper).toHaveAttribute('aria-label', 'Deck count');
    // The literal markup string below is deliberate, and it is the reason the SC1
    // single-source-of-markup sweep in src/App.modeShell.guard.test.ts excludes *.test.tsx:
    // written this way, that exclusion is genuinely EXERCISED by this file rather than
    // passing only because no test happened to contain the string.
    expect(wrapper.outerHTML).toContain('aria-label="Deck count"');
    // The wrapper's children ARE the two segments, in the locked order — asserted as the
    // rendered testid values, not as mere presence (D-09).
    expect(Array.from(wrapper.children).map((child) => child.getAttribute('data-testid'))).toEqual([
      `${PREFIX}-1`,
      `${PREFIX}-2`,
    ]);
    expect(screen.getByTestId(`${PREFIX}-1`)).toHaveAttribute('type', 'button');
    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('type', 'button');
  });

  it('labels read exactly "1 deck" and "2 decks" and never change when the pressed segment flips (binding rule 3)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={onSelect} />,
    );

    // textContent EQUALITY, not a substring match: the label is the entire rendered text of
    // each segment, so a state badge or an appended count would fail here.
    expect(screen.getByTestId(`${PREFIX}-1`).textContent).toBe('1 deck');
    expect(screen.getByTestId(`${PREFIX}-2`).textContent).toBe('2 decks');

    // The control owns no state, so the parent re-rendering with the new count is what flips
    // the pressed segment — exactly what both games' stores drive at the call sites.
    await user.click(screen.getByTestId(`${PREFIX}-2`));
    rerender(<DeckCountToggle testidPrefix={PREFIX} deckCount={2} onSelect={onSelect} />);

    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${PREFIX}-1`).textContent).toBe('1 deck');
    expect(screen.getByTestId(`${PREFIX}-2`).textContent).toBe('2 decks');
  });

  it('serializes aria-pressed on BOTH segments, tracking the deckCount prop (binding rule 4)', () => {
    const { rerender } = render(
      <DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={noop} />,
    );

    expect(screen.getByTestId(`${PREFIX}-1`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('aria-pressed', 'false');

    rerender(<DeckCountToggle testidPrefix={PREFIX} deckCount={2} onSelect={noop} />);

    expect(screen.getByTestId(`${PREFIX}-1`)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('aria-pressed', 'true');
  });

  // Explicitly typed as the union rather than cast: these two ARE the contractual values, so
  // this case now also type-checks that DeckTogglePrefix still admits both of them (D-02).
  it.each<DeckTogglePrefix>(['blackjack-deck-toggle', 'holdem-deck-toggle'])(
    'derives all three contractual testids from the "%s" prefix (D-02)',
    (prefix) => {
      render(<DeckCountToggle testidPrefix={prefix} deckCount={1} onSelect={noop} />);

      expect(screen.getByTestId(prefix).getAttribute('data-testid')).toBe(prefix);
      expect(screen.getByTestId(`${prefix}-1`).getAttribute('data-testid')).toBe(`${prefix}-1`);
      expect(screen.getByTestId(`${prefix}-2`).getAttribute('data-testid')).toBe(`${prefix}-2`);
      // One control, not three loose elements: both segments are children of the wrapper.
      expect(screen.getByTestId(`${prefix}-1`).parentElement).toBe(screen.getByTestId(prefix));
      expect(screen.getByTestId(`${prefix}-2`).parentElement).toBe(screen.getByTestId(prefix));
    },
  );

  it("onSelect receives the clicked segment's count — 1 from the first, 2 from the second", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={onSelect} />,
    );

    await user.click(screen.getByTestId(`${PREFIX}-2`));
    // The ARGUMENT is the contract, not merely that the spy fired (D-09).
    expect(onSelect.mock.calls).toEqual([[2]]);

    rerender(<DeckCountToggle testidPrefix={PREFIX} deckCount={2} onSelect={onSelect} />);
    await user.click(screen.getByTestId(`${PREFIX}-1`));

    expect(onSelect.mock.calls).toEqual([[2], [1]]);
  });

  it('clicking the ACTIVE segment still calls onSelect with that same count (08-UI-SPEC A4)', async () => {
    // The shipped no-op is each game store's same-value early return — the component must NOT
    // add a second suppression layer in front of it, because that would silently replace the
    // click path both games' existing toggle suites exercise (T-08-10).
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={onSelect} />,
    );

    await user.click(screen.getByTestId(`${PREFIX}-1`));
    expect(onSelect).toHaveBeenCalledWith(1);

    rerender(<DeckCountToggle testidPrefix={PREFIX} deckCount={2} onSelect={onSelect} />);
    await user.click(screen.getByTestId(`${PREFIX}-2`));

    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onSelect.mock.calls).toEqual([[1], [2]]);
  });

  it('omitted disabled/title props render NO attribute on either segment (binding rule 5)', () => {
    render(<DeckCountToggle testidPrefix={PREFIX} deckCount={1} onSelect={noop} />);

    for (const testid of [`${PREFIX}-1`, `${PREFIX}-2`]) {
      const segment = screen.getByTestId(testid);
      expect(segment, `${testid} must carry no title attribute when none is supplied`).not.toHaveAttribute('title');
      expect(segment, `${testid} must carry no disabled attribute when none is supplied`).not.toHaveAttribute('disabled');
      expect(segment).not.toBeDisabled();
    }
  });

  it('oneDeckDisabled + oneDeckTitle guard segment 1 only, with the supplied title as a VALUE (binding rule 6)', async () => {
    // `noop` was replaced with a spy and a real user here so the ACTIVE-segment case added at
    // the end of this test can assert OPERABILITY, not just attribute absence.
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <DeckCountToggle
        testidPrefix={PREFIX}
        deckCount={2}
        onSelect={onSelect}
        oneDeckDisabled
        oneDeckTitle={BLACKJACK_GUARD_TITLE}
      />,
    );

    expect(screen.getByTestId(`${PREFIX}-1`)).toBeDisabled();
    expect(screen.getByTestId(`${PREFIX}-1`)).toHaveAttribute('title', BLACKJACK_GUARD_TITLE);
    // Segment 2 is never disabled — not even while segment 1's guard is active, and not even
    // though it is the ACTIVE segment here (both games' guards are one-directional, 2 -> 1).
    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${PREFIX}-2`)).not.toBeDisabled();
    expect(screen.getByTestId(`${PREFIX}-2`)).not.toHaveAttribute('title');

    // The title is a pure parameter: the same guarded render with the other game's locked
    // string renders that string instead — nothing about either is hard-coded (T-08-07).
    rerender(
      <DeckCountToggle
        testidPrefix={PREFIX}
        deckCount={2}
        onSelect={onSelect}
        oneDeckDisabled
        oneDeckTitle={HOLDEM_GUARD_TITLE}
      />,
    );

    expect(screen.getByTestId(`${PREFIX}-1`)).toHaveAttribute('title', HOLDEM_GUARD_TITLE);

    // ADDED (08-REVIEW WR-01): the case this test was named for but never rendered. Same
    // guarded props, segment 1 now ACTIVE. Neither shipped call site can reach this state —
    // both guard predicates are one-directional 2 -> 1 — and that is exactly why the
    // COMPONENT, not call-site discipline, has to be what forbids it: a pressed segment that
    // is disabled is an inoperable toggle with no visible way back (a WCAG operable-toggle
    // violation), and 07 A3 forbids a title on the active segment. Rendering only
    // deckCount={2} above could not distinguish the enforced invariant from an unenforced one.
    rerender(
      <DeckCountToggle
        testidPrefix={PREFIX}
        deckCount={1}
        onSelect={onSelect}
        oneDeckDisabled
        oneDeckTitle={HOLDEM_GUARD_TITLE}
      />,
    );

    const activeSegmentOne = screen.getByTestId(`${PREFIX}-1`);
    expect(activeSegmentOne).toHaveAttribute('aria-pressed', 'true');
    expect(activeSegmentOne).not.toBeDisabled();
    expect(activeSegmentOne, 'the active segment must carry NO disabled attribute at all').not.toHaveAttribute(
      'disabled',
    );
    expect(activeSegmentOne, 'the active segment must carry no title (07 A3)').not.toHaveAttribute('title');

    // Operable, not merely un-disabled: the click still reaches onSelect with its own count,
    // so the store's same-value early return stays the only no-op mechanism (A4).
    onSelect.mockClear();
    await user.click(activeSegmentOne);
    expect(onSelect.mock.calls).toEqual([[1]]);
  });

  it('twoDecksTitle renders on segment 2 as a value and never disables it', () => {
    const { rerender } = render(
      <DeckCountToggle
        testidPrefix={PREFIX}
        deckCount={1}
        onSelect={noop}
        twoDecksTitle={FRESH_DEAL_TITLE}
      />,
    );

    expect(screen.getByTestId(`${PREFIX}-2`)).toHaveAttribute('title', FRESH_DEAL_TITLE);
    expect(screen.getByTestId(`${PREFIX}-2`)).not.toBeDisabled();
    // A title on one segment must not bleed onto the other.
    expect(screen.getByTestId(`${PREFIX}-1`)).not.toHaveAttribute('title');

    // ADDED (08-REVIEW WR-01), the symmetric half: the SAME title prop while segment 2 is the
    // ACTIVE segment renders no attribute. 07 A3 puts the pre-click affordance on the inactive
    // segment only, and the shipped call site already computes it that way — this pins that the
    // component enforces it too, so the rule survives a call site that forgets the direction.
    rerender(
      <DeckCountToggle
        testidPrefix={PREFIX}
        deckCount={2}
        onSelect={noop}
        twoDecksTitle={FRESH_DEAL_TITLE}
      />,
    );

    const activeSegmentTwo = screen.getByTestId(`${PREFIX}-2`);
    expect(activeSegmentTwo).toHaveAttribute('aria-pressed', 'true');
    expect(activeSegmentTwo, 'the active segment must carry no title (07 A3)').not.toHaveAttribute('title');
    expect(activeSegmentTwo).not.toBeDisabled();
  });

  it('renders from its prop alone while both game stores hold a contradicting deck count (D-01)', () => {
    // "Reads no store" in its only observable form: the rendered pressed segment disagrees
    // with the live store values. Neither store is subscribed, so neither setState below can
    // move the DOM — only the prop can.
    useGameStore.setState({ deckCount: 1 });
    useBlackjackStore.setState({ deckCount: 2 });

    // Second fabricated prefix, widened at the test boundary for the same reason as PREFIX.
    const unrelatedPrefix = 'props-only-deck-toggle' as DeckTogglePrefix;
    const { rerender } = render(
      <DeckCountToggle testidPrefix={unrelatedPrefix} deckCount={2} onSelect={noop} />,
    );

    // Prop 2 wins over gameStore's 1.
    expect(screen.getByTestId(`${unrelatedPrefix}-2`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${unrelatedPrefix}-1`)).toHaveAttribute('aria-pressed', 'false');

    // Now BOTH stores hold 2 and the prop says 1 — the render contradicts each of them.
    useGameStore.setState({ deckCount: 2 });
    rerender(<DeckCountToggle testidPrefix={unrelatedPrefix} deckCount={1} onSelect={noop} />);

    expect(screen.getByTestId(`${unrelatedPrefix}-1`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`${unrelatedPrefix}-2`)).toHaveAttribute('aria-pressed', 'false');
    // And the control wrote nothing back: both stores still hold what the test set.
    expect(useGameStore.getState().deckCount).toBe(2);
    expect(useBlackjackStore.getState().deckCount).toBe(2);
  });
});
