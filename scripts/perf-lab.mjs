// Lab measurements of page loads on a throttled mid-range phone, with the
// local Chrome over the DevTools protocol (no browser package), like
// capture.mjs.
//
//   node scripts/perf-lab.mjs <base-url> [path ...] [--runs=3] [--json=out.json] [--detail]
//                            [--block=*pattern*,…]  (requests to fail, for experiments)
//
// Each run is a cold load (cache disabled) at Lighthouse's mobile settings:
// 4x CPU slowdown, 150 ms round trips, 1.6 Mbps down. Reported per page, as
// the median of the runs:
//   ttfb, fcp, lcp       ms from navigation start
//   cls                  cumulative layout shift
//   tbt                  total blocking time: long-task time past 50 ms each,
//                        from first paint to the end of the load
//   script               main-thread time spent running script (ms)
//   requests, kb         count and transferred kilobytes, total and by type

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const [base, ...rest] = args.filter((a) => !a.startsWith("--"));
const paths = rest.length
  ? rest
  : ["/", "/research/", "/cv/", "/about/", "/blog/", "/blog/prose-diff/", "/bookshelf/", "/photography/", "/blog/who-wrote-this/"];
const RUNS = Number(flag("runs", 3));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "perf-lab-"));
  const chrome = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    chrome.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    chrome.on("exit", () => reject(new Error(`Chrome exited:\n${buf}`)));
  });
  return { chrome, wsUrl };
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });
  return new Promise((resolve) => {
    ws.onopen = () => resolve({ send, listeners, close: () => ws.close() });
  });
}

// Collected in the page from the first byte on.
const OBSERVERS = `
  window.__lab = { lcp: 0, cls: 0, fcp: 0, long: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { __lab.lcp = e.startTime; __lab.lcpUrl = e.url; __lab.lcpEl = (e.element ? e.element.tagName.toLowerCase() + "." + String(e.element.className).split(" ")[0] : "") + (e.url ? " " + e.url.split("/").pop().slice(0, 40) : "") + " @" + Math.round(e.startTime); } })
    .observe({ type: "largest-contentful-paint", buffered: true });
  __lab.shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { __lab.cls += e.value; __lab.shifts.push(Math.round(e.startTime) + "ms " + e.value.toFixed(3) + " " + (e.sources || []).map((s) => s.node ? (s.node.nodeName.toLowerCase() + "." + String(s.node.className || "").split(" ")[0]) : "?").join(",")); } })
    .observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") __lab.fcp = e.startTime; })
    .observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) __lab.long.push([e.startTime, e.duration]); })
    .observe({ type: "longtask", buffered: true });
  // When the first photo is on screen: loaded and not transparent.
  (function watch() {
    const img = document.querySelector(".photo-tile img");
    if (img && img.complete && img.naturalWidth && getComputedStyle(img).opacity !== "0") { window.__firstPhotoShown = performance.now(); return; }
    requestAnimationFrame(watch);
  })();
`;

