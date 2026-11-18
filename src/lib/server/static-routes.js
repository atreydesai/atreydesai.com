// Every page is prerendered (src/routes/+layout.ts), so Vercel answers page
// requests from static files and no function runs. What the server hook used
// to do per request, the route table now does once, decided at build time:
//
// - `Accept: text/markdown` at a page's URL is rewritten to the page's
//   prerendered Markdown twin (/research/ -> /research/index.md);
// - pages and twins carry the headers the hook added (Vary, the agent-guide
//   and alternate Links, the Markdown content type).
//
// Vercel serves static files before rewrites in vercel.json, so these go into
// the Build Output API's own route table, ahead of its filesystem step:
// withStaticRoutes() wraps the adapter and patches .vercel/output/config.json.
// The same rules are evaluated in JS by the tests (tests/static-routes.test.mjs)
// against content-negotiation.js's preferredType(), the hook's exact answer.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE_URL = "https://atreydesai.com";
const AGENT_GUIDE_LINK = `<${SITE_URL}/llms.txt>; rel="describedby"; type="text/plain"`;
const VARY = "Accept, Accept-Encoding";
const MARKDOWN_TYPE = "text/markdown; charset=utf-8";

// When the route table serves Markdown at a page URL. The patterns are full
// matches against the Accept header and use no lookaround, so they mean the
// same in any regex engine. Two cases, either of which serves Markdown:
//
// 1. Markdown is listed at full weight (no q, or q=1), and no full-weight
//    type that also covers HTML (text/html, text/*, */*) is listed before it.
// 2. Markdown is listed at a nonzero weight and nothing covers HTML at all.
//
// That is preferredType()'s answer for every header in the test corpus,
// except the two it lists as known differences (a lower-weighted Markdown
// beating a still-lower HTML, and uppercase types). A header that accepts
// neither type, which the hook refused with 406, now simply gets the HTML.
const FULL_WEIGHT = String.raw`(\s*;\s*q\s*=\s*1(\.0*)?)?\s*`;
/** @param {string} type */
const COVERS_HTML_FIRST = (type) =>
  String.raw`(.*,)?\s*${type}${FULL_WEIGHT},.*text/markdown.*`;

export const MARKDOWN_ACCEPT_RULES = [
  {
    has: String.raw`.*text/markdown.*`,
    missing: [
      String.raw`.*text/markdown\s*;\s*q\s*=\s*0.*`,
      COVERS_HTML_FIRST(String.raw`text/html`),
      COVERS_HTML_FIRST(String.raw`text/\*`),
      COVERS_HTML_FIRST(String.raw`\*/\*`),
    ],
  },
  {
    has: String.raw`.*text/markdown.*`,
    missing: [
      // Exactly q=0 (refused), ending at a comma or the end, so q=0.5 isn't
      // mistaken for it when the pattern is read as an unanchored search.
      String.raw`.*text/markdown\s*;\s*q\s*=\s*0(\.0*)?\s*(,.*|$)`,
      String.raw`.*text/html.*`,
      String.raw`.*text/\*.*`,
      String.raw`.*\*/\*.*`,
    ],
  },
];

/**
 * Whether the route table serves Markdown for this Accept header, evaluated
 * the way Vercel evaluates `has`/`missing`. `partial` checks the patterns as
 * unanchored searches instead, so the tests can show the rules agree under
 * either reading of how Vercel anchors them.
 *
 * @param {string | null} accept
 * @param {{ partial?: boolean }} [options]
 */
export function routeServesMarkdown(accept, { partial = false } = {}) {
  if (accept == null) return false;
  /** @param {string} pattern */
  const test = (pattern) =>
    new RegExp(partial ? pattern : `^(?:${pattern})$`).test(accept);
  return MARKDOWN_ACCEPT_RULES.some(
    (rule) => test(rule.has) && !rule.missing.some(test),
  );
}

/** @param {string} path a page path, e.g. `/research/` */
const twinOf = (path) => `${path}index.md`;
/** @param {string} path */
const escapeRegex = (path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The routes and overrides to add for these prerendered pages.
 *
 * @param {string[]} pages prerendered page paths, each ending in `/`
 */
export function staticRoutes(pages) {
  const sorted = [...pages].sort();
  const pagePattern = `^(${sorted.map((path) => escapeRegex(path)).join("|")})$`;

  const routes = [
    // Markdown at the page's own URL, for the requests that prefer it.
    ...MARKDOWN_ACCEPT_RULES.map((rule) => ({
      src: pagePattern,
      has: [{ type: "header", key: "accept", value: rule.has }],
      missing: rule.missing.map((value) => ({ type: "header", key: "accept", value })),
      dest: "$1index.md",
      headers: { Vary: VARY, Link: AGENT_GUIDE_LINK },
    })),
    // Everyone else gets the HTML, which says where the Markdown is.
    ...sorted.map((path) => ({
      src: `^${escapeRegex(path)}$`,
      headers: {
        Vary: VARY,
        Link: `${AGENT_GUIDE_LINK}, <${SITE_URL}${twinOf(path)}>; rel="alternate"; type="text/markdown"`,
      },
      continue: true,
    })),
    // A twin fetched by its own URL names its page as canonical.
    ...sorted.map((path) => ({
      src: `^${escapeRegex(twinOf(path))}$`,
      headers: { Link: `<${SITE_URL}${path}>; rel="canonical", ${AGENT_GUIDE_LINK}` },
      continue: true,
    })),
  ];

  const overrides = Object.fromEntries(
    sorted.map((path) => [twinOf(path).slice(1), { contentType: MARKDOWN_TYPE }]),
  );

  return { routes, overrides };
}

/**
 * Wrap an adapter so its Vercel output carries staticRoutes(). Fails the
 * build if a prerendered page has no Markdown twin.
 *
 * @template {import('@sveltejs/kit').Adapter} A
 * @param {A} adapter
 * @returns {A}
 */
export function withStaticRoutes(adapter) {
  return {
    ...adapter,
    async adapt(builder) {
      await adapter.adapt(builder);

      const pages = [...builder.prerendered.pages.keys()];
      const missing = pages.filter(
        (path) => !builder.prerendered.assets.has(twinOf(path)),
      );
      if (missing.length) {
        throw new Error(
          `These prerendered pages have no Markdown twin: ${missing.join(", ")}`,
        );
      }

      const file = join(".vercel", "output", "config.json");
      const config = JSON.parse(await readFile(file, "utf8"));
      const { routes, overrides } = staticRoutes(pages);

      // After the adapter's first route (it strips the reserved __pathname
      // query) and before its trailing-slash rewrites, which would otherwise
      // claim /research/ first.
      config.routes.splice(1, 0, ...routes);
      config.overrides = { ...config.overrides, ...overrides };
      await writeFile(file, JSON.stringify(config, null, "\t"));
      builder.log.minor(
        `Static routes: ${pages.length} pages, Markdown by Accept header`,
      );
    },
  };
}
