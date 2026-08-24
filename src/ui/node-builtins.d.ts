// Scoped fallback for the ONE on-disk-asset test that needs real Node module shapes
// (`src/ui/PlayingCard.test.tsx`, which resolves the vendored `public/cards` SVG directory
// off disk via `node:fs`/`node:url`/`node:path`). Removing the `"node"` entry from
// `tsconfig.app.json`'s `types` array (IMP-02) correctly stops browser app code from seeing
// Node's ambient globals (`process`, `Buffer`, etc.), but it also removed the module
// declarations for these three built-ins that only this one test file imports.
//
// Deliberately narrower than `@types/node`: it declares ONLY the four symbols
// `PlayingCard.test.tsx` actually uses, not the full Node ambient global surface — so this
// file cannot silently reintroduce `process`/`Buffer`/etc. into browser app code.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
}