async function measure(cdp, url) {
  const { send, listeners } = cdp;
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);

  const requests = new Map();
  let lastActivity = Date.now();
  let loaded = false;
  const onMessage = (msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Network.responseReceived") {
      requests.set(msg.params.requestId, { type: msg.params.type, url: msg.params.response.url, bytes: 0 });
      lastActivity = Date.now();
    } else if (msg.method === "Network.loadingFinished") {
      const r = requests.get(msg.params.requestId);
      if (r) r.bytes = msg.params.encodedDataLength;
      lastActivity = Date.now();
    } else if (msg.method === "Page.loadEventFired") loaded = true;
  };
  listeners.add(onMessage);

  await s("Page.enable");
  await s("Network.enable");
  await s("Performance.enable");
  await s("Network.setCacheDisabled", { cacheDisabled: true });
  const blocked = flag("block");
  if (blocked) await s("Network.setBlockedURLs", { urls: blocked.split(",") });
  await s("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await s("Emulation.setCPUThrottlingRate", { rate: 4 });
  await s("Emulation.setDeviceMetricsOverride", { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true });
  await s("Emulation.setTouchEmulationEnabled", { enabled: true });
  await s("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVERS });

  const started = Date.now();
  await s("Page.navigate", { url });
  // Settled: loaded, and two seconds with no network activity (at most 30 s).
  while (!(loaded && Date.now() - lastActivity > 2000) && Date.now() - started < 30000) await sleep(200);

  const { result } = await s("Runtime.evaluate", {
    expression: `JSON.stringify({ ...__lab, nav: performance.getEntriesByType("navigation")[0]?.toJSON(),
      firstPhoto: (() => { const img = document.querySelector(".photo-tile img"); if (!img) return null;
        const res = performance.getEntriesByName(img.currentSrc)[0];
        // Visible once loaded and, if it fades in, once the fade has started (opacity above 0).
        return { loaded: res?.responseEnd ?? null, opacity: getComputedStyle(img).opacity, shownAt: window.__firstPhotoShown ?? null }; })(),
      lcpRes: __lab.lcpUrl ? (({ startTime, responseStart, responseEnd }) => ({ startTime, responseStart, responseEnd }))(performance.getEntriesByName(__lab.lcpUrl)[0] ?? {}) : null })`,
    returnByValue: true,
  });
  const lab = JSON.parse(result.value);
  const { metrics } = await s("Performance.getMetrics");
  const metric = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
  listeners.delete(onMessage);
  await send("Target.closeTarget", { targetId });

  const loadEnd = lab.nav?.loadEventEnd || lab.lcp;
  const tbt = lab.long
    .filter(([start]) => start >= lab.fcp && start <= Math.max(loadEnd, lab.lcp) + 5000)
    .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
  const byType = {};
  let bytes = 0;
  for (const r of requests.values()) {
    byType[r.type] = (byType[r.type] ?? 0) + r.bytes;
    bytes += r.bytes;
  }
  return {
    ttfb: lab.nav?.responseStart ?? 0,
    fcp: lab.fcp,
    lcp: lab.lcp,
    cls: lab.cls,
    tbt,
    script: metric("ScriptDuration") * 1000,
    requests: requests.size,
    kb: bytes / 1024,
    jsKb: (byType.Script ?? 0) / 1024,
    docKb: (byType.Document ?? 0) / 1024,
    cssKb: (byType.Stylesheet ?? 0) / 1024,
    imgKb: (byType.Image ?? 0) / 1024,
    fontKb: (byType.Font ?? 0) / 1024,
    firstPhotoShown: lab.firstPhoto?.shownAt ?? 0,
    shifts: (lab.shifts ?? []).join("; "),
    lcpEl: (lab.lcpEl ?? "") + (lab.lcpRes?.startTime != null ? ` [req ${Math.round(lab.lcpRes.startTime)}→${Math.round(lab.lcpRes.responseEnd)}]` : ""),
    images: [...requests.values()]
      .filter((r) => r.type === "Image")
      .map((r) => [r.url.replace(/^https?:\/\/[^/]+/, ""), Math.round(r.bytes / 1024)]),
    scripts: [...requests.values()]
      .filter((r) => r.type === "Script")
      .sort((a, b) => b.bytes - a.bytes)
      .map((r) => [r.url.replace(/^https?:\/\/[^/]+/, ""), Math.round(r.bytes / 1024)]),
  };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const { chrome, wsUrl } = await launch();
const cdp = await connect(wsUrl);
const results = {};
try {
  for (const path of paths) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(cdp, new URL(path, base).href));
    results[path] = Object.fromEntries(
      Object.keys(runs[0])
        .filter((k) => !["scripts", "images", "lcpEl", "shifts"].includes(k))
        .map((k) => [k, median(runs.map((r) => r[k]))]),
    );
    results[path].scripts = runs[0].scripts;
    results[path].images = runs[0].images;
    results[path].lcpEl = runs.map((r) => r.lcpEl).join(" | ");
    results[path].shifts = runs.map((r) => r.shifts).join(" | ");
    const r = results[path];
    console.log(
      `${path.padEnd(24)} ttfb ${r.ttfb.toFixed(0).padStart(4)}  fcp ${r.fcp.toFixed(0).padStart(5)}  lcp ${r.lcp.toFixed(0).padStart(5)}  cls ${r.cls.toFixed(3)}  tbt ${r.tbt.toFixed(0).padStart(5)}  script ${r.script.toFixed(0).padStart(5)}  req ${String(r.requests).padStart(3)}  kb ${r.kb.toFixed(0).padStart(5)} (js ${r.jsKb.toFixed(0)}, doc ${r.docKb.toFixed(0)}, img ${r.imgKb.toFixed(0)}, font ${r.fontKb.toFixed(0)})`,
    );
    if (args.includes("--detail") && r.shifts.replace(/[ |]/g, "")) console.log(`    shifts: ${r.shifts.slice(0, 400)}`);
    if (args.includes("--detail")) console.log(`    LCP: ${r.lcpEl}${r.firstPhotoShown ? `\n    first photo on screen: ${Math.round(r.firstPhotoShown)} ms` : ""}`);
    if (args.includes("--detail")) {
      for (const [url, kb] of r.scripts.slice(0, 12)) console.log(`    ${String(kb).padStart(4)} KB  ${url.slice(0, 90)}`);
      if (r.images.length > 3) console.log(`    images: ${r.images.length}, ${r.images.map(([u, kb]) => `${u.match(/-(\d+)\.\w+\.(\w+)$/)?.slice(1).join("") ?? u.split("/").pop()}:${kb}`).join(" ")}`);
    }
  }
} finally {
  cdp.close();
  chrome.kill();
}
const out = flag("json");
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
