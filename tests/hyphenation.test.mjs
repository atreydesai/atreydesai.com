// Build-time hyphenation (src/lib/hyphenation.js): a page carries the breaks
// for the words the justification engine will see, so the browser needn't
// load the pattern dictionary. The map has to cover exactly those words (a
// miss loads the dictionary after all), and give the dictionary's breaks.
import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import test from "node:test";
import hyphen from "hyphen/en-us/index.js";

import { hyphenParts, pageHyphenation } from "../src/lib/hyphenation.js";

const { hyphenateSync } = hyphen;
const page = (body) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

test("words in running prose are mapped, with their breaks", () => {
  const map = pageHyphenation(hyphenateSync, page(`<main><p>Justification considers <em>typography</em> carefully.</p></main>`));
  assert.equal(map["Justification"], undefined, "capitalised words stay whole, so they aren't looked up");
  assert.equal(map["considers"], "con\u00adsid\u00aders");
  assert.equal(map["typography"], "ty\u00adpog\u00adra\u00adphy");
  // TeX's minimums: "ly." is only two letters, so no break before it.
  assert.equal(map["carefully."], "care\u00adfully.");
});

test("inline elements join a word; block elements separate words", () => {
  const map = pageHyphenation(hyphenateSync, page(`<ul><li>half<strong>-</strong>finished</li><li>wonderful<div>thinking</div></li></ul>`));
  assert.ok("half-finished" in map);
  assert.ok("wonderful" in map && "thinking" in map);
});

test("text the engine never justifies is left out", () => {
  const map = pageHyphenation(
    hyphenateSync,
    page(`<nav><p>navigation</p></nav><p data-justify="off">excluded</p><div data-justify="off"><p>everything</p></div>
      <p><button>clickable</button><span class="sr-only">screenreader</span> paragraph</p><div>outsideblock</div>
      <p><script>notscript</script></p><table><tr><td><p>tabulated</p></td></tr></table>`),
  );
  assert.deepEqual(Object.keys(map), ["paragraph"]);
});

test("a word with no break is still listed, so it never triggers the dictionary", () => {
  const map = pageHyphenation(hyphenateSync, page(`<p>strengths</p>`));
  assert.equal(map["strengths"], 0);
});

test("entities are decoded the way the browser shows the text", () => {
  const map = pageHyphenation(hyphenateSync, page(`<p>don&rsquo;t&nbsp;overthink quotation&#39;s</p>`));
  assert.ok("don’t overthink" in map);
  assert.ok("quotation's" in map);
});

test("the breaks are the dictionary's, with TeX's minimums", () => {
  for (const word of ["hyphenation", "algorithm", "understanding", "possibilities", "a-priori-ish"]) {
    const parts = hyphenParts(hyphenateSync, word);
    assert.equal(parts.join(""), word);
    for (const [i, part] of parts.entries()) {
      if (i > 0) assert.ok(parts.slice(0, i).join("").match(/\p{L}/gu).length >= 2);
      if (i < parts.length - 1) assert.ok(parts.slice(i + 1).join("").match(/\p{L}/gu)?.length ?? 0 >= 3, `${word}: ${parts}`);
    }
  }
});

test("prerendered pages carry their hyphenation", { skip: !(await access(new URL("../.vercel/output/static/cv/index.html", import.meta.url)).then(() => true, () => false)) && "no build output" }, async () => {
  // Pages of running prose; the blog index is a list of links, with little.
  for (const path of ["index.html", "about/index.html", "cv/index.html"]) {
    const html = await readFile(new URL(`../.vercel/output/static/${path}`, import.meta.url), "utf8");
    const json = html.match(/<script type="application\/json" id="j-hyphens">(.*?)<\/script>/s)?.[1];
    assert.ok(json, `${path} has no hyphenation map`);
    const map = JSON.parse(json);
    assert.ok(Object.keys(map).length > 20, `${path}: ${Object.keys(map).length} words`);
    for (const [word, parts] of Object.entries(map)) {
      const expected = hyphenParts(hyphenateSync, word);
      assert.equal(parts === 0 ? word : parts.replaceAll("\u00ad", "|"), expected.join("|"), word);
    }
  }
  // The paper launch page opts out of justification entirely.
  const wwt = await readFile(new URL("../.vercel/output/static/blog/who-wrote-this/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(wwt, /id="j-hyphens"/);
});
