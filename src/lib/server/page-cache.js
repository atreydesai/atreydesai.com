// Pages render the same bytes for everyone until the next deploy (live data
// such as /api/now loads in the browser, and relative times are computed
// there), so Vercel's CDN can serve them instead of running a function on
// every view. A new deployment starts with an empty cache, so the CDN may
// keep a page for as long as it likes: a shorter lifetime only sends a quiet
// page's next visitor back to a cold render for bytes that cannot have
// changed. The CDN keys on Accept, so HTML and Markdown are cached
// separately. This header stays at Vercel: browsers keep revalidating.
export const PAGE_CDN_CACHE = "max-age=31536000";

const PAGE_TYPES = /^text\/(?:html|markdown)\b/i;

/** @param {Request} request @param {Response} response */
export function cachePage(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (response.status !== 200 && response.status !== 404) return response;
  if (!PAGE_TYPES.test(response.headers.get("content-type") ?? ""))
    return response;
  if (response.headers.has("set-cookie")) return response;
  if (
    /\b(?:private|no-store|no-cache)\b/i.test(
      response.headers.get("cache-control") ?? "",
    )
  )
    return response;
  if (!response.headers.has("vercel-cdn-cache-control"))
    response.headers.set("Vercel-CDN-Cache-Control", PAGE_CDN_CACHE);
  return response;
}
