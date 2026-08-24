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
