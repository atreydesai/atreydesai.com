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

// Smart mode and comments go beyond the Python tool, so these expectations
// are this engine's own.

test("smart mode folds fragments stranded between rewrites", () => {
  const oldText = "Models preferred one label and underperformed against trained detectors in every test.";
  const newText = "Chatbots favored a single label and lagged far behind trained classifiers in every test.";
  assert.equal(
    diffDocuments(oldText, newText).html,
    '<div class="change" id="chg-1"><p><del>Models preferred one</del> <ins>Chatbots favored a single</ins> label and <del>underperformed against</del> <ins>lagged far behind</ins> trained <del>detectors</del> <ins>classifiers</ins> in every test.</p></div>',
  );
  const smart = diffDocuments(oldText, newText, { mode: "smart" });
  assert.equal(
    smart.html,
    '<div class="change" id="chg-1"><p><del>Models preferred one label and underperformed against trained detectors</del> <ins>Chatbots favored a single label and lagged far behind trained classifiers</ins> in every test.</p></div>',
  );
  // Counts come from the matcher, not the folding, so they don't change with the mode.
  assert.equal(smart.wordsAdded, 8);
  assert.equal(smart.wordsRemoved, 6);
});

test("smart mode keeps light edits word by word, and anchors at sentence edges", () => {
  const light = ["It was a *dark* night, and the rain fell.", "It was a *dark and stormy* night, and the rain fell hard."];
  assert.equal(diffDocuments(...light, { mode: "smart" }).html, diffDocuments(...light).html);

  const anchored = diffDocuments(
    "They recall more. At the default threshold they flag text.",
    "They recall more. Users prefer fewer false alarms. At the default cutoff they flag text.",
    { mode: "smart" },
  );
  assert.equal(
    anchored.html,
    '<div class="change" id="chg-1"><p>They recall more. <ins>Users prefer fewer false alarms.</ins> At the default <del>threshold</del> <ins>cutoff</ins> they flag text.</p></div>',
  );
});

test("smart mode makes each changed paragraph its own change", () => {
  const oldText = "Intro stays.\n\nFirst para old words here.\n\nMiddle kept.\nWrapped.";
  const newText = "Intro stays!\n\nFirst para new words here.\n\nMiddle kept. Wrapped.";
  const result = diffDocuments(oldText, newText, { mode: "smart" });
  assert.equal(
    result.html,
    [
      '<div class="change" id="chg-1"><p>Intro <del>stays.</del> <ins>stays!</ins></p></div>',
      '<div class="change" id="chg-2"><p>First para <del>old</del> <ins>new</ins> words here.</p></div>',
      "<p>Middle kept. Wrapped.</p>",
    ].join("\n"),
  );
  // Hiding deletions leaves the same stops to step through.
  const clean = diffDocuments(oldText, newText, { mode: "smart", showDeletions: false });
  assert.deepEqual(clean.changes, result.changes);
});

test("smart mode keeps a reworded heading a heading", () => {
  const result = diffDocuments("# Chapter One\n\nShe left at dawn.", "# Chapter 1\n\nShe left before dawn.", {
    mode: "smart",
  });
  assert.equal(
    result.html,
    [
      '<div class="change" id="chg-1"><h1>Chapter <del>One</del> <ins>1</ins></h1></div>',
      '<div class="change" id="chg-2"><p>She left <del>at</del> <ins>before</ins> dawn.</p></div>',
    ].join("\n"),
  );
});

test("LaTeX comments and reviewer macros are set apart from the prose", () => {
  const oldText = [
    "\\section{Results}",
    "\\mohit{this reads as a numbers dump}",
    "Models achieve 94\\% accuracy. % TODO check this",
    "They are cheap.\\hg{why?} See \\hg{what does that mean?}",
  ].join("\n");
  const newText = "\\section{Results}\nModels achieve 94\\% accuracy.\nThey are cheap. See";
  const result = diffDocuments(oldText, newText);
  assert.equal(
    result.html,
    '<div class="change" id="chg-1"><p>\\section{Results} <del class="note"><span class="note-by">mohit</span> this reads as a numbers dump</del> Models achieve 94\\% accuracy. <del class="note"><span class="note-by">%</span> TODO check this</del> They are cheap. <del class="note"><span class="note-by">hg</span> why?</del> See <del class="note"><span class="note-by">hg</span> what does that mean?</del></p></div>',
  );
  // A one-word \hg is caught because \hg holds a sentence elsewhere; the
  // escaped \% isn't a comment.
  assert.deepEqual(result.changes, [{ id: "chg-1", excerpt: "mohit: this reads as a numbers dump %: TODO check this hg:…", kind: "comment" }]);
  assert.equal(result.wordsRemoved, 0);
  assert.equal(result.notesRemoved, 4);
});

test("an unchanged comment renders as a note, and markdown keeps its percent signs", () => {
  assert.equal(
    renderDocument("Text.\n\n% a note to self\n\\todo{fix}"),
    '<p>Text.</p>\n<p><span class="note"><span class="note-by">%</span> a note to self</span> <span class="note"><span class="note-by">todo</span> fix</span></p>',
  );
  const markdown = diffDocuments("About 50% of it. <!-- fix -->", "About 50% of it.");
  assert.equal(
    markdown.html,
    '<div class="change" id="chg-1"><p>About 50% of it. <del class="note"><span class="note-by">note</span> fix</del></p></div>',
  );
  assert.equal(markdown.changes[0].kind, "comment");
});

test("underscores inside a word aren't emphasis", () => {
  assert.equal(renderDocument("see sec:ai_vs_human and _this_"), "<p>see sec:ai_vs_human and <em>this</em></p>");
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
