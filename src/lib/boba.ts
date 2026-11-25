import { writable } from "svelte/store";
import { track } from "#lib/analytics.ts";

// The boba arcade: a menu of small games behind the pixel boba on the
// homepage (and the Konami code). The layout owns the render; anything can
// open it through this store.

export type GameId = "catch" | "stab" | "orders" | "stack" | "lander" | "runner" | "spill";
type ArcadeScreen = "menu" | GameId;

interface GameInfo {
  id: GameId;
  /** Lowercase display name, in the site's voice. */
  name: string;
  /** One sentence for the menu. */
  blurb: string;
  /** Menu shortcut. */
  key: string;
  /** Catch steers a basket with the mouse, so it needs a fine pointer. */
  desktopOnly: boolean;
}

export const GAMES: GameInfo[] = [
  {
    id: "catch",
    name: "boba catch",
    blurb: "Cups fly out of the page’s links. Catch them in the basket.",
    key: "1",
    desktopOnly: true,
  },
  {
    id: "runner",
    name: "sugar rush",
    blurb: "Run the rooftops and deliver the tea before it spills.",
    key: "2",
    desktopOnly: false,
  },
  {
    id: "lander",
    name: "tea minus",
    blurb: "Land a cup of milk tea on the moon. The tea is also the fuel.",
    key: "3",
    desktopOnly: false,
  },
  {
    id: "stack",
    name: "cup stack",
    blurb: "Drop each cup on the last. Whatever hangs over gets sliced off.",
    key: "4",
    desktopOnly: false,
  },
  {
    id: "spill",
    name: "spill",
    blurb: "Draw straws to steer the pour into the cup.",
    key: "5",
    desktopOnly: false,
  },
  {
    id: "stab",
    name: "straw stab",
    blurb: "Punch a straw into every cup, right on the beat.",
    key: "6",
    desktopOnly: false,
  },
  {
    id: "orders",
    name: "order up",
    blurb: "Pour to the line, scoop the toppings, shake, and serve before anyone gives up.",
    key: "7",
    desktopOnly: false,
  },
];

// Games wired up but not built yet stay here, off the menu, until their
// screens exist. Move one into GAMES to switch it on.
export const UPCOMING: GameInfo[] = [];

function gameInfo(id: GameId) {
  return GAMES.find((game) => game.id === id) ?? GAMES[0];
}

/** Which arcade screen is open, or null when the arcade is closed. */
export const arcadeScreen = writable<ArcadeScreen | null>(null);

// Expert mode: one switch on the menu for every game. A game reads it when
// it opens and keeps it for as long as it is open (the switch lives only on
// the menu), and expert runs keep their own bests and their own boards. The
// choice is remembered on this device.
const EXPERT_KEY = "boba_expert_v1";

function readExpert() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EXPERT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Expert mode is on. Games read it with `get(arcadeExpert)` when they open. */
export const arcadeExpert = writable<boolean>(readExpert());

export function setExpert(on: boolean) {
  arcadeExpert.set(on);
  try {
    window.localStorage.setItem(EXPERT_KEY, on ? "1" : "0");
  } catch {
    // Storage can be off; the switch still holds for this visit.
  }
}

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
  const opened = screen !== "menu" && !canPlay(screen) ? "menu" : screen;
  arcadeScreen.set(opened);
  track("arcade_open", { screen: opened });
}

export function closeArcade() {
  arcadeScreen.set(null);
}
