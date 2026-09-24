import { writable } from "svelte/store";

// The boba arcade: a menu of small games behind the pixel boba on the
// homepage (and the Konami code). The layout owns the render; anything can
// open it through this store.

export type GameId = "catch" | "stab" | "orders" | "stack";
export type ArcadeScreen = "menu" | GameId;

export interface GameInfo {
  id: GameId;
  /** Lowercase display name, in the site's voice. */
  name: string;
  /** One sentence for the menu. */
  blurb: string;
  /** Menu shortcut. */
  key: string;
  /** What the score counts, for the results slip and the menu. */
  unit: string;
  /** Catch steers a basket with the mouse, so it needs a fine pointer. */
  desktopOnly: boolean;
}

export const GAMES: GameInfo[] = [
  {
    id: "catch",
    name: "boba catch",
    blurb: "Cups fly out of the page’s links. Catch them in the basket.",
    key: "1",
    unit: "points",
    desktopOnly: true,
  },
  {
    id: "stab",
    name: "straw stab",
    blurb: "Punch a straw into every cup, right on the beat.",
    key: "2",
    unit: "points",
    desktopOnly: false,
  },
  {
    id: "orders",
    name: "order up",
    blurb: "Read the tickets, build the drinks, serve them before anyone gives up.",
    key: "3",
    unit: "points",
    desktopOnly: false,
  },
  {
    id: "stack",
    name: "cup stack",
    blurb: "Drop each cup on the last. Whatever hangs over gets sliced off.",
    key: "4",
    unit: "cups",
    desktopOnly: false,
  },
];

export function gameInfo(id: GameId) {
  return GAMES.find((game) => game.id === id) ?? GAMES[0];
}

/** Which arcade screen is open, or null when the arcade is closed. */
export const arcadeScreen = writable<ArcadeScreen | null>(null);

// Catch needs both enough room for readable trajectories and a precise
// mouse-like pointer; the other games play by tap or key.
export const BOBA_DESKTOP_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function canPlay(id: GameId) {
  if (typeof window === "undefined") return false;
  if (!gameInfo(id).desktopOnly) return true;
  return window.matchMedia(BOBA_DESKTOP_QUERY).matches;
}

/**
 * Opens the arcade on `screen`. A game this device can't play opens the menu
 * instead, where it is shown but disabled.
 */
export function openArcade(screen: ArcadeScreen = "menu") {
  if (typeof window === "undefined") return;
  arcadeScreen.set(screen !== "menu" && !canPlay(screen) ? "menu" : screen);
}

export function closeArcade() {
  arcadeScreen.set(null);
}
