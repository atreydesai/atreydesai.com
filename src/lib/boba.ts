import { writable } from "svelte/store";

// Whether the boba minigame overlay is active. Shared so it can be launched
// from anywhere (the Konami code in the layout, or the boba on the homepage)
// while the layout owns the actual <BobaGame> render.
export const bobaMode = writable(false);

// The game is deliberately a desktop easter egg: it needs both enough room for
// readable trajectories and a precise mouse-like pointer.
export const BOBA_DESKTOP_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function canPlayBoba() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(BOBA_DESKTOP_QUERY).matches
  );
}

export function openBoba() {
  if (!canPlayBoba()) return false;
  bobaMode.set(true);
  return true;
}
