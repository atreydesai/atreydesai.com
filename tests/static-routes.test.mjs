// The site is built, not served: every page is a static file, and the route
// table decides who gets a page's Markdown instead of the server hook. These
// tests hold that design to account:
//
// - the route table's Accept rule gives the hook's answer (preferredType) for
//   every header in a corpus of real ones, except the differences listed
//   below, and never hands a browser or crawler Markdown;
// - the build output has a Markdown twin and headers for every page, its
//   rules sit ahead of Vercel's filesystem step, and every post is built.
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { load } from "js-yaml";

import { preferredType } from "../src/lib/server/content-negotiation.js";
import {
  MARKDOWN_ACCEPT_RULES,
  routeServesMarkdown,
  staticRoutes,
} from "../src/lib/server/static-routes.js";
import { params } from "../src/params.ts";

const root = new URL("../", import.meta.url);
const exists = (url) => access(url).then(() => true, () => false);

// What real clients send. Browsers and crawlers never mention Markdown.
const BROWSERS_AND_CRAWLERS = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "*/*",
  "text/*",
  "",
];

const AGENTS_AND_EDGES = [
  "text/markdown",
  "text/markdown, text/html",
  "text/markdown, text/html;q=0.9, */*;q=0.8",
  "text/markdown;q=1.0, text/html;q=0.9",
  "text/markdown, */*",
  "text/markdown,text/html,*/*",
  "text/html, text/markdown",
  "text/html,text/markdown;q=0.9",
  "text/html;q=0.9, text/markdown",
  "text/html;q=0.5, */*;q=0.1, text/markdown",
  "*/*, text/markdown",
  "*/*;q=0.8, text/markdown",
  "text/*, text/markdown",
  "text/plain, text/markdown",
  "application/json, text/markdown",
  "text/markdown, application/json",
  "text/markdown;q=0.5",
  "text/markdown;q=0.5, text/html",
  "text/markdown;q=0.5, */*",
  "text/x-markdown, text/html",
  "text/markdown;q=0",
  "text/markdown;q=0.0, text/plain",
  "application/json",
  // Known differences, listed in KNOWN_DIFFERENCES.
  "text/markdown;q=0.9, text/html;q=0.5",
  "TEXT/MARKDOWN",
];

// Where the route table and the hook part ways, and why that's acceptable:
// a weighting no real client sends, and an uppercase type. (Headers that
// accept neither type, which the hook refused with 406, agree here: neither
// serves Markdown; the static site answers them with the HTML.)
const KNOWN_DIFFERENCES = new Map([
  ["text/markdown;q=0.9, text/html;q=0.5", "both weighted: the hook compares the weights, the route only reads full weight"],
  ["TEXT/MARKDOWN", "the route matches lowercase types"],
]);

for (const partial of [false, true]) {
  const reading = partial ? "as unanchored searches" : "as full matches";

  test(`the Accept rule agrees with the hook ${reading}`, () => {
    const disagree = [];
    for (const accept of [...BROWSERS_AND_CRAWLERS, ...AGENTS_AND_EDGES]) {
      const hook = preferredType(accept || null) === "text/markdown";
      const route = routeServesMarkdown(accept || null, { partial });
      if (hook !== route) disagree.push(accept);
    }
    assert.deepEqual(disagree.sort(), [...KNOWN_DIFFERENCES.keys()].sort());
  });

  test(`no browser or crawler is ever routed to Markdown, ${reading}`, () => {
    for (const accept of BROWSERS_AND_CRAWLERS) {
      assert.equal(routeServesMarkdown(accept, { partial }), false, accept);
    }
    assert.equal(routeServesMarkdown(null, { partial }), false);
  });
}

test("the Accept rule uses no lookaround, so any regex engine reads it the same", () => {
  for (const rule of MARKDOWN_ACCEPT_RULES) {
    for (const pattern of [rule.has, ...rule.missing]) {
      assert.doesNotMatch(pattern, /\(\?[=!<]/, pattern);
    }
  }
});

test("routes rewrite each page's Markdown request to its twin", () => {
  const { routes, overrides } = staticRoutes(["/", "/research/", "/blog/prose-diff/"]);
  const rewrites = routes.filter((route) => route.dest);
  assert.equal(rewrites.length, MARKDOWN_ACCEPT_RULES.length);
  for (const route of rewrites) {
    const src = new RegExp(route.src);
    assert.equal("/research/".replace(src, route.dest), "/research/index.md");
    assert.equal("/".replace(src, route.dest), "/index.md");
    assert.equal(src.test("/research"), false);
    assert.equal(src.test("/images/"), false);
  }
  assert.deepEqual(Object.keys(overrides).sort(), [
    "blog/prose-diff/index.md",
    "index.md",
    "research/index.md",
  ]);
});

test("a post slug never matches a file name, so /blog/index.md reaches the hook", () => {
  const validate = (value) => params.post["~standard"].validate(value);
  assert.equal(validate("prose-diff").value, "prose-diff");
  assert.ok(validate("index.md").issues);
  assert.ok(validate("Index").issues);
});

// The rest reads the build output, when there is one (`npx vite build`).
const output = new URL(".vercel/output/", root);
const config = (await exists(new URL("config.json", output)))
  ? JSON.parse(await readFile(new URL("config.json", output), "utf8"))
  : null;
const built = config?.routes.some((route) => route.dest === "$1index.md");

test("the build serves every page statically, with its twin and headers", { skip: !built && "no build output" }, async () => {
  const filesystem = config.routes.findIndex((route) => route.handle === "filesystem");
  const rewrites = config.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.dest === "$1index.md");
  assert.equal(rewrites.length, MARKDOWN_ACCEPT_RULES.length);
  // Ahead of the filesystem step and of the adapter's own page routes.
  const firstPageRoute = config.routes.findIndex((route) => route.src === "/about/");
  for (const { index } of rewrites) {
    assert.ok(index < filesystem && index < firstPageRoute, `rewrite at ${index}`);
  }

  const pages = Object.entries(config.overrides)
    .filter(([file]) => file.endsWith(".html"))
    .map(([file]) => `/${file.replace(/index\.html$/, "")}`);
  assert.ok(pages.length >= 10, `only ${pages.length} prerendered pages`);
  for (const page of pages) {
    const twin = `${page}index.md`.slice(1);
    assert.ok(await exists(new URL(`static/${twin}`, output)), `no twin for ${page}`);
    assert.equal(config.overrides[twin]?.contentType, "text/markdown; charset=utf-8");
    assert.ok(
      config.routes.some((route) => route.src === `^${page.replace(/[.]/g, "\\.")}$` && route.headers?.Vary),
      `no headers for ${page}`,
    );
  }

  // Only the API, the development pages, and the not-found fallback remain
  // functions.
  const functions = (await readdir(new URL("functions/", output))).filter((name) => !name.endsWith(".func"));
  assert.deepEqual(functions.sort(), ["![-]", "api", "dev"]);
});

test("every published post is built, linked from a listing or not", { skip: !built && "no build output" }, async () => {
  const dir = new URL("src/content/posts/", root);
  for (const file of await readdir(dir)) {
    const source = await readFile(new URL(file, dir), "utf8");
    const meta = load(source.split(/^---$/m)[1]);
    if (meta.published === false || meta.externalUrl) continue;
    const page = new URL(`static/blog/${meta.id}/index.html`, output);
    assert.ok(await exists(page), `/blog/${meta.id}/ was not prerendered`);
  }
});
