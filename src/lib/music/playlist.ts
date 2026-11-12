// Which songs a run plays, and in what order. Pure: give it a `random` and
// the same draw comes back, so all of it runs under `node --test`.

/**
 * Every song once, in a fresh order (a Fisher–Yates shuffle of
 * `0..count-1`). When it would open on `avoidFirst`, the opener trades
 * places with another song, so two runs in a row never start the same way.
 */
export function shuffledPlaylist(
  count: number,
  avoidFirst: number | null,
  random: () => number = Math.random,
): number[] {
  const list = Array.from({ length: Math.max(0, count) }, (_, index) => index);
  for (let index = list.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1)) % (index + 1);
    [list[index], list[pick]] = [list[pick], list[index]];
  }
  if (list.length > 1 && list[0] === avoidFirst) {
    const swap = 1 + (Math.floor(random() * (list.length - 1)) % (list.length - 1));
    [list[0], list[swap]] = [list[swap], list[0]];
  }
  return list;
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
 * every song, slowest first.
 */
export function climbingPlaylist(
  tempos: number[],
  picks = 4,
  random: () => number = Math.random,
): number[] {
  const ranked = tempos
    .map((bpm, index) => ({ bpm, index }))
    .sort((a, b) => a.bpm - b.bpm || a.index - b.index)
    .map((entry) => entry.index);
  const chosen: number[] = [];
  let from = 0;
  for (const size of bandSizes(ranked.length, picks)) {
    chosen.push(ranked[from + (Math.floor(random() * size) % size)]);
    from += size;
  }
  return chosen;
}
