// What a page costs after it has loaded, with the local Chrome over the
// DevTools protocol (like perf-lab.mjs, which measures the load itself).
//
//   node scripts/perf-runtime.mjs <base-url> [--only=idle,inp,bfcache,render]
//                                            [--runs=N] [--hold=ms]
//
// idle     main-thread time per second on a desktop page nobody touches, over
//          10 s after it settles: animation loops and timers that keep
//          running (battery, fan, and the room left for the reader's input)
// inp      interaction to next paint: the input-to-paint delay for a few real
//          interactions, on the throttled phone (4x CPU) with real touches.
//          Each runs in a fresh profile and checks it took effect. With
//          --runs, the median and worst of the click/keypress entry; a tap's
//          pointerdown entry also holds the finger's time down (--hold).
// bfcache  whether Back restores the page whole from the browser's cache,
//          and if not, Chrome's reasons
// render   DOM size and the style/layout work of the load, on the phone

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--"));
const only = (args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "idle,inp,bfcache,render").split(",");
// How long a simulated finger stays down. Chrome holds a touch's pointerdown
// open until it knows the touch is a tap, so the hold is inside that entry;
// the click's own entry is reported too.
const RUNS = Number(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 1);
const HOLD_MS = Number(args.find((a) => a.startsWith("--hold="))?.split("=")[1] ?? 60);

