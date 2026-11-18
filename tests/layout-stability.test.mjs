// A post's images hold their place before they arrive: each carries its width
// and height (read from the file when the page is built), so the text under it
// never moves when it loads.
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

const BLOG = new URL("../.vercel/output/static/blog/", import.meta.url);
const built = await access(new URL("index.html", BLOG)).then(() => true, () => false);

test("every image in a built post has its size", { skip: !built && "no build output" }, async () => {
  let checked = 0;
  for (const entry of await readdir(BLOG, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = await readFile(new URL(`${entry.name}/index.html`, BLOG), "utf8").catch(() => "");
    const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? "";
    for (const [img] of article.matchAll(/<img\b[^>]*>/g)) {
      checked++;
      assert.match(img, /\swidth="\d+"/, `${entry.name}: ${img.slice(0, 80)} has no width`);
      assert.match(img, /\sheight="\d+"/, `${entry.name}: ${img.slice(0, 80)} has no height`);
    }
  }
  assert.ok(checked >= 1, "no post images found to check");
});

// The paper page's lower sections hydrate after the page (Defer.svelte), but they arrive whole: each wrapper holds
// the server's render of its section, so the page has its full layout, text and links before any script runs.
test("the paper page's deferred sections arrive server-rendered", { skip: !built && "no build output" }, async () => {
  const html = await readFile(new URL("who-wrote-this/index.html", BLOG), "utf8");
  const wrappers = [...html.matchAll(/<div class="defer-in"><!--\[-->\s*<(\w+)[^>]*\bid="([\w-]+)"/g)].map((m) => m[2]);
  assert.deepEqual(wrappers, ["recent", "human-or-ai", "which-ai", "which-human", "who-can-be-identified", "anonymity"]);
});
