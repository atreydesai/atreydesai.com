import assert from "node:assert/strict";
import test from "node:test";

import { diffDocuments, opcodes, renderDocument } from "../src/lib/prose-diff/engine.js";
import { groupDocuments } from "../src/lib/prose-diff/sources.js";
import { squigglePath } from "../src/lib/prose-diff/squiggle.ts";

// Expected HTML below is the output of the original Python prose-diff-viewer,
// which the engine reproduces exactly.

test("an edit inside a paragraph is marked word by word", () => {
  const result = diffDocuments(
    "It was a *dark* night, and the rain fell.",
    "It was a *dark and stormy* night, and the rain fell hard.",
  );
  assert.equal(
    result.html,
    '<div class="change" id="chg-1"><p>It was a <del><em>dark</em></del> <ins><em>dark and stormy</em></ins> night, and the rain <del>fell.</del> <ins>fell hard.</ins></p></div>',
  );
  assert.deepEqual(result.changes, [
    { id: "chg-1", excerpt: "It was a *dark and stormy* night, and the rain fell hard.", kind: "edited" },
  ]);
  assert.equal(result.wordsAdded, 5);
  assert.equal(result.wordsRemoved, 2);
});

test("unchanged blocks render plainly between changed ones", () => {
  const result = diffDocuments("Kept.\n\nCut entirely.\n\n* * *", "Kept.\n\nBrand new.\n\n* * *\n\nAdded at the end.");
  assert.equal(
    result.html,
    [
      "<p>Kept.</p>",
      '<div class="change" id="chg-1"><p><del>Cut entirely.</del> <ins>Brand new.</ins></p></div>',
      "<hr>",
      '<div class="change" id="chg-2"><p><ins>Added at the end.</ins></p></div>',
    ].join("\n"),
  );
  assert.deepEqual(
    result.changes.map((change) => change.kind),
    ["edited", "added"],
  );
});

test("a paragraph split carries its break into the diff", () => {
  const result = diffDocuments(
    "# Chapter One\n\nShe left the house at dawn. Nobody saw her go.",
    "# Chapter 1\n\nShe left the house before dawn.\n\nNobody saw her go.",
  );
  assert.equal(
    result.html,
    '<div class="change" id="chg-1"><p>Chapter <del>One</del> <ins>1</ins></p><p>She left the house <del>at</del> <ins>before</ins> dawn.</p><p>Nobody saw her go.</p></div>',
  );
});

test("clean read drops deleted words and the paragraph breaks inside them", () => {
  const result = diffDocuments("A B\n\nC D", "A D", { showDeletions: false });
  assert.equal(result.html, '<div class="change" id="chg-1"><p>A D</p></div>');
  assert.equal(result.wordsRemoved, 2);

  const removed = diffDocuments("Kept.\n\nGone.", "Kept.", { showDeletions: false });
  assert.equal(removed.html, '<p>Kept.</p>\n<div class="change" id="chg-1"></div>');
  assert.equal(removed.changes[0].kind, "removed");
});

test("headings can be demoted below the page's own title", () => {
  assert.equal(renderDocument("# One\n\n###### Six", { headingShift: 1 }), "<h2>One</h2>\n<h6>Six</h6>");
  const edited = diffDocuments("## Old title", "## New title", { headingShift: 1 });
  assert.equal(edited.html, '<div class="change" id="chg-1"><h3><del>Old</del> <ins>New</ins> title</h3></div>');
});

test("whitespace-only edits and CRLF line endings are not changes", () => {
  const result = diffDocuments("One  line\nwrapped.\r\n\r\nNext.", "One line wrapped.\n\n\n\nNext.");
  assert.deepEqual(result.changes, []);
  assert.equal(result.html, "<p>One line wrapped.</p>\n<p>Next.</p>");
});

test("markup in the source is escaped", () => {
  assert.equal(renderDocument("x < y & <b>z</b>"), "<p>x &lt; y &amp; &lt;b&gt;z&lt;/b&gt;</p>");
});

test("opcodes match difflib's longest-match recursion", () => {
  assert.deepEqual(opcodes("abxcd".split(""), "abcd".split("")), [
    ["equal", 0, 2, 0, 2],
    ["delete", 2, 3, 2, 2],
    ["equal", 3, 5, 2, 4],
  ]);
  assert.deepEqual(opcodes("qabxcd".split(""), "abycdf".split("")), [
    ["delete", 0, 1, 0, 0],
    ["equal", 1, 3, 0, 2],
    ["replace", 3, 4, 2, 3],
    ["equal", 4, 6, 3, 5],
    ["insert", 6, 6, 5, 6],
  ]);
});

test("revision snapshots group by document, in time order, with the working copy last", () => {
  const docs = groupDocuments([
    "book/revision_snapshots/chapter_01/chapter_01.0002.20260705T101500Z.after_revise.md",
    "book/revision_snapshots/chapter_01/chapter_01.0001.20260705T092714Z.before_revise.md",
    "book/chapters/chapter_01.md",
    "book/exports/chapter_01.md",
    "book/revision_snapshots/chapter_02/chapter_02.0001.20260706T080000Z.draft.md",
    "book/.git/chapter_02.md",
    "book/cover.png",
  ]);
  assert.deepEqual(
    docs.map((doc) => doc.title),
    ["chapter 01"],
  );
  assert.deepEqual(
    docs[0].versions.map((version) => version.label),
    ["#1 before_revise", "#2 after_revise", "current working copy"],
  );
  assert.equal(docs[0].versions[2].path, "book/chapters/chapter_01.md");
  assert.equal(docs[0].versions[0].detail, "2026-07-05 09:27 UTC");
});

test("loose drafts group by folder in natural order", () => {
  const docs = groupDocuments(["essay/draft-10.md", "essay/draft-2.md", "essay/draft-1.md", "other/solo.md"]);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].title, "essay");
  assert.deepEqual(
    docs[0].versions.map((version) => version.label),
    ["draft-1.md", "draft-2.md", "draft-10.md"],
  );

  const scattered = groupDocuments(["a/one.md", "b/two.txt"]);
  assert.deepEqual(
    scattered.map((doc) => doc.versions.length),
    [2],
  );
  assert.deepEqual(groupDocuments(["only.md", "image.png"]), []);
});

test("a passage's squiggle is stable, fills its height, and stays in its box", () => {
  const path = squigglePath(240, "chg-2 I would describe myself", 10);
  assert.equal(path, squigglePath(240, "chg-2 I would describe myself", 10));
  assert.notEqual(path, squigglePath(240, "chg-3 I was born", 10));

  const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  // Control points may bow a little past the line itself, never far.
  assert.ok(Math.min(...xs) > -2 && Math.max(...xs) < 12);
  assert.ok(Math.min(...ys) > -3 && Math.max(...ys) < 243);
  // The line itself runs the passage's full height.
  const ends = path.match(/(?:^M|\s)(-?[\d.]+) (-?[\d.]+)(?=C|$)/g).map((pair) => Number(pair.trim().split(" ")[1]));
  assert.equal(Math.min(...ends), 0);
  assert.equal(Math.max(...ends), 240);
});
