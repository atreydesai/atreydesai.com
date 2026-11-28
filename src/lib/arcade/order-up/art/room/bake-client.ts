/**
 * The page's side of the bake worker: one shared worker, jobs answered by
 * promise, results turned into canvases. Identical jobs in flight share one
 * answer, and where a worker can't start the job runs here instead.
 */
import { runBake, type BakeJob, type BakeResult } from "./bake-job.ts";

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, (r: BakeResult | null) => void>();
const inflight = new Map<string, Promise<BakeResult>>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./bake.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: BakeResult; error?: string }>) => {
      const done = waiting.get(event.data.id);
      waiting.delete(event.data.id);
      done?.(event.data.result ?? null);
    };
    worker.onerror = () => {
      worker = null;
      for (const done of waiting.values()) done(null);
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Bakes a room, off the main thread where it can. */
export function bake(job: BakeJob): Promise<BakeResult> {
  const key = JSON.stringify(job);
  const hit = inflight.get(key);
  if (hit) return hit;
  const w = start();
  const promise = !w
    ? Promise.resolve(runBake(job))
    : new Promise<BakeResult>((resolve) => {
        const id = nextId++;
        waiting.set(id, (result) => resolve(result ?? runBake(job)));
        w.postMessage({ id, job });
      });
  inflight.set(key, promise);
  void promise.finally(() => inflight.delete(key));
  return promise;
}

/** A canvas holding RGBA pixels. */
export function pixelsToCanvas(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number, reuse?: HTMLCanvasElement | null) {
  const c = reuse ?? document.createElement("canvas");
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  c.getContext("2d")!.putImageData(new ImageData(data, width, height), 0, 0);
  return c;
}
