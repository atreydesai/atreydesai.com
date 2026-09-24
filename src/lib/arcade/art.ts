// Shared pixel art and canvas helpers for the boba arcade. Sprite colors are
// game art (the style guide's expressive exception), not UI tokens; anything
// drawn as a riso mark reads its colors from `risoColors()` so it follows the
// theme.

export type Palette = Record<string, string>;
export type Grid = string[];

export const INK = "#2b2320";
export const PEARL = "#2b1a12";
export const LID = "#ece3d6";
export const STRAW_PINK = "#ff5277";
export const PAPER_WHITE = "#fdf8f3";

export const DRINKS = [
  "#b388e0",
  "#8bbf5a",
  "#c79a6b",
  "#f47ba0",
  "#f4b942",
  "#6aa6e0",
  "#9fd17a",
  "#e76f8e",
];

// Hand-drawn pen loops, the same family as the homepage interest markers.
// Drawn in a 44 × 28 box; none of them closes cleanly.
export const LOOPS = [
  "M4.5 9.0C6.4 8.0 11.6 3.9 15.8 3.2C20.0 2.4 25.4 3.3 29.5 4.4C33.6 5.4 39.0 7.4 40.6 9.6C42.1 11.9 40.2 15.3 38.6 17.8C37.0 20.3 34.5 23.6 31.0 24.6C27.4 25.6 21.2 25.0 17.3 24.0C13.5 23.1 10.5 21.0 7.9 19.0C5.3 17.0 1.1 14.2 1.9 12.1C2.8 10.1 11.1 7.5 12.9 6.6",
  "M5.5 10.4C7.2 9.5 11.6 6.1 15.6 5.1C19.5 4.2 25.7 3.8 29.3 4.5C33.0 5.1 35.6 7.0 37.4 9.2C39.1 11.4 40.8 15.4 39.8 17.9C38.9 20.4 35.4 23.3 31.7 24.1C27.9 24.9 21.7 23.5 17.4 22.6C13.0 21.7 8.0 20.6 5.7 18.6C3.5 16.6 2.8 12.5 3.9 10.6C5.0 8.6 10.9 7.4 12.3 6.8",
  "M6.8 10.0C8.1 9.2 11.1 6.2 14.6 5.1C18.1 4.1 24.1 3.0 27.9 3.7C31.8 4.3 35.6 7.0 37.6 9.3C39.5 11.5 41.2 14.9 39.8 17.0C38.4 19.1 33.1 20.5 29.3 21.8C25.5 23.0 20.8 24.7 16.9 24.3C13.0 23.9 7.6 21.3 5.9 19.3C4.1 17.3 5.3 15.0 6.3 12.5C7.2 10.0 10.8 5.4 11.8 4.0",
];
export const LOOP_BOX = { width: 44, height: 28 };

// --- HUD icons ------------------------------------------------------------

export const ICON_BOBA: Grid = [
  "...S...",
  "...S...",
  "OOOOOOO",
  ".OLLLO.",
  ".OLLLO.",
  ".ObLbO.",
  ".OLbLO.",
  "..OOO..",
];
export const ICON_BOBA_PAL: Palette = {
  O: "currentColor",
  L: "#c79a6b",
  b: PEARL,
  S: STRAW_PINK,
};

export const ICON_NOTE: Grid = [
  "...N.",
  "...NN",
  "...NN",
  "...N.",
  "...N.",
  "NN.N.",
  "NNNN.",
  "NNN..",
];
export const NOTE_PAL: Palette = { N: "#e85d4c" };

export const ICON_SPEAKER: Grid = [
  "....A....",
  "...AA..W.",
  "AAAAA.W.W",
  "AAAAA.W.W",
  "AAAAA.W.W",
  "...AA..W.",
  "....A....",
];
export const ICON_MUTE: Grid = [
  "....A....",
  "...AA....",
  "AAAAA.X.X",
  "AAAAA..X.",
  "AAAAA.X.X",
  "...AA....",
  "....A....",
];
export const ICON_PAUSE: Grid = [
  "PP..PP",
  "PP..PP",
  "PP..PP",
  "PP..PP",
  "PP..PP",
  "PP..PP",
];
export const ICON_PLAY: Grid = [
  "P.....",
  "PPP...",
  "PPPPP.",
  "PPPPP.",
  "PPP...",
  "P.....",
];
export const ICON_AUDIO_PAL: Palette = {
  A: "currentColor",
  W: "#e85d4c",
  X: "currentColor",
  P: "currentColor",
};

// --- Menu icons: one little scene per game ----------------------------------

