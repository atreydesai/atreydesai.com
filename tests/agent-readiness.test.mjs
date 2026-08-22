import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { handle } from "../src/hooks.server.js";
import {
  appendVary,
  htmlToMarkdown,
  preferredType,
} from "../src/lib/server/content-negotiation.js";
import {
  PERSON_DESCRIPTION,
  personStructuredData,
} from "../src/lib/structured-data.js";

const root = new URL("../", import.meta.url);

function htmlResponse(status = 200) {
  return new Response(
    `<!doctype html>
    <html>
      <head><title>Atrey Desai</title><script>window.noise = true</script></head>
      <body>
        <nav>site chrome</nav>
        <main id="main-content">
          <h1>Atrey Desai</h1>
          <h2>Research</h2>
          <p>Research on trustworthy language models and benchmark evaluation.</p>
          <a href="/research/">Selected work</a>
          <script>window.hydrate = true</script>
        </main>
        <footer>footer chrome</footer>
      </body>
    </html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ETag: '"html-response"',
        Link: "</_app/start.js>; rel=modulepreload",
      },
    },
  );
}

async function runHandle(accept, response = htmlResponse(), pathname = "/") {
  const headers = accept === undefined ? {} : { Accept: accept };
  const request = new Request(`https://atreydesai.com${pathname}`, { headers });
  return handle({
    event: { request, url: new URL(request.url) },
    resolve: async (_event, options) => {
      assert.equal(options.preload({ type: "js" }), true);
      return response;
    },
  });
}

test("Accept negotiation honors q-values, specificity, wildcards, and rejections", () => {
  assert.equal(preferredType(null), "text/html");
  assert.equal(preferredType("*/*"), "text/html");
  assert.equal(preferredType("text/markdown"), "text/markdown");
  assert.equal(
    preferredType("text/html;q=0.8, text/markdown;q=1"),
    "text/markdown",
  );
  assert.equal(
    preferredType("text/markdown;q=0.5, text/html;q=0.9"),
    "text/html",
  );
  assert.equal(preferredType("text/*;q=0.4, text/markdown;q=0"), "text/html");
  assert.equal(preferredType("text/markdown;q=0"), null);
  assert.equal(preferredType("application/pdf"), null);
});

test("Vary preserves existing cache keys and adds Accept exactly once", () => {
  const headers = new Headers({ Vary: "Origin, Accept-Encoding" });
  appendVary(headers);
  appendVary(headers);
  assert.equal(headers.get("vary"), "Origin, Accept-Encoding, Accept");
});

test("HTML pages remain server-rendered and advertise the agent guide", async () => {
  const response = await runHandle("text/html");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(response.headers.get("vary"), /Accept/);
  assert.equal(response.headers.get("etag"), '"html-response"');
  assert.match(response.headers.get("vary"), /Accept-Encoding/);
  assert.match(response.headers.get("link"), /llms\.txt/);
  assert.match(response.headers.get("link"), /modulepreload/);
  assert.match(await response.text(), /<h1>Atrey Desai<\/h1>/);
});

test("canonical page URLs return clean Markdown when requested", async () => {
  const response = await runHandle("text/markdown, text/html;q=0.8");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assert.match(response.headers.get("vary"), /Accept/);
  assert.equal(response.headers.get("etag"), null);
  assert.match(body, /^# Atrey Desai/m);
  assert.match(body, /^## Research/m);
  assert.match(body, /https:\/\/atreydesai\.com\/research\//);
  assert.doesNotMatch(body, /window\.|site chrome|footer chrome/);
});

test("unsupported representations receive 406 without touching non-HTML endpoints", async () => {
  const rejected = await runHandle("application/pdf");
  assert.equal(rejected.status, 406);
  assert.equal(
    rejected.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  assert.match(rejected.headers.get("vary"), /Accept/);

  const json = new Response('{"ok":true}', {
    headers: { "Content-Type": "application/json" },
  });
  const untouched = await runHandle("application/json", json, "/api/now");
  assert.equal(untouched.status, 200);
  assert.equal(untouched.headers.get("vary"), null);
  assert.deepEqual(await untouched.json(), { ok: true });
});

test("missing pages keep HTTP 404 and give Markdown clients recovery links", async () => {
  const response = await runHandle(
    "text/markdown",
    htmlResponse(404),
    "/missing-agent-page",
  );
  const body = await response.text();
  assert.equal(response.status, 404);
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assert.match(body, /^# 404: Page not found/m);
  assert.match(body, /sitemap\.xml/);
  assert.match(body, /llms\.txt/);
  assert.match(body, /\/research\//);
});

test("HTML conversion keeps the main semantic outline and omits document chrome", () => {
  const markdown = htmlToMarkdown(
    '<nav>skip</nav><main><h1>Title</h1><h2>Section</h2><p>Useful <a href="/research/">prose</a>.</p></main><footer>skip</footer>',
    "http://127.0.0.1:4173/about/",
  );
  assert.match(markdown, /^# Title/m);
  assert.match(markdown, /^## Section/m);
  assert.doesNotMatch(markdown, /skip/);
  assert.match(markdown, /Source:.*\/about\//);
  assert.match(markdown, /https:\/\/atreydesai\.com\/research\//);
});

test("llms.txt follows the llms.txt outline and includes specific when-to-use guidance", async () => {
  const content = await readFile(new URL("static/llms.txt", root), "utf8");
  assert.match(content, /^# Atrey Desai\n\n> /);
  assert.match(content, /^## When to use this site$/m);
  assert.match(content, /^## How agents should access the site$/m);
  assert.match(content, /Accept: text\/markdown/);
  assert.match(content, /sitemap\.xml/);

  const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
  assert.ok(links.length >= 10);
  assert.ok(links.every((link) => /^(?:https:\/\/|mailto:)/.test(link)));
});

test("Person JSON-LD exposes required identity fields and type-appropriate links", () => {
  const data = personStructuredData({
    imageUrl: "https://atreydesai.com/og-image.jpg",
  });
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "Person");
  assert.equal(data.name, "Atrey Desai");
  assert.equal(data.description, PERSON_DESCRIPTION);
  assert.equal(data.url, "https://atreydesai.com/");
  assert.ok(data.sameAs.length >= 3);
  assert.ok(
    data.affiliation.some((entry) => entry.name === "University of Maryland"),
  );
});

test("homepage routes opt into SSR instead of static prerendering", async () => {
  const layout = await readFile(new URL("src/routes/+layout.ts", root), "utf8");
  assert.match(layout, /export const prerender = false/);
  assert.match(layout, /export const ssr = true/);
});

test("deployment and page metadata advertise machine-readable recovery resources", async () => {
  const [vercelText, seo, errorPage] = await Promise.all([
    readFile(new URL("vercel.json", root), "utf8"),
    readFile(new URL("src/lib/components/Seo.svelte", root), "utf8"),
    readFile(new URL("src/routes/+error.svelte", root), "utf8"),
  ]);
  const vercel = JSON.parse(vercelText);
  const llmsHeaders = vercel.headers.find(
    (entry) => entry.source === "/llms.txt",
  ).headers;
  assert.ok(
    llmsHeaders.some(
      (header) =>
        header.key === "Content-Type" &&
        header.value === "text/plain; charset=utf-8",
    ),
  );
  assert.match(seo, /rel="alternate" type="text\/markdown"/);
  assert.match(seo, /rel="describedby" type="text\/plain" href="\/llms\.txt"/);
  assert.match(errorPage, /noindex=\{true\}/);
  assert.match(errorPage, /href="\/sitemap\.xml"/);
  assert.match(errorPage, /href="\/llms\.txt"/);
});
