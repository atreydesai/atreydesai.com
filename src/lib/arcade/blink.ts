// The revive blink: after the player loses a life and carries on, or wins
// one back, their own sprite (the basket, the straw, the lander, the runner)
// flickers hard on and off for a moment, the way the HUD's pearl does, so a
// life changing hands is seen on the thing being played, not only counted.
// Under Reduce Motion there is no flicker; the sprite simply stays drawn.

/** Seconds a sprite flickers after a life is lost or won back. */
export const REVIVE_BLINK_SECONDS = 1.2;

/** Each on or off beat of the flicker, in seconds. */
const BEAT = 0.08;

let calm: MediaQueryList | null = null;

/**
 * Whether a sprite with `remaining` seconds of blink left is drawn this
 * frame. Pass the countdown that the game steps with its own clock, so a
 * paused game holds the blink where it is.
 */
export function blinkShows(remaining: number) {
  if (remaining <= 0) return true;
  if (typeof window !== "undefined") {
    calm ??= window.matchMedia("(prefers-reduced-motion: reduce)");
    if (calm.matches) return true;
  }
  return Math.floor(remaining / BEAT) % 2 === 1;
}
