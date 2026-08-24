import '@testing-library/jest-dom/vitest';

// jsdom@30.0.1 (this project's pinned version) does not implement HTMLDialogElement.showModal()
// or .close() — calling either throws "not a function" at runtime. This is a known environment
// gap (02-04-PLAN.md's CardPicker uses the real native <dialog> API exactly as browsers require,
// not a weakened substitute), so the fix belongs here in test setup, not in the component. Both
// polyfills are minimal: they only toggle `.open` and, for `close()`, dispatch the real 'close'
// event so React's native (non-bubbling) close-event listener still fires correctly.
//
// Guarded on `typeof HTMLDialogElement !== 'undefined'` because this setup file also runs for
// suites that opt into `@vitest-environment node` (no DOM globals at all) — see
// src/engine/*.test.ts and src/worker/simulationApi.test.ts.
if (typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
}

// jsdom has no compositor, so real-duration Motion animations would make every existing UI
// assertion time-dependent and flaky. Forcing `prefers-reduced-motion: reduce` ON for every
// test keeps the whole harness deterministic (Motion's `useReducedMotion()`/`MotionConfig
// reducedMotion="user"` collapse every duration to 0) while still exercising the reduced-motion
// code path itself (D-09). Real-motion behaviour is accepted by the human checkpoint in plan
// 03-06, not asserted here.
//
// Guarded on `typeof window !== 'undefined'` for the same reason as the HTMLDialogElement
// polyfill above: this setup file also runs for suites under `@vitest-environment node` (no DOM
// globals at all) — see src/engine/*.test.ts and src/worker/simulationApi.test.ts.
const REDUCED_MOTION_QUERY = /\(\s*prefers-reduced-motion\s*(?::\s*([\w-]+)\s*)?\)/;

// IMP-15: replaces a plain substring match against the feature name (which answered
// `true` for `'(prefers-reduced-motion: no-preference)'` — the exact negation of what that
// query means) with a real parse of the one feature this harness cares about.
function matchesReducedMotion(query: string): boolean {
  const match = REDUCED_MOTION_QUERY.exec(query);
  if (match === null) return false;
  // The bare feature form `(prefers-reduced-motion)` (no `: value`) is true whenever the
  // value is anything OTHER than `no-preference` — and this harness deliberately forces
  // `reduce` for every test (D-09), so a missing value defaults to `reduce`. Any unrelated
  // query (e.g. `(min-width: 1024px)`) fails the regex entirely and correctly returns
  // `false` instead of accidentally matching a substring.
  const value = match[1] ?? 'reduce';
  return value === 'reduce';
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = function (query: string): MediaQueryList {
    return {
      matches: matchesReducedMotion(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}
