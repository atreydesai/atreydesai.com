// The frame loop every game runs: one requestAnimationFrame chain, real
// seconds since the last frame (capped, so a slow frame or a tab coming
// back never leaps the game ahead), no stepping while paused but still
// drawing, and a clean stop on close.

export interface FrameLoopOptions {
  /** Steps the game by `dt` (capped) real seconds; `rawDt` is uncapped. */
  update: (dt: number, rawDt: number) => void;
  /** Draws a frame. Runs while paused too, so the scene stays on screen. */
  draw: () => void;
  isPaused: () => boolean;
  /** The longest step a frame may take, in seconds. */
  maxDt?: number;
}

export function createFrameLoop({ update, draw, isPaused, maxDt = 0.05 }: FrameLoopOptions) {
  let raf = 0;
  let last = 0;
  let running = false;
  /** Bumped on every start and stop, so a frame from an older run never draws or schedules. */
  let generation = 0;

  const frame = (timestamp: number, mine = generation) => {
    if (!running || mine !== generation) return;
    if (!last) last = timestamp;
    const rawDt = Math.max(0, (timestamp - last) / 1000);
    last = timestamp;
    if (!isPaused()) update(Math.min(rawDt, maxDt), rawDt);
    if (mine !== generation) return;
    draw();
    if (mine !== generation) return;
    raf = requestAnimationFrame((t) => frame(t, mine));
  };

  // In development, `window.__arcadeLoop.step(seconds)` runs the game ahead
  // at 60 steps a second however slowly the page is being painted, for
  // checking a moment late in a run by eye. Not in a production build.
  const dev = import.meta.env?.DEV && typeof window !== "undefined";
  const handle = {
    step(seconds: number) {
      for (let t = 0; t < seconds; t += 1 / 60) if (!isPaused()) update(1 / 60, 1 / 60);
      draw();
    },
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      const mine = ++generation;
      raf = requestAnimationFrame((t) => frame(t, mine));
      if (dev) (window as unknown as { __arcadeLoop?: typeof handle }).__arcadeLoop = handle;
    },
    stop() {
      running = false;
      generation++;
      cancelAnimationFrame(raf);
      if (dev && (window as unknown as { __arcadeLoop?: typeof handle }).__arcadeLoop === handle) {
        delete (window as unknown as { __arcadeLoop?: typeof handle }).__arcadeLoop;
      }
    },
    /** Forget the last timestamp (after a pause), so the next frame steps from zero. */
    resync() {
      last = 0;
    },
  };
}

/** True once every `seconds` of the `dt`s it is fed: for HUD numbers that update about ten times a second. */
export function every(seconds: number) {
  let elapsed = 0;
  return (dt: number) => {
    elapsed += dt;
    if (elapsed < seconds) return false;
    elapsed = 0;
    return true;
  };
}
