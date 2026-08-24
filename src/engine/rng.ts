import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand/types/RandomGenerator';
import type { Card } from '@poker-apprentice/types';

// NOTE: pure-rand@8.4.2 has NO top-level "." export — every import must use a subpath.
// A bare `import { xoroshiro128plus } from 'pure-rand'` throws ERR_PACKAGE_PATH_NOT_EXPORTED.

/**
 * Creates a seeded, statistically-vetted pseudo-random generator (xoroshiro128+).
 * Omit `seed` for fresh randomness on every call.
 */
export function createRng(seed: number = Date.now() ^ (Math.random() * 0x100000000)): RandomGenerator {
  return xoroshiro128plus(seed);
}

/**
 * Draws `n` cards from `pool` without replacement using a partial Fisher-Yates shuffle.
 * Allocates a fresh working copy of `pool` on every call — suited to one-off draws.
 */
export function drawN(rng: RandomGenerator, pool: readonly Card[], n: number): Card[] {
  const working = pool.slice();
  for (let i = 0; i < n; i++) {
    const j = uniformInt(rng, i, working.length - 1);
    [working[i], working[j]] = [working[j], working[i]];
  }
  return working.slice(0, n);
}

/**
 * Returns a closure that draws `n` cards from `pool` without replacement on each call,
 * reusing a single working array across calls to avoid per-trial GC pressure in hot loops.
 */
export function createDrawer(rng: RandomGenerator, pool: readonly Card[], n: number): () => Card[] {
  const working = pool.slice();
  return () => {
    for (let i = 0; i < n; i++) {
      const j = uniformInt(rng, i, working.length - 1);
      [working[i], working[j]] = [working[j], working[i]];
    }
    return working.slice(0, n);
  };
}
