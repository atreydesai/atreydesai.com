import { negotiateHtmlResponse } from "./lib/server/content-negotiation.js";

// The paper launch page (/blog/who-wrote-this/) brings its own type (Inter) and never uses the site's Typekit face, so
// its HTML leaves out the Typekit preconnects and stylesheet. Every other page is unchanged.
const TAKEOVER = "/blog/who-wrote-this/";
const TYPEKIT = /[ \t]*(?:<noscript>)?<link[^>]*typekit\.net[^>]*>(?:<\/noscript>)?[ \t]*\r?\n?/g;

export const handle = async ({ event, resolve }) => {
  const takeover = event.url.pathname.startsWith(TAKEOVER);
  const response = await resolve(event, {
    preload: ({ type }) => type === "font" || type === "js" || type === "css",
    ...(takeover ? { transformPageChunk: ({ html }) => html.replace(TYPEKIT, "").replace(/[ \t]*<!-- Adobe Typekit[^>]*-->\r?\n?/, "") } : {}),
  });

  return negotiateHtmlResponse(event.request, response, event.url);
};
