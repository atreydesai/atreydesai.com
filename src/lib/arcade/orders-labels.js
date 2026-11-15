// The paper labels stuck on order up's jars (the tea tanks, the ice bin, the
// syrup bottle), as pixel art: a tiny hand-printed lowercase alphabet five
// units tall, and a flavour icon for when a word won't fit the glass. Kept
// free of the DOM so the glyphs can be checked with node; the component lays
// them on the jar's own cell grid.

/**
 * Lowercase letters, five rows each, "#" printed. Mostly three units wide;
 * m and w take five. Descenders are tucked into the last row.
 * @type {Record<string, string[]>}
 */
export const GLYPHS = {
  a: ["...", ".##", "#.#", "#.#", ".##"],
  b: ["#..", "##.", "#.#", "#.#", "##."],
  c: ["...", ".##", "#..", "#..", ".##"],
  e: ["...", ".#.", "###", "#..", ".##"],
  g: ["...", ".##", "#.#", ".##", "##."],
  h: ["#..", "##.", "#.#", "#.#", "#.#"],
  i: ["#", ".", "#", "#", "#"],
  k: ["#..", "#.#", "##.", "#.#", "#.#"],
  l: ["#.", "#.", "#.", "#.", ".#"],
  m: [".....", "##.#.", "#.#.#", "#.#.#", "#.#.#"],
  n: ["...", "##.", "#.#", "#.#", "#.#"],
  o: ["...", ".#.", "#.#", "#.#", ".#."],
  p: ["...", "##.", "#.#", "##.", "#.."],
  r: ["...", "#.#", "##.", "#..", "#.."],
  s: ["...", ".##", "##.", "..#", "##."],
  t: [".#.", "###", ".#.", ".#.", "..#"],
  u: ["...", "#.#", "#.#", "#.#", ".##"],
  w: [".....", "#...#", "#.#.#", "#.#.#", ".#.#."],
  y: ["...", "#.#", "#.#", ".##", "##."],
};

/** Five-unit flavour marks, printed in colour: for a label too narrow for its word. */
export const ICONS = {
  /** A matcha leaf. */
  leaf: { grid: ["...gG", "..gGg", ".gGg.", "gGg..", "G...."], palette: { g: "#7aa84a", G: "#3f6a2a" } },
  /** A strawberry. */
  berry: { grid: [".gGg.", "rrrrr", "rwrrr", ".rrr.", "..r.."], palette: { g: "#5f8f3a", G: "#3f6a2a", r: "#d9455f", w: "#fbe0e6" } },
  /** A taro root. */
  taro: { grid: ["..G..", ".ppp.", "ppwpp", "ppppp", ".ppp."], palette: { G: "#5f8f3a", p: "#8f6ac0", w: "#d9c8ef" } },
  /** A drop of milk. */
  milk: { grid: ["..m..", ".mmm.", "mmmmm", "mwmmm", ".mmm."], palette: { m: "#c79a6b", w: "#efe0cf" } },
  /** A cube of ice. */
  ice: { grid: ["bbbb.", "bwwbb", "bwbbb", "bbbbb", ".bbbb"], palette: { b: "#7fb3c9", w: "#e6f4f9" } },
  /** A drop of syrup. */
  syrup: { grid: ["..s..", ".sss.", "sssss", "swsss", ".sss."], palette: { s: "#b8741f", w: "#f0c98a" } },
};

/**
 * Units a word takes across, a unit between letters.
 * @param {string} word
 */
export function wordWidth(word) {
  let width = 0;
  for (const letter of word) width += (GLYPHS[letter]?.[0].length ?? 3) + 1;
  return Math.max(0, width - 1);
}

/** Rows every glyph and icon stands. */
export const GLYPH_ROWS = 5;
