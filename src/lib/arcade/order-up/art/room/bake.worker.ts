/// <reference lib="webworker" />
// Bakes rooms off the main thread: a job in, its pixel buffers out, moved
// (not copied) back to the page.
import { runBake, type BakeJob } from "./bake-job.ts";

self.onmessage = (event: MessageEvent<{ id: number; job: BakeJob }>) => {
  const { id, job } = event.data;
  try {
    const result = runBake(job);
    (self as unknown as Worker).postMessage({ id, result }, [result.background.buffer, result.overhead.buffer, result.atlas.buffer]);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: String(error) });
  }
};
