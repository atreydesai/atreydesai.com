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
      const page = done && html.includes("</body>") ? withHyphenation(hoistPreloads(html)) : hoistPreloads(html);
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
