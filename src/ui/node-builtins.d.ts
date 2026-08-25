// Scoped fallback for the on-disk-asset tests that need real Node module shapes
// (`src/ui/PlayingCard.test.tsx`, which resolves the vendored `public/cards` SVG directory
// off disk via `node:fs`/`node:url`/`node:path`; and `src/engine/shoePath.guard.test.ts`, the
// DECK-01 source guard, which reads shoe-path source files off disk).
// Removing the `"node"` entry from `tsconfig.app.json`'s `types` array (IMP-02) correctly
// stops browser app code from seeing Node's ambient globals (`process`, `Buffer`, etc.), but
// it also removed the module declarations for these built-ins that only these test files
// import.
//
// Deliberately narrower than `@types/node`: it declares ONLY the six symbols these test
// files actually use, not the full Node ambient global surface — so this file cannot
// silently reintroduce `process`/`Buffer`/etc. into browser app code.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  // Phase 7 (plan 07-03): shoePath.guard.test.ts's evaluator call-site allowlist walks
  // src/ recursively. Narrow on purpose: recursive-only, string[] return (utf8 default).
  export function readdirSync(path: string, options: { recursive: boolean }): string[];
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
}
