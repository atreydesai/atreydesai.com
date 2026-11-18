import type { LayoutLoad } from "./$types";

// Every page is a pure function of the repository at build time, so every
// page is built into a static file and no request ever waits on a render. The
// build enforces that: prerendering fails on a page that reads the request
// (its query string, headers, or cookies). Each page's Markdown twin
// (/…/index.md) is prerendered alongside it, and the route table sends
// `Accept: text/markdown` requests to it (see vercel-output.js). The
// development-only /dev pages opt out.
export const prerender = true;
export const ssr = true;
export const trailingSlash = "always";

export const load: LayoutLoad = async ({ url }) => {
  return { pathname: url.pathname };
};
