// Screenshots pages from a running dev server with the local Chrome, driven
// over the DevTools protocol (Node's built-in WebSocket; no browser package).
//
//   node scripts/capture.mjs shots.json
//
// shots.json is a list of { url, out, width?, height?, dark?, selector?,
// index?, maxHeight?, pad?, scale?, wait? }. `selector` clips to its
// `index`th match (cut at `maxHeight`); otherwise the viewport is captured.
// `dark` sets the saved theme before the page loads.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), "capture-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--no-first-run",
      "about:blank",
    ],
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
    } else {
      for (const fn of listeners) fn(msg);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });
  const once = (method, sessionId) =>
    new Promise((resolve) => {
      const fn = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) {
          listeners.delete(fn);
          resolve(msg.params);
        }
      };
      listeners.add(fn);
    });
  return new Promise((resolve) => {
    ws.onopen = () => resolve({ send, once, close: () => ws.close() });
  });
}

async function shoot(cdp, shot) {
  const { send, once } = cdp;
  const width = shot.width ?? 1200;
  const height = shot.height ?? 630;
  const scale = shot.scale ?? 2;
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
  });
  // The site keeps its theme in localStorage and applies it before paint.
  await s("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { localStorage.setItem("theme", ${JSON.stringify(shot.dark ? "dark" : "light")}); } catch {}`,
  });
  const loaded = once("Page.loadEventFired", sessionId);
  await s("Page.navigate", { url: shot.url });
  await loaded;
  await s("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  await sleep(shot.wait ?? 1200);

  let clip;
  if (shot.selector) {
    const { result } = await s("Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelectorAll(${JSON.stringify(shot.selector)})[${shot.index ?? 0}];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const height = Math.min(r.height, ${shot.maxHeight ?? "Infinity"});
        return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, width: r.width, height });
      })()`,
      returnByValue: true,
    });
    if (!result.value) throw new Error(`${shot.selector} not found on ${shot.url}`);
    clip = { ...JSON.parse(result.value), scale: 1 };
    const pad = shot.pad ?? 0;
    clip.x -= pad;
    clip.y -= pad;
    clip.width += pad * 2;
    clip.height += pad * 2;
  }
  const { data } = await s("Page.captureScreenshot", {
    format: "png",
    ...(clip ? { clip, captureBeyondViewport: true } : {}),
  });
  mkdirSync(dirname(shot.out), { recursive: true });
  writeFileSync(shot.out, Buffer.from(data, "base64"));
  await send("Target.closeTarget", { targetId });
  console.log(`  ${shot.out}`);
}

export async function capture(shots) {
  const { chrome, wsUrl } = await launch();
  try {
    const cdp = await connect(wsUrl);
    for (const shot of shots) await shoot(cdp, shot);
    cdp.close();
  } finally {
    chrome.kill();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await capture(JSON.parse(readFileSync(process.argv[2], "utf8")));
}
