// Boba catch is steered by the pointer's x alone, and the pointer is hidden
// over the stage, so as a hand sweeps the basket to and fro it drifts up and
// down unseen. Its height never moves the basket; what it must not do is
// pause the shift by accident: a sweep that drifts up into the tickets and
// ends in a click on pause, or a pointer slipping off the top of the page
// for a moment. So during play a press on the tickets counts only once the
// pointer has come to rest there, and a pointer off the page holds play
// still (fairly: nothing moves) for a beat before the shift pauses. The
// keys (P, Space, and Enter on a focused button) are never held back, and
// leaving the page for longer, the window or the tab still pauses.
//
// DOM-free: the component feeds it the pointer's moves with their event
// times (seconds) and asks it at a press, or each frame.

/** Seconds the pointer must have been over the tickets before a press there counts during play. */
export const HUD_DWELL = 0.3;
/** It is at rest once it has moved no more than `STILL_PX` over the last `STILL_FOR` seconds. */
export const STILL_FOR = 0.12;
export const STILL_PX = 8;
/** Seconds the pointer may be off the page, play held, before the shift pauses. */
export const LEAVE_GRACE = 0.5;

/** Moves kept, newest last: enough to cover `STILL_FOR` at any mouse's rate. */
const TRAIL = 32;

export function createPointerGuard() {
  /** @type {Array<{ t: number, x: number, y: number }>} */
  const trail = [];
  let over = false;
  let overSince = -Infinity;
  /** When the pointer last came back onto the page: Infinity while it is off it, -Infinity if it never left. */
  let backSince = -Infinity;
  /** @type {number | null} */
  let outSince = null;

  return {
    /**
     * The pointer moved to `x, y` at `t`; `overTickets` says whether it is over the HUD's tickets.
     * @param {number} t @param {number} x @param {number} y @param {boolean} overTickets
     */
    move(t, x, y, overTickets) {
      if (backSince === Infinity) backSince = t;
      if (overTickets && !over) overSince = t;
      over = overTickets;
      outSince = null;
      const last = trail.length >= TRAIL ? trail.shift() : null;
      const sample = last ?? { t: 0, x: 0, y: 0 };
      sample.t = t;
      sample.x = x;
      sample.y = y;
      trail.push(sample);
    },
    /**
     * Whether a press on the tickets at `t`, during play, is meant: the
     * pointer has been over them for `HUD_DWELL`, on the page all that
     * while, and is at rest. A pointer that never moved (the tickets came up
     * under it) has been resting.
     * @param {number} t
     */
    pressCounts(t) {
      const newest = trail[trail.length - 1];
      if (!newest) return backSince !== Infinity;
      // Over the tickets since it came onto them; under a pointer that last
      // moved elsewhere, they came to it, and it has been there since. A
      // pointer back from off the page starts again from when it came back.
      const since = Math.max(over ? overSince : newest.t, backSince);
      if (t - since < HUD_DWELL) return false;
      // At rest: within `STILL_PX` of where it is now, at every move in the
      // last `STILL_FOR` and at where it was as that window opened.
      for (let i = trail.length - 1; i >= 0; i--) {
        const sample = trail[i];
        if (Math.hypot(sample.x - newest.x, sample.y - newest.y) > STILL_PX) return false;
        if (sample.t < t - STILL_FOR) break;
      }
      return true;
    },
    /**
     * The pointer left the page at `t`: its time over the tickets is
     * forgotten, and during play (`hold`) play holds while it is away.
     * @param {number} t @param {boolean} [hold]
     */
    leave(t, hold = true) {
      over = false;
      overSince = -Infinity;
      backSince = Infinity;
      if (hold) outSince ??= t;
    },
    /**
     * The pointer came back onto the page at `t` (its dwell on the tickets
     * starts again from there), or, with no time, the player resumed:
     * whatever it did off the page no longer holds play.
     * @param {number} [t]
     */
    enter(t) {
      outSince = null;
      if (t !== undefined && backSince === Infinity) backSince = t;
    },
    /**
     * Where the pointer is for play at `t`: "in" (on the page), "held" (off
     * it for less than `LEAVE_GRACE`: play holds still) or "gone" (pause).
     * @param {number} t
     * @returns {"in" | "held" | "gone"}
     */
    status(t) {
      if (outSince === null) return "in";
      return t - outSince >= LEAVE_GRACE ? "gone" : "held";
    },
  };
}
