// Page-transition tuning. All of it lives here so the effect can be retuned
// or switched off without touching +layout.svelte.

/** Master switch. `false` renders every route with no enter/exit animation. */
export const PAGE_TRANSITIONS_ENABLED = true;

/**
 * Length of both the exit and enter animation. This fires on every internal
 * navigation, so it stays short enough to read as a settle rather than
 * something to wait through.
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

/** Extra wait after a transition before scrolling to a deep-linked anchor. */
export const PAGE_TRANSITION_SCROLL_BUFFER_MS = 50;
