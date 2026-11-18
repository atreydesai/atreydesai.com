// Nothing holds a page's first paint but its own HTML. Every stylesheet the
// site builds is inlined (vite.config.ts, inlineStyleThreshold); a chunk that
// outgrows the threshold quietly becomes a separate request every visit must
// wait for. Third-party stylesheets (Typekit, Google Fonts) load without
// blocking and swap their fonts in.
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

const STATIC = new URL("../.vercel/output/static/", import.meta.url);
const built = await access(new URL("index.html", STATIC)).then(() => true, () => false);

async function pages(dir = STATIC) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory() && entry.name !== "_app") out.push(...(await pages(url)));
    else if (entry.name === "index.html") out.push(url);
  }
  return out;
}

test("no page links a stylesheet that blocks its first paint", { skip: !built && "no build output" }, async () => {
  const list = await pages();
  assert.ok(list.length >= 9, `only ${list.length} pages`);
  for (const url of list) {
    const html = await readFile(url, "utf8");
    const head = html.slice(0, html.indexOf("</head>")).replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
    const blocking = [...head.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      // A stylesheet SvelteKit inlined keeps a disabled link, for client navigation.
      // (The rel attribute itself: a preload's onload also says rel='stylesheet'.)
      .filter((tag) => /\srel=["']?stylesheet\b/.test(tag) && !/\sdisabled\b/.test(tag) && !/media=["']\(max-width: 0\)/.test(tag));
    assert.deepEqual(blocking, [], `${url.pathname.split("/static/")[1]} blocks its first paint on a stylesheet`);
  }
});
