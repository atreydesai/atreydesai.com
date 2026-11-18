// Hyphenation for the site's justification engine (src/lib/justify.ts),
// shared by the build and the browser.
//
// Where a word may break depends only on the word, not on the reader's
// screen, so it is worked out when a page is built: every word the engine
// could hyphenate on that page goes into a small map written into the page
// (see hooks.server.js), and the browser reads it instead of downloading
// Liang's whole pattern dictionary (18 KB) on every visit. Text the map
// doesn't cover (a page reached by in-app navigation, text that arrives
// later) still loads the dictionary, on demand. Both sides use the functions
// here, so they agree on every break.

const LETTER = /\p{L}/gu;
// Names, acronyms, numbers, URLs, and words already carrying soft hyphens
// stay whole.
const KEEP_WHOLE = /^\P{L}*\p{Lu}|[\d@/:\u00ad]/u;

/** @param {string} word */
export function hyphenatable(word) {
  return word.length >= 6 && !KEEP_WHOLE.test(word);
}

/**
 * A word's parts at its break points: Liang's patterns, then TeX's English
 * minimums (two letters before a break, three after).
 *
 * @param {(text: string, options?: { hyphenChar?: string }) => string} hyphenateSync
 * @param {string} word
 * @returns {string[]}
 */
export function hyphenParts(hyphenateSync, word) {
  if (!hyphenatable(word)) return [word];
  /** @param {string} text */
  const letters = (text) => text.match(LETTER)?.length ?? 0;
  const parts = hyphenateSync(word, { hyphenChar: "\u00ad" }).split("\u00ad");
  if (parts.join("") !== word) return [word];
  const out = [parts[0]];
  let offset = parts[0].length;
  for (const part of parts.slice(1)) {
    if (letters(word.slice(0, offset)) >= 2 && letters(word.slice(offset)) >= 3) out.push(part);
    else out[out.length - 1] += part;
    offset += part.length;
  }
  return out;
}

// What the engine justifies (justify.ts's CANDIDATES and EXCLUDED), read
// from the page's HTML: text inside <p> and <li>, never inside the excluded
// elements. Inline elements join words; anything else separates them.
const CANDIDATE = new Set(["p", "li"]);
const EXCLUDED_TAGS = new Set(["nav", "button", "label", "pre", "table", "svg", "script", "style", "template", "noscript", "textarea", "select"]);
const INLINE = new Set(["a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "dfn", "em", "i", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "del", "ins"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", shy: "\u00ad" };

/** @param {string} text */
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[/** @type {keyof typeof ENTITIES} */ (name.toLowerCase())] ?? match;
  });
}

/** @param {string} attributes */
function excludedByAttributes(attributes) {
  return (
    /\bdata-justify\s*=\s*["']?off/i.test(attributes) ||
    /\baria-live\s*=/i.test(attributes) ||
    /\bcontenteditable\b/i.test(attributes) ||
    /\bclass\s*=\s*["'][^"']*\bsr-only\b/i.test(attributes)
  );
}

/**
 * Every word on the page the engine could hyphenate, mapped to its parts
 * joined by U+00AD, or to 0 when it has no break: a word the map knows is
 * never looked up in the dictionary.
 *
 * @param {(text: string, options?: { hyphenChar?: string }) => string} hyphenateSync
 * @param {string} html
 * @returns {Record<string, string | 0>}
 */
export function pageHyphenation(hyphenateSync, html) {
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  /** @type {{ tag: string, excluded: boolean, candidate: boolean }[]} */
  const stack = [];
  let text = "";
  const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  for (const match of body.matchAll(TOKEN)) {
    const [, closing, rawTag, attributes = "", selfClosing, chunk] = match;
    const top = stack.at(-1);
    if (chunk !== undefined) {
      if (top?.candidate && !top.excluded) text += decode(chunk);
      continue;
    }
    if (!rawTag) continue; // a comment
    const tag = rawTag.toLowerCase();
    if (!INLINE.has(tag)) text += " ";
    if (closing) {
      const at = stack.findLastIndex((entry) => entry.tag === tag);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (VOID.has(tag) || selfClosing) continue;
    stack.push({
      tag,
      excluded: Boolean(top?.excluded) || EXCLUDED_TAGS.has(tag) || excludedByAttributes(attributes),
      candidate: Boolean(top?.candidate) || CANDIDATE.has(tag),
    });
  }

  /** @type {Record<string, string | 0>} */
  const map = Object.create(null);
  for (const word of text.split(/[ \t\n\r\f]+/)) {
    if (!hyphenatable(word) || Object.hasOwn(map, word)) continue;
    const parts = hyphenParts(hyphenateSync, word);
    map[word] = parts.length > 1 ? parts.join("\u00ad") : 0;
  }
  return map;
}