export const MENU_ICONS: Record<string, { grid: Grid; palette: Palette }> = {
  catch: {
    grid: [
      "...S.....",
      "...S.....",
      ".OOOOO...",
      "..OLO....",
      "..ObO....",
      "...O.....",
      ".........",
      "DDDDDDDDD",
      ".DgDgDgD.",
      "..DDDDD..",
    ],
    palette: { O: "currentColor", L: "#c79a6b", b: PEARL, S: STRAW_PINK, D: "currentColor", g: "#8f8f8f" },
  },
  stab: {
    grid: [
      "....S....",
      "....W....",
      "....S....",
      "OOOOSOOOO",
      "OfFfSfFfO",
      "OOOOSOOOO",
      ".OLLSLLO.",
      ".ObLbLbO.",
      "..OOOOO..",
    ],
    palette: { O: "currentColor", f: PAPER_WHITE, F: "#e85d4c", S: STRAW_PINK, W: PAPER_WHITE, L: "#f47ba0", b: PEARL },
  },
  orders: {
    grid: [
      "OOOOOOOOO",
      "OpppppppO",
      "OpiiiippO",
      "OpppppppO",
      "OpiiiiipO",
      "OpppppppO",
      "OpiiipppO",
      "OpppppppO",
      "OpAAAAApO",
      "O.O.O.O.O",
    ],
    palette: { O: "currentColor", p: PAPER_WHITE, i: INK, A: "#e85d4c" },
  },
  stack: {
    grid: [
      "..OOOOO..",
      "..OLLLO..",
      "...OOO...",
      ".OOOOOOO.",
      ".OMMMMMO.",
      "..OOOOO..",
      "OOOOOOOOO",
      "ONNNNNNNO",
      ".OOOOOOO.",
    ],
    palette: { O: "currentColor", L: "#b388e0", M: "#8bbf5a", N: "#f47ba0" },
  },
};

// --- Canvas ---------------------------------------------------------------

/** Sizes a full-viewport canvas for the device pixel ratio. */
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  if (context) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;
  }
  return context;
}

/** Draws columns [from, to) of a sprite grid. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
  px: number,
  palette: Palette,
  from = 0,
  to = Infinity,
) {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    const end = Math.min(line.length, to);
    for (let column = Math.max(0, from); column < end; column++) {
      const character = line[column];
      if (character === ".") continue;
      const color = palette[character];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(x + (column - from) * px),
        Math.round(y + row * px),
        px,
        px,
      );
    }
  }
}

export function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
  px: number,
  color: string,
  from = 0,
  to = Infinity,
) {
  ctx.fillStyle = color;
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    const end = Math.min(line.length, to);
    for (let column = Math.max(0, from); column < end; column++) {
      if (line[column] === ".") continue;
      ctx.fillRect(
        Math.round(x + (column - from) * px),
        Math.round(y + row * px),
        px,
        px,
      );
    }
  }
}

const HALO_OFFSETS = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
];

/** A paper-coloured outline that keeps dark sprite edges readable on any page. */
export function drawHalo(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
  px: number,
  color: string,
  from = 0,
  to = Infinity,
) {
  for (const [offsetX, offsetY] of HALO_OFFSETS) {
    drawSilhouette(ctx, grid, x + offsetX, y + offsetY, px, color, from, to);
  }
}

// Sprites are redrawn every frame, so each distinct one (grid, size, colors,
// halo) is rendered once to a small canvas and reused. Pixel art survives
// the device-pixel scale because the main canvas draws without smoothing.
const spriteCache = new Map<string, HTMLCanvasElement>();
export const SPRITE_PAD = 2;

/**
 * A reusable canvas of `grid` drawn at `px`, padded by SPRITE_PAD on every
 * side for the halo. `key` must identify the grid and palette.
 */
export function cachedSprite(
  key: string,
  grid: Grid,
  px: number,
  palette: Palette,
  halo = "",
) {
  const id = `${key}|${px}|${halo}`;
  const cached = spriteCache.get(id);
  if (cached) return cached;
  const columns = grid.reduce((widest, row) => Math.max(widest, row.length), 0);
  const sprite = document.createElement("canvas");
  sprite.width = columns * px + SPRITE_PAD * 2;
  sprite.height = grid.length * px + SPRITE_PAD * 2;
  const context = sprite.getContext("2d");
  if (context) {
    if (halo) drawHalo(context, grid, SPRITE_PAD, SPRITE_PAD, px, halo);
    drawSprite(context, grid, SPRITE_PAD, SPRITE_PAD, px, palette);
  }
  if (spriteCache.size > 600) spriteCache.clear();
  spriteCache.set(id, sprite);
  return sprite;
}

