import { writable } from "svelte/store";

// Whether the boba minigame overlay is active. Shared so it can be launched
// from anywhere (the Konami code in the layout, or the boba on the homepage)
// while the layout owns the actual <BobaGame> render.
export const bobaMode = writable(false);
