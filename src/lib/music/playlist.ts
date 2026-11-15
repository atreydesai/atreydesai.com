// Which songs a run plays, and in what order. Pure: give it a `random` and
// the same draw comes back, so all of it runs under `node --test`.

/** `avoid` as a list, whether it came as one song, several, or none. */
function avoidList(avoid: number | null | readonly number[]): readonly number[] {
  if (avoid === null) return [];
  return typeof avoid === "number" ? [avoid] : avoid;
}

/**
 * Every song once, in a fresh order (a Fisher–Yates shuffle of
 * `0..count-1`). It never opens on a song in `avoidFirst` (the songs that
 * opened the last few runs) while any other song could open instead: the
 * opener trades places with a song drawn from the rest.
 */
export function shuffledPlaylist(
  count: number,
  avoidFirst: number | null | readonly number[],
  random: () => number = Math.random,
): number[] {
  const list = Array.from({ length: Math.max(0, count) }, (_, index) => index);
  for (let index = list.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1)) % (index + 1);
    [list[index], list[pick]] = [list[pick], list[index]];
  }
  const avoid = avoidList(avoidFirst);
  if (list.length > 1 && avoid.includes(list[0])) {
    const fresh = list.map((_, index) => index).filter((index) => index > 0 && !avoid.includes(list[index]));
    // Every song is one to avoid: then only the very last opener is.
    const pool = fresh.length
      ? fresh
      : list.map((_, index) => index).filter((index) => index > 0 && list[index] !== avoid[0]);
    if (pool.length) {
      const swap = pool[Math.floor(random() * pool.length) % pool.length];
      [list[0], list[swap]] = [list[swap], list[0]];
    }
  }
  return list;
}

/**
 * The openers to steer clear of next time: `opener` first, then the
 * earlier ones, each once, at most `keep` of them.
 */
export function rememberOpener(recent: readonly number[], opener: number, keep: number): number[] {
  return [opener, ...recent.filter((song) => song !== opener)].slice(0, Math.max(0, keep));
}

/**
 * Sizes of `picks` contiguous bands over `count` ranked songs, as even as
 * possible, the larger bands in the middle: 10 into 4 is 2, 3, 3, 2.
 */
export function bandSizes(count: number, picks: number): number[] {
  const bands = Math.max(0, Math.min(picks, count));
  if (bands === 0) return [];
  const base = Math.floor(count / bands);
  const sizes = new Array<number>(bands).fill(base);
  const centre = (bands - 1) / 2;
  const byCentre = sizes
    .map((_, index) => index)
    .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b);
  for (let extra = 0; extra < count % bands; extra++) sizes[byCentre[extra]] += 1;
  return sizes;
}

/**
 * `picks` songs whose tempo climbs: rank the songs by tempo (ties by
 * index), split the ranking into `picks` contiguous bands, draw one song
 * from each, and return them slowest first. More picks than songs plays
 * every song, slowest first. The opener is drawn from the slowest band's
 * songs that aren't in `avoidFirst`, while there are any.
 */
export function climbingPlaylist(
  tempos: number[],
  picks = 4,
  random: () => number = Math.random,
  avoidFirst: readonly number[] = [],
): number[] {
  const ranked = tempos
    .map((bpm, index) => ({ bpm, index }))
    .sort((a, b) => a.bpm - b.bpm || a.index - b.index)
    .map((entry) => entry.index);
  const chosen: number[] = [];
  let from = 0;
  for (const size of bandSizes(ranked.length, picks)) {
    const band = ranked.slice(from, from + size);
    const fresh = chosen.length === 0 ? band.filter((song) => !avoidFirst.includes(song)) : [];
    const pool = fresh.length ? fresh : band;
    chosen.push(pool[Math.floor(random() * pool.length) % pool.length]);
    from += size;
  }
  return chosen;
}
