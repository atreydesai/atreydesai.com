import type { LayoutLoad } from "./$types";

// Page requests must reach the server hook so the canonical URL can negotiate
// HTML or Markdown. Svelte still server-renders complete HTML for browsers and
// crawlers; XML feeds and the sitemap opt into prerendering independently.
export const prerender = false;
export const ssr = true;
export const trailingSlash = "always";

export const load: LayoutLoad = async ({ url }) => {
  return { pathname: url.pathname };
};
