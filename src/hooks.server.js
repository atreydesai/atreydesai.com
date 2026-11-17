import {
  markdownTarget,
  negotiateHtmlResponse,
  serveMarkdownUrl,
} from "./lib/server/content-negotiation.js";
import { cachePage } from "./lib/server/page-cache.js";

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
    ...(takeover ? { transformPageChunk: ({ html }) => html.replace(TYPEKIT, "").replace(/[ \t]*<!-- Adobe Typekit[^>]*-->\r?\n?/, "") } : {}),
  });

  return cachePage(
    event.request,
    await negotiateHtmlResponse(event.request, response, event.url, {
      pageMarkdown,
    }),
  );
};
