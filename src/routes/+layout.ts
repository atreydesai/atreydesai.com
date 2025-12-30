import { dev } from "$app/environment";
import { injectAnalytics } from "@vercel/analytics/sveltekit";
import type { LayoutLoad } from "./$types";

injectAnalytics({ mode: dev ? "development" : "production" });

export const prerender = true;
export const trailingSlash = "always";

export const load: LayoutLoad = async ({ url }) => {
  return { pathname: url.pathname };
};
