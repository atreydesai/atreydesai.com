// Straw stab's audio gate: whether the belt may move on the audio clock this
// frame. The belt is drawn against the heard audio time, so while that clock
// is held, stopping or stalled the belt has to wait for it, never run on by
// the page clock with the last offset it read, where cups would be called
// missed in silence.
//
// Holding the clock (the pause card, or a pearl line's stop) asks the shared
// context to suspend; a context's suspend() takes a moment, and it still
// reports "running" until it lands. A resume asked for in that moment is
// skipped (sfx.ts resumes only a context that isn't running), so the
// suspension lands afterwards and swallows it. The gate remembers that a
// suspension is on its way until it sees the context leave "running" (its
// statechange, or its state read on a frame), keeps the belt waiting while it
// is, and then asks for the resume again. And a context that reports running
// while its clock stands still holds the belt too, once that has lasted
// CLOCK_STALL.
//
// DOM-free: the component hands it the context's state and the audio clock's
// readings, so it is tested in node with a stand-in context.

/**
 * Page seconds the heard clock may stand still while its context reports
 * running before the belt waits for it: longer than the coarsest steps a
 * context's clock moves in (a large output buffer renders a tenth of a second
 * at a time), and between them the belt's offset snaps back to the clock it
 * reads (steadyOffset), so it never runs more than that snap past it.
 */
export const CLOCK_STALL = 0.2;
/**
 * Page seconds a suspension asked for may take to land before the gate stops
 * waiting for it: one that never lands (refused) leaves a context that is
 * running after all, and the belt follows its clock again.
 */
export const SUSPEND_LIMIT = 1;

/** @typedef {"running" | "suspended" | "closed" | "interrupted" | string} ContextState */

export function createAudioGate() {
  /** A suspension has been asked for and not yet seen to land, and when (page seconds). */
  let suspending = false;
  let askedAt = 0;
  /** The run wants the audio running (not while the clock is held). */
  let wanted = true;
  /** The last heard reading, and the page time it last moved. */
  /** @type {number | null} */
  let last = null;
  let movedAt = 0;

  /** @param {ContextState} state @param {number} [page] */
  const saw = (state, page) => {
    if (state !== "running" || (page !== undefined && page - askedAt > SUSPEND_LIMIT)) suspending = false;
  };

  return {
    /** A suspension asked for is still on its way: the context says "running", but won't be for long. */
    get suspending() {
      return suspending;
    },
    /**
     * The clock is held (a pause, or a line's stop): the context is asked to
     * suspend at page time `page`, and `state` is what it reports as it is asked.
     * @param {ContextState} state
     * @param {number} page
     */
    hold(state, page) {
      wanted = false;
      suspending = state === "running";
      askedAt = page;
      last = null;
    },
    /** The run asks for the audio back (Continue, or resume). */
    release() {
      wanted = true;
    },
    /**
     * The context's state, as its statechange reports it (or a frame reads
     * it): leaving "running" is a suspension landing.
     * @param {ContextState} state
     */
    state(state) {
      saw(state);
    },
    /**
     * Whether to ask the context to resume now: the audio is wanted back, no
     * suspension is still on its way to swallow the request, and the context
     * isn't running (a suspension that landed after the release, or one the
     * system made).
     * @param {ContextState} state
     * @param {number} page
     */
    needsResume(state, page) {
      saw(state, page);
      return wanted && !suspending && state !== "running" && state !== "closed";
    },
    /**
     * Whether to ask the context to suspend again: the clock is held, no
     * suspension is on its way, and the context is running all the same (a
     * resume asked before the hold that landed after it).
     * @param {ContextState} state
     * @param {number} page
     */
    needsSuspend(state, page) {
      saw(state, page);
      return !wanted && !suspending && state === "running";
    },
    /**
     * Whether the belt may move on the audio clock this frame: the audio is
     * wanted, no suspension is on its way, the context runs, and its heard
     * clock `heard` (null without one) has moved within CLOCK_STALL of page
     * time `page`.
     * @param {number | null} heard
     * @param {ContextState} state
     * @param {number} page
     */
    mayAdvance(heard, state, page) {
      saw(state, page);
      if (!wanted || suspending || state !== "running" || heard === null) {
        last = null;
        return false;
      }
      if (last === null || heard !== last) {
        last = heard;
        movedAt = page;
        return true;
      }
      return page - movedAt <= CLOCK_STALL;
    },
    /** A fresh run. */
    reset() {
      suspending = false;
      wanted = true;
      last = null;
      movedAt = 0;
    },
  };
}
