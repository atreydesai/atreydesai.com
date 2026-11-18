import {
  markdownTarget,
  negotiateHtmlResponse,
  serveMarkdownUrl,
} from "./lib/server/content-negotiation.js";
import { cachePage } from "./lib/server/page-cache.js";
// A CommonJS package: its file and default export resolve the same way in
// Vite and in plain Node (the tests import this module directly).
import hyphenEnUs from "hyphen/en-us/index.js";
import { pageHyphenation } from "./lib/hyphenation.js";

// The bookshelf and photography pages write their Markdown from their data
// (lib/server/page-markdown.ts). That module reads the content collections
// through Vite, so it loads on first use rather than with this file.
const MARKDOWN_PAGES = new Set(["/bookshelf/", "/photography/"]);
/** @type {import("./lib/server/content-negotiation.js").PageMarkdown} */
const pageMarkdown = async (pathname) =>
  MARKDOWN_PAGES.has(pathname)
    ? (await import("./lib/server/page-markdown.ts")).pageMarkdown(pathname)
    : null;

// The paper launch page (/blog/who-wrote-this/) brings its own type (Inter) and never uses the site's Typekit face, so
// its HTML leaves out the Typekit preconnects and stylesheet. Every other page is unchanged.
const TAKEOVER = "/blog/who-wrote-this/";
const TYPEKIT = /[ \t]*(?:<noscript>)?<link[^>]*typekit\.net[^>]*>(?:<\/noscript>)?[ \t]*\r?\n?/g;

// A page's largest paint (the homepage portrait, the first photo) is declared
// in its <svelte:head> as a preload marked `data-hoist`. SvelteKit writes page
// head content after its ~25 module preloads, so on a slow link the image
// queued behind the scripts (the portrait took 1.9 s instead of 0.5 s). A copy
// goes near the top of <head>, ahead of the scripts; the original stays where
// Svelte hydrates it, and the browser fetches the URL once.
const HOISTED = /<link\b[^>]*\bdata-hoist\b[^>]*>/g;
// Going first in the head isn't enough, though: the head's ~25 script
// preloads are asked for in the same moment, and over a slow link (a phone on
// a weak signal, 1.6 Mbit/s) the live site often sent the image interleaved
// with them, whatever the image's priority: in 6 of 15 loads the portrait
// took over a second, behind up to 80 KB of script, and the first photo
// shared the line in every one. So on these pages the scripts' preloads move
// to the end of the body and are asked for once the HTML is in, by which time
// the image is well under way. Pages whose largest paint is text keep them in
// the head.
const MODULE_PRELOAD = /[ \t]*<link\b[^>]*\brel="modulepreload"[^>]*>\r?\n?/g;
// The justification engine's hyphenation for this page, worked out here (at
// build time: pages are prerendered) so the browser needn't download the
// pattern dictionary to justify it (see lib/hyphenation.js). Written after
// Svelte's root, outside anything it hydrates.
/** @param {string} html */
function withHyphenation(html) {
  const map = pageHyphenation(hyphenEnUs.hyphenateSync, html);
  if (!Object.keys(map).length) return html;
  const json = JSON.stringify(map).replace(/</g, "\\u003c");
  return html.replace(
    "</body>",
    `<script type="application/json" id="j-hyphens">${json}</script>\n</body>`,
  );
}

/** @param {string} html */
function hoistPreloads(html) {
  const links = html.match(HOISTED);
  if (!links) return html;
  const copies = links.map((link) => link.replace(/\s*data-hoist(?:="[^"]*")?/, ""));
  // After the viewport meta: an `imagesizes` read before it resolves against a
  // 980px desktop layout and fetches a desktop-sized file.
  return html.replace(/<meta name="viewport"[^>]*>/, (meta) => `${meta}\n  ${copies.join("\n  ")}`);
}

/** The whole page: on one that hoists an image, its script preloads move from the head to the end of the body.
 * @param {string} html */
function scriptsAfterImage(html) {
  if (!html.includes(" data-hoist")) return html;
  const links = html.match(MODULE_PRELOAD);
  if (!links) return html;
  const tags = links.map((link) => link.trim()).join("\n");
  return html.replace(MODULE_PRELOAD, "").replace("</body>", `${tags}\n</body>`);
}

export const handle = async ({ event, resolve }) => {
  // `/research/index.md` and friends: the page's Markdown at its own URL, for
  // agents that can't send `Accept: text/markdown` (llmstxt.org convention).
  const markdownPage = markdownTarget(event.url.pathname);
  if (markdownPage) {
    return cachePage(
      event.request,
      await serveMarkdownUrl(event.request, event.fetch, markdownPage, {
        pageMarkdown,
      }),
    );
  }

  const takeover = event.url.pathname.startsWith(TAKEOVER);
  const response = await resolve(event, {
    preload: ({ type }) => type === "font" || type === "js" || type === "css",
    transformPageChunk: ({ html, done }) => {
      const page = done && html.includes("</body>")
        ? withHyphenation(scriptsAfterImage(hoistPreloads(html)))
        : hoistPreloads(html);
      return takeover
        ? page.replace(TYPEKIT, "").replace(/[ \t]*<!-- Adobe Typekit[^>]*-->\r?\n?/, "")
        : page;
    },
  });

  return cachePage(
    event.request,
    await negotiateHtmlResponse(event.request, response, event.url, {
      pageMarkdown,
    }),
  );
};