export function isDarkTheme() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/** Theme colors for marks drawn on canvas in the riso style. */
export function risoColors(dark = isDarkTheme()) {
  return dark
    ? { ink: "#fdf8f3", paper: "#2a2422", slab: "#f07563", muted: "#e8d5c4", halo: "rgba(26, 26, 26, 0.7)" }
    : { ink: "#1a1a1a", paper: "#fbf2e8", slab: "#e85d4c", muted: "#666666", halo: "rgba(253, 248, 243, 0.8)" };
}

export function arcadeFont(size = 13, weight = 500) {
  const family =
    typeof document === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return `${weight} ${size}px ${family || "monospace"}`;
}

const loopPaths = new Map<number, Path2D>();

/**
 * Strokes pen loop `index` into a box, with its accent print misregistered
 * behind it, the canvas version of the riso marks in the HUD.
 */
export function drawLoop(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  colors = risoColors(),
  lineWidth = 2,
) {
  const key = index % LOOPS.length;
  let path = loopPaths.get(key);
  if (!path) {
    path = new Path2D(LOOPS[key]);
    loopPaths.set(key, path);
  }
  const scaleX = width / LOOP_BOX.width;
  const scaleY = height / LOOP_BOX.height;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [color, offset] of [
    [colors.slab, 3],
    [colors.ink, 0],
  ] as const) {
    ctx.save();
    ctx.translate(x + offset, y + offset);
    ctx.scale(scaleX, scaleY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / Math.min(scaleX, scaleY);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

// --- Particles and popups -------------------------------------------------

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

export function addParticle(
  list: Particle[],
  x: number,
  y: number,
  color: string,
  speed = 90,
  gravity = 260,
) {
  const life = 0.38 + Math.random() * 0.22;
  list.push({
    x,
    y,
    vx: (Math.random() - 0.5) * speed * 2,
    vy: -30 - Math.random() * speed,
    gravity,
    size: Math.random() > 0.65 ? 4 : 3,
    life,
    maxLife: life,
    color,
  });
}

export function stepParticles(list: Particle[], dt: number) {
  for (let index = list.length - 1; index >= 0; index--) {
    const particle = list[index];
    particle.life -= dt;
    if (particle.life <= 0) {
      list.splice(index, 1);
      continue;
    }
    particle.vy += particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const particle of list) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.round(particle.x),
      Math.round(particle.y),
      particle.size,
      particle.size,
    );
    ctx.restore();
  }
}

export type PopupKind = "plain" | "perfect" | "gold" | "miss";

export interface Popup {
  x: number;
  y: number;
  text: string;
  kind: PopupKind;
  life: number;
  maxLife: number;
}

// Canvas text sits on the page, so it takes the page's text colors:
// ink / accent-dark / ochre-dark in light, and their light shades in dark.
const POPUP_LIGHT: Record<PopupKind, string> = {
  plain: "#1a1a1a",
  perfect: "#c9462f",
  gold: "#704a05",
  miss: "#c9462f",
};
const POPUP_DARK: Record<PopupKind, string> = {
  plain: "#fdf8f3",
  perfect: "#f18272",
  gold: "#dba84d",
  miss: "#f18272",
};

export function addPopup(
  list: Popup[],
  x: number,
  y: number,
  text: string,
  kind: PopupKind = "plain",
  life = 0.72,
) {
  list.push({ x, y, text, kind, life, maxLife: life });
}

export function stepPopups(list: Popup[], dt: number, rise = 24) {
  for (let index = list.length - 1; index >= 0; index--) {
    const popup = list[index];
    popup.life -= dt;
    if (popup.life <= 0) {
      list.splice(index, 1);
      continue;
    }
    popup.y -= rise * dt;
  }
}

export function drawPopups(ctx: CanvasRenderingContext2D, list: Popup[], font: string) {
  if (!list.length) return;
  const dark = isDarkTheme();
  const colors = dark ? POPUP_DARK : POPUP_LIGHT;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = dark ? "rgba(26, 26, 26, 0.9)" : "rgba(253, 248, 243, 0.95)";
  for (const popup of list) {
    const x = Math.round(popup.x);
    const y = Math.round(popup.y);
    ctx.globalAlpha = Math.max(0, popup.life / popup.maxLife);
    ctx.strokeText(popup.text, x, y);
    ctx.fillStyle = colors[popup.kind];
    ctx.fillText(popup.text, x, y);
  }
  ctx.restore();
}
