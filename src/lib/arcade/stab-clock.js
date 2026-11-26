// Straw stab's audio gate: whether the belt may move on the audio clock this
// frame. The belt is drawn against the heard audio time, so while that clock
// is held, stopping or stalled the belt has to wait for it, never run on by
// the page clock with the last offset it read, where cups would be called
// missed in silence.
//
// Holding the clock (the pause card, or a pearl line's stop) asks the shared
// context to suspend; a context's suspend() takes a moment, and it still
// reports "running" until it lands. The shared audio controls expose the
// pending suspension and queue the resume behind it. The gate blocks the
// belt while that suspension is pending. A context that reports running
// while its clock stands still holds the belt too, once that has lasted
// CLOCK_STALL.
//
// DOM-free: the component hands it the context's state and the audio clock's
// readings, so it is tested in node with a stand-in context.

/**
 * Page seconds the rendering clock may stand still while its context reports
 * running before the belt waits for it: longer than the coarsest steps a
 * context's clock moves in (a large output buffer renders a tenth of a second
 * at a time), and between them the belt's offset snaps back to the clock it
 * reads (steadyOffset), so it never runs more than that snap past it.
 */
export const CLOCK_STALL = 0.2;
/** Page seconds to recover audio before continuing without the soundtrack. */
export const AUDIO_RECOVERY_LIMIT = 5;
/** Audio that ran on under a hold can skip a cup on rejoining the belt. */
const MAX_RESUME_DRIFT = 0.08;

/**
 * @param {number | null} song The playable audio clock's song time.
 * @param {number} heldSong The song time the belt is waiting at.
 * @param {number} elapsed Page seconds since recovery began.
 */
export function recoveryStatus(song, heldSong, elapsed) {
  if (song !== null) return Math.abs(song - heldSong) <= MAX_RESUME_DRIFT ? "ready" : "silent";
  return elapsed > AUDIO_RECOVERY_LIMIT ? "silent" : "wait";
}

/** @typedef {"running" | "suspended" | "closed" | "interrupted" | string} ContextState */

/** @param {() => boolean} isSuspending Whether the suspend request is still pending. */
export function createAudioGate(isSuspending) {
  /** The run wants the audio running (not while the clock is held). */
  let wanted = true;
  /** The last heard reading, and the page time it last moved. */
  /** @type {number | null} */
  let last = null;
  let movedAt = 0;

  return {
    /** The clock is held for a pause or a lesson. */
    hold() {
      wanted = false;
      last = null;
    },
    /** The run asks for the audio back (Continue, or resume). */
    release() {
      wanted = true;
    },
    /**
     * Whether to ask the context to resume now: the audio is wanted back, no
     * suspension is still on its way to swallow the request, and the context
     * isn't running (a suspension that landed after the release, or one the
     * system made).
     * @param {ContextState} state
     */
    needsResume(state) {
      return wanted && !isSuspending() && state !== "running" && state !== "closed";
    },
    /**
     * Whether to ask the context to suspend again: the clock is held, no
     * suspension is on its way, and the context is running all the same (a
     * resume asked before the hold that landed after it).
     * @param {ContextState} state
     */
    needsSuspend(state) {
      return !wanted && !isSuspending() && state === "running";
    },
    /**
     * Whether the belt may move on the audio clock this frame: the audio is
     * wanted, no suspension is on its way, the context runs, and its rendering
     * clock has moved within CLOCK_STALL of page
     * time `page`.
     * @param {number | null} clock
     * @param {ContextState} state
     * @param {number} page
     * @param {boolean} [requireMotion] Recovery needs two distinct readings.
     */
    mayAdvance(clock, state, page, requireMotion = false) {
      if (!wanted || isSuspending() || state !== "running" || clock === null) {
        last = null;
        return false;
      }
      const moved = last !== null && clock !== last;
      if (last === null || moved) {
        last = clock;
        movedAt = page;
      }
      return requireMotion ? moved : page - movedAt <= CLOCK_STALL;
    },
    /** A fresh run. */
    reset() {
      wanted = true;
      last = null;
      movedAt = 0;
    },
  };
}
