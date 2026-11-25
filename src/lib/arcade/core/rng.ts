// Seeded randomness and hashing. Courses, sites, rooms and scenery are all
// seeded, so these must stay bit-for-bit what the games already used: a
// change here moves every seeded thing in every game. Tests pin the values.

/**
 * Advances a mulberry32 generator whose whole state is one integer, so the
 * generator can live inside a run's state and be cloned with it.
 */
export function nextRandom(gen: { s: number }) {
  const a = (gen.s + 0x6d2b79f5) | 0;
  gen.s = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A seeded mulberry32 generator: the same seed always gives the same values in [0, 1). */
export function createRng(seed: number) {
  const gen = { s: seed | 0 };
  return () => nextRandom(gen);
}

/** An integer hashed to [0, 1): stable per input, for detail seeded by position. */
export function ihash(n: number) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Two integers hashed to [0, 1). */
export const hash2 = (a: number, b: number) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));

/** Smooth value noise in [0, 1) over a 2D lattice of `hash2`. */
export function noise2(a: number, b: number) {
  const ia = Math.floor(a);
  const ib = Math.floor(b);
  const ta = a - ia;
  const tb = b - ib;
  const fa = ta * ta * (3 - 2 * ta);
  const fb = tb * tb * (3 - 2 * tb);
  const top = hash2(ia, ib) + (hash2(ia + 1, ib) - hash2(ia, ib)) * fa;
  const bottom = hash2(ia, ib + 1) + (hash2(ia + 1, ib + 1) - hash2(ia, ib + 1)) * fa;
  return top + (bottom - top) * fb;
}
