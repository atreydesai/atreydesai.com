import TurndownService from "turndown";

const SITE_URL = "https://atreydesai.com";
const PRODUCES = ["text/html", "text/markdown"];
const AGENT_GUIDE_LINK = `<${SITE_URL}/llms.txt>; rel="describedby"; type="text/plain"`;

/** @typedef {{ type: string, q: number, specificity: number, position: number }} AcceptEntry */

/**
 * Parse an RFC 9110 Accept field into media ranges relevant to proactive
 * negotiation. Invalid q-values retain the protocol default of 1.
 *
 * @param {string} header
 * @returns {AcceptEntry[]}
 */
export function parseAccept(header) {
  return header
    .split(",")
    .map((raw, position) => {
      const parts = raw
        .trim()
        .split(";")
        .map((part) => part.trim());
      const type = (parts[0] ?? "").toLowerCase();
      if (!type) return null;

      let q = 1;
      for (const parameter of parts.slice(1)) {
        const [rawName, rawValue] = parameter
          .split("=")
          .map((part) => part.trim());
        if (rawName?.toLowerCase() !== "q") continue;
        const parsed = Number(rawValue);
        if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
      }

      const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
      return { type, q, specificity, position };
    })
    .filter((entry) => entry !== null);
}

/** @param {AcceptEntry} entry @param {string} candidate */
function matches(entry, candidate) {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*"))
    return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * Choose the representation preferred by an Accept field. Candidate order is
 * the server preference when the client supplies no preference (HTML first).
 *
 * @param {string | null} header
 * @param {string[]} [produces]
 * @returns {string | null}
 */
export function preferredType(header, produces = PRODUCES) {
  if (!header) return produces[0] ?? null;
  const entries = parseAccept(header);
  if (entries.length === 0) return produces[0] ?? null;

  let bestType = null;
  let bestQ = -1;
  let bestPosition = Infinity;

  for (const candidate of produces) {
    /** @type {AcceptEntry | null} */
    let matched = null;

    for (const entry of entries) {
      if (!matches(entry, candidate)) continue;
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity &&
          entry.position < matched.position)
      ) {
        matched = entry;
      }
    }

    if (!matched || matched.q <= 0) continue;
    if (
      matched.q > bestQ ||
      (matched.q === bestQ && matched.position < bestPosition)
    ) {
      bestType = candidate;
      bestQ = matched.q;
      bestPosition = matched.position;
    }
  }

  return bestType;
}

/**
 * Merge cache-key headers without duplicating existing values.
 *
 * @param {Headers} headers
 * @param {string[]} [values]
 */
export function appendVary(headers, values = ["Accept", "Accept-Encoding"]) {
  const existing = headers.get("vary");
  const tokens = existing
    ? existing
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
    : [];
  const lower = new Set(tokens.map((token) => token.toLowerCase()));

  for (const value of values) {
    if (!lower.has(value.toLowerCase())) {
      tokens.push(value);
      lower.add(value.toLowerCase());
    }
  }

  headers.set("Vary", tokens.join(", "));
}

/** @param {Headers} headers @param {string} value */
function appendLink(headers, value) {
  const existing = headers.get("link");
  headers.set("Link", existing ? `${existing}, ${value}` : value);
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Interactive and decorative elements do not contribute to the page's prose.
turndown.remove(["script", "style", "noscript", "template", "button"]);

/** @param {string} value @param {URL} base */
function absoluteUrl(value, base) {
  if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(value)) return value;
  try {
    return new URL(value, value.startsWith("/") ? SITE_URL : base).toString();
  } catch {
    return value;
  }
}

/** @param {string} html @param {URL} canonical */
function absolutizeLinks(html, canonical) {
  return html.replace(
    /\b(href|src)=(['"])(.*?)\2/gi,
    (_match, attribute, quote, value) =>
      `${attribute}=${quote}${absoluteUrl(value, canonical)}${quote}`,
  );
}

/**
 * Convert the server-rendered main landmark to a clean CommonMark response.
 * Navigation, scripts, styles, and hydration payloads are intentionally left
 * out so agents receive the same primary content at a much lower token cost.
 *
 * @param {string} html
 * @param {URL | string} canonical
 */
export function htmlToMarkdown(html, canonical) {
  const canonicalUrl =
    canonical instanceof URL ? canonical : new URL(canonical, SITE_URL);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const prose = main.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
  const markdown = turndown
    .turndown(absolutizeLinks(prose, canonicalUrl))
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sourceUrl = new URL(canonicalUrl.pathname, SITE_URL).toString();
  return `${markdown}\n\n---\n\nSource: [${sourceUrl}](${sourceUrl})  \nAgent guide: [${SITE_URL}/llms.txt](${SITE_URL}/llms.txt)\n`;
}

/** @param {URL | string} requested */
export function markdownNotFound(requested) {
  const requestedUrl =
    requested instanceof URL ? requested : new URL(requested, SITE_URL);
  return `# 404: Page not found

No page exists at \`${requestedUrl.pathname}\`.

- [Home](${SITE_URL}/)
- [Research](${SITE_URL}/research/)
- [Blog](${SITE_URL}/blog/)
- [Site map](${SITE_URL}/sitemap.xml)
- [Agent instructions](${SITE_URL}/llms.txt)
`;
}

/**
 * Negotiate only responses SvelteKit has identified as HTML pages. Other
 * public endpoints retain their own media types and behavior.
 *
 * @param {Request} request
 * @param {Response} response
 * @param {URL} url
 */
export async function negotiateHtmlResponse(request, response, url) {
  if (
    !response.headers.get("content-type")?.toLowerCase().includes("text/html")
  ) {
    return response;
  }

  const accept = request.headers.get("accept");
  const chosen = preferredType(accept);

  if (chosen === null && accept) {
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
    });
    appendVary(headers);
    return new Response(
      request.method === "HEAD"
        ? null
        : "Not Acceptable\n\nAvailable: text/html, text/markdown\n",
      {
        status: 406,
        headers,
      },
    );
  }

  if (chosen !== "text/markdown") {
    appendVary(response.headers);
    response.headers.set("Content-Type", "text/html; charset=utf-8");
    appendLink(response.headers, AGENT_GUIDE_LINK);
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Link", AGENT_GUIDE_LINK);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  appendVary(headers);

  let body = null;
  if (request.method !== "HEAD") {
    body =
      response.status === 404
        ? markdownNotFound(url)
        : htmlToMarkdown(await response.text(), url);
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
