// Page-transition tuning. All of it lives here so the effect can be retuned
// or switched off without touching +layout.svelte.
//
// To revert to the original feel: set DURATION back to 400 and IN_DELAY to 150.
// To turn page transitions off entirely: set PAGE_TRANSITIONS_ENABLED to false.

/** Master switch. `false` renders every route with no enter/exit animation. */
export const PAGE_TRANSITIONS_ENABLED = true;

/**
 * Length of both the exit and enter animation.
 *
 * This fires on every internal navigation, so it wants to be short enough that
 * it never becomes something to wait through. 180ms reads as a settle rather
 * than a transition; the previous 400ms plus a 150ms enter delay meant roughly
 * half a second of animation between one page of text and the next.
 */
export const PAGE_TRANSITION_DURATION_MS = 180;

/**
 * Delay before the incoming page starts animating in. 0 means the new content
 * is on screen immediately and the outgoing page fades out underneath it.
 */
export const PAGE_TRANSITION_IN_DELAY_MS = 0;

/** Horizontal travel of the enter animation, in px. */
export const PAGE_TRANSITION_IN_X = -8;

/** Vertical travel of the exit animation, in px. */
export const PAGE_TRANSITION_OUT_Y = 4;

export const PAGE_TRANSITION_SCROLL_BUFFER_MS = 50;
