// What a slow link carries first. A page whose largest paint is an image (the
// homepage portrait, the first photo) asks for that image first thing in its
// head and for its scripts only after its HTML (hooks.server.js), so the two
// don't share the line; a page whose largest paint is text keeps its script
// preloads in the head. On the photography page the lazy tiles wait until the
// page has started and the first photo is in, held by a script that runs
// before the grid is read.
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const STATIC = new URL("../.vercel/output/static/", import.meta.url);
const built = await access(new URL("index.html", STATIC)).then(() => true, () => false);
const page = (path) => readFile(new URL(`${path}index.html`, STATIC), "utf8");

test("pages led by an image ask for it before their scripts", { skip: !built && "no build output" }, async () => {
  for (const path of ["", "photography/"]) {
    const html = await page(path);
    const head = html.slice(0, html.indexOf("</head>"));
    const image = head.search(/<link rel="preload" as="image"/);
    assert.ok(image >= 0, `/${path}: no image preload in the head`);
    assert.doesNotMatch(head, /rel="modulepreload"/, `/${path}: script preloads still in the head`);
    const body = html.slice(html.indexOf("</head>"));
    const scripts = body.match(/<link\b[^>]*rel="modulepreload"[^>]*>/g) ?? [];
    assert.ok(scripts.length >= 10, `/${path}: only ${scripts.length} script preloads after the content`);
    assert.ok(body.lastIndexOf("modulepreload") < body.indexOf("</body>"), `/${path}: script preloads after </body>`);
  }
});

test("pages led by text keep their script preloads in the head", { skip: !built && "no build output" }, async () => {
  for (const path of ["research/", "blog/", "blog/who-wrote-this/"]) {
    const html = await page(path);
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /rel="modulepreload"/, `/${path}: script preloads left the head`);
  }
});

test("the photography page holds its lazy tiles until the first photo", { skip: !built && "no build output" }, async () => {
  const html = await page("photography/");
  const hold = html.indexOf(`classList.add("photos-held")`);
  const grid = html.indexOf(`class="photo-grid `); // (the grid itself, then Svelte's scoping class)
  assert.ok(hold >= 0 && grid >= 0 && hold < grid, "the hold script runs before the grid is read");
  assert.match(html, /photos-held \.photo-grid img\[loading=lazy\]:not\(\[data-first-screen\]\)\{display:none\}/, "the hold only hides lazy tiles past the first screen");
  // The tiles on the first screen are marked, off the hold, once the grid is read.
  const mark = html.indexOf(`setAttribute("data-first-screen"`);
  assert.ok(mark > grid, "the first screen is marked after the grid is read");
  // The page lets the rest go once the first photo is in, so that one isn't held.
  const first = html.slice(grid).match(/<img\b[^>]*>/)[0];
  assert.match(first, /fetchpriority="high"/);
  assert.match(first, /loading="eager"/);
});
