// The 3, 2, 1 before a run starts, shared by every game that counts in. Kept
// free of the DOM so it can be tested with node.

export const COUNTDOWN_SECONDS = 3;

/**
 * Advances the countdown by `dt` seconds. `beep` is true when the number on
 * screen changes (and `count` holds the new number); `done` once it has run
 * out and the run should begin.
 * @param {number} elapsed seconds counted so far
 * @param {number} count the number currently shown
 * @param {number} dt
 */
export function stepCountdown(elapsed, count, dt) {
  const next = elapsed + dt;
  const done = next >= COUNTDOWN_SECONDS;
  const shown = Math.max(1, COUNTDOWN_SECONDS - Math.floor(next));
  const beep = !done && shown !== count;
  return { elapsed: next, count: beep ? shown : count, beep, done };
}
