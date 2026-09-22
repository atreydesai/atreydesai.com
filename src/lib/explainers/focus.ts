import { writable } from "svelte/store";

// The card whose explainer the viewer is pointing at or has focused, if any.
// That one keeps playing; every other card goes back to its first frame and
// waits there until attention moves on.
export const focusedExplainer = writable<symbol | null>(null);
