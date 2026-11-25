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
  /**
   * Draw every frame while paused (a scene with something alive in it).
   * False keeps the last frame on screen instead; call `redraw()` when
   * something invalidates it (a resize, a theme change).
   */
  drawWhilePaused?: boolean;
}

export function createFrameLoop({ update, draw, isPaused, maxDt = 0.05, drawWhilePaused = true }: FrameLoopOptions) {
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
    const paused = isPaused();
    if (!paused && !held) update(Math.min(rawDt, maxDt), rawDt);
    if (mine !== generation) return;
    if (!paused || drawWhilePaused) draw();
    if (mine !== generation) return;
    raf = requestAnimationFrame((t) => frame(t, mine));
  };

  // In development, `window.__arcadeLoop.step(seconds)` runs the game ahead
  // at 60 steps a second however slowly the page is being painted, and
  // `hold(true)` freezes it where it is (still drawn), for checking a moment
  // late in a run by eye. Not in a production build.
  const dev = import.meta.env?.DEV && typeof window !== "undefined";
  let held = false;
  const handle = {
    step(seconds: number) {
      const mine = generation;
      for (let t = 0; t < seconds && running && mine === generation; t += 1 / 60) if (!isPaused()) update(1 / 60, 1 / 60);
      if (running && mine === generation) draw();
    },
    hold(on: boolean) {
      held = on;
    },
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      held = false;
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
    /** Draws one frame now, outside the loop (for a paused scene that was resized). */
    redraw() {
      draw();
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