const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${mkdtempSync(join(tmpdir(), "perf-runtime-"))}`, "--no-first-run", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on("exit", () => reject(new Error(buf)));
});
const ws = new WebSocket(wsUrl);
let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
  else for (const fn of listeners) fn(msg);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

async function open({ mobile }) {
  // A fresh profile per page: nothing one scenario saves (the theme, in
  // localStorage) may change the next.
  const { browserContextId } = await send("Target.createBrowserContext", { disposeOnDetach: true });
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Performance.enable");
  await s("Network.enable");
  await s("Network.setCacheDisabled", { cacheDisabled: true });
  if (mobile) {
    await s("Emulation.setCPUThrottlingRate", { rate: 4 });
    await s("Emulation.setDeviceMetricsOverride", { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true });
    await s("Emulation.setTouchEmulationEnabled", { enabled: true });
  } else {
    await s("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  // Every interaction's input-to-paint duration, by interaction.
  await s("Page.addScriptToEvaluateOnNewDocument", { source: `window.__inp = new Map(); window.__inpParts = new Map(); window.__click = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) {
      if (e.name === "click" || e.name === "keypress") __click = Math.max(__click, e.duration);
      if (e.duration >= (__inp.get(e.interactionId) ?? 0)) __inpParts.set(e.interactionId, [e.processingStart - e.startTime, e.processingEnd - e.processingStart, e.startTime + e.duration - e.processingEnd, e.name]);
      __inp.set(e.interactionId, Math.max(__inp.get(e.interactionId) ?? 0, e.duration)); } })
      .observe({ type: "event", durationThreshold: 16, buffered: true });` });
  const evaluate = async (expression) => (await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const goto = async (url) => {
    const loaded = new Promise((r) => { const fn = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { listeners.delete(fn); r(); } }; listeners.add(fn); });
    await s("Page.navigate", { url });
    await loaded;
  };
  const metrics = async () => Object.fromEntries((await s("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const close = async () => {
    await send("Target.closeTarget", { targetId });
    await send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
  };
  return { s, sessionId, evaluate, goto, metrics, close, mobile };
}

const results = [];
const report = (...cells) => { results.push(cells); if (RUNS === 1 || cells[0] !== "inp") console.log(cells.join("  ")); };

// --- idle CPU: desktop, untouched, after settling.
if (only.includes("idle")) {
  for (const path of ["/", "/research/", "/cv/", "/about/", "/blog/", "/bookshelf/", "/photography/", "/blog/prose-diff/", "/blog/who-wrote-this/"]) {
    const page = await open({ mobile: false });
    await page.goto(new URL(path, base).href);
    await sleep(5000);
    const before = await page.metrics();
    await sleep(10000);
    const after = await page.metrics();
    const busy = ((after.TaskDuration - before.TaskDuration) / 10) * 1000;
    const script = ((after.ScriptDuration - before.ScriptDuration) / 10) * 1000;
    report("idle", path.padEnd(24), `main thread busy ${busy.toFixed(1).padStart(6)} ms/s`, `script ${script.toFixed(1)} ms/s`);
    await page.close();
  }
}

// --- INP: the slowest interaction on each page, phone, 4x CPU.
async function tap(page, selector) {
  // The first match that is laid out (a layout may keep a hidden copy). The
  // site scrolls smoothly; jump instead, and measure once it has landed.
  const first = `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.getClientRects().length)`;
  const found = await page.evaluate(`(() => { const el = ${first}; if (!el) return false; el.scrollIntoView({ block: "center", behavior: "instant" }); return true; })()`);
  if (!found) throw new Error(`no ${selector}`);
  await sleep(300);
  const box = await page.evaluate(`(() => { const r = (${first}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  // A finger on the phone, a mouse on the desktop: pages treat them
  // differently (pointerType, hover), and so does their cost.
  if (page.mobile) {
    await page.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x, y: box.y }] });
    await sleep(HOLD_MS);
    await page.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await page.s("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
    }
  }
}
async function type(page, selector, text) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  for (const ch of text) {
    await page.s("Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
    await page.s("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
    await sleep(120);
  }
}
// Each scenario checks that the input did what it should: an interaction
// faster than 16 ms isn't reported at all, so "none" must mean fast, not missed.
const SCENARIOS = [
  { path: "/", label: "theme toggle", run: (p) => tap(p, 'header button[aria-pressed]'), check: "document.documentElement.classList.contains('dark')" },
  { path: "/", label: "nav to research (in-app)", run: (p) => tap(p, 'header nav a[href="/research/"]'), check: "location.pathname === '/research/'" },
  { path: "/bookshelf/", label: "type 'the' in search", run: (p) => type(p, 'input[aria-label="Search the bookshelf"]', "the"), check: "document.querySelector('input[aria-label=\"Search the bookshelf\"]').value === 'the'" },
  { path: "/bookshelf/", label: "open an entry", run: (p) => tap(p, "tbody tr .row-open, .card-open"), check: "Boolean(document.querySelector('[role=dialog], dialog[open]'))" },
  { path: "/photography/", label: "open a photo", run: (p) => tap(p, ".photo-tile"), check: "Boolean(document.querySelector('[role=dialog][aria-modal]'))" },
  { path: "/research/", label: "theme toggle", run: (p) => tap(p, 'header button[aria-pressed]'), check: "document.documentElement.classList.contains('dark')" },
  // The paper page: a footnote mark jumps to its note, and every scroll-driven
  // section and the page canvas catch up in the frame after.
  { path: "/blog/who-wrote-this/", label: "tap a footnote mark", run: (p) => tap(p, ".wwt sup.fnref a"), check: "location.hash.startsWith('#fn')" },
];
if (only.includes("inp")) {
  for (const { path, label, run, check } of SCENARIOS) for (let i = 0; i < RUNS; i++) {
    const page = await open({ mobile: true });
    await page.goto(new URL(path, base).href);
    await sleep(4000);
    await page.evaluate("__inp.clear(), __click = 0, 1");
    try {
      await run(page);
      await sleep(1500);
      if (!(await page.evaluate(check))) throw new Error("the input had no effect");
      const worst = await page.evaluate("Math.max(0, ...__inp.values())");
      const count = await page.evaluate("__inp.size");
      const parts = await page.evaluate("(() => { let best = null, max = -1; for (const [k, v] of __inp) if (v > max) { max = v; best = __inpParts.get(k); } return best ? best.map((x) => typeof x === 'number' ? Math.round(x) : x).join('/') : ''; })()");
      const click = await page.evaluate("__click");
      report("inp", path.padEnd(16), label.padEnd(26), count ? `${String(Math.round(worst)).padStart(4)} ms` : "< 16 ms", `click/key ${click ? `${Math.round(click)} ms` : "< 16 ms"}`, count ? `(${count} interactions; worst delay/handlers/render ${parts})` : "");
    } catch (e) {
      report("inp", path.padEnd(16), label.padEnd(26), `error: ${e.message}`);
    }
    await page.close();
  }
}

if (only.includes("inp") && RUNS > 1) {
  // Medians over the runs, of the click (or keypress) entry: a tap's
  // pointerdown entry also holds the finger's time on the glass.
  const by = new Map();
  for (const [kind, path, label, , click] of results) {
    if (kind !== "inp") continue;
    const key = `${path}  ${label}`;
    const ms = /error/.test(click ?? "") ? NaN : /< 16/.test(click) ? 0 : Number(click.match(/(\d+) ms/)?.[1]);
    by.set(key, [...(by.get(key) ?? []), ms]);
  }
  for (const [key, list] of by) {
    const ok = list.filter(Number.isFinite).sort((a, b) => a - b);
    const median = ok.length ? ok[Math.floor((ok.length - 1) / 2)] : NaN;
    console.log(`inp  ${key}  median ${String(median).padStart(4)} ms  worst ${String(ok.at(-1)).padStart(4)} ms  (${ok.length}/${list.length} runs)`);
  }
}

// --- bfcache: leave by a full navigation, come back.
if (only.includes("bfcache")) {
  for (const path of ["/", "/cv/", "/bookshelf/", "/photography/", "/blog/who-wrote-this/"]) {
    const page = await open({ mobile: false });
    const notUsed = [];
    const restored = [];
    const fn = (m) => {
      if (m.sessionId !== page.sessionId) return;
      if (m.method === "Page.backForwardCacheNotUsed") notUsed.push(...m.params.notRestoredExplanations.map((e) => `${e.type}:${e.reason}`));
      if (m.method === "Page.frameNavigated" && m.params.type === "BackForwardCacheRestore") restored.push(true);
    };
    listeners.add(fn);
    await page.goto(new URL(path, base).href);
    await sleep(2500);
    await page.goto(new URL("/llms.txt", base).href);
    await sleep(500);
    const { currentIndex, entries } = await page.s("Page.getNavigationHistory");
    await page.s("Page.navigateToHistoryEntry", { entryId: entries[currentIndex - 1].id });
    await sleep(2500);
    listeners.delete(fn);
    report("bfcache", path.padEnd(24), restored.length ? "restored" : `not restored: ${[...new Set(notUsed)].join(", ") || "(no reason given)"}`);
    await page.close();
  }
}

// --- render: DOM and style/layout cost of the load, phone.
if (only.includes("render")) {
  for (const path of ["/", "/research/", "/cv/", "/about/", "/bookshelf/", "/photography/", "/blog/prose-diff/", "/blog/who-wrote-this/"]) {
    const page = await open({ mobile: true });
    await page.goto(new URL(path, base).href);
    await sleep(5000);
    const m = await page.metrics();
    report("render", path.padEnd(24), `nodes ${String(m.Nodes).padStart(5)}`, `style ${(m.RecalcStyleDuration * 1000).toFixed(0).padStart(4)} ms (${m.RecalcStyleCount}x)`, `layout ${(m.LayoutDuration * 1000).toFixed(0).padStart(4)} ms (${m.LayoutCount}x)`, `heap ${(m.JSHeapUsedSize / 1048576).toFixed(1)} MB`);
    await page.close();
  }
}

ws.close();
chrome.kill();
