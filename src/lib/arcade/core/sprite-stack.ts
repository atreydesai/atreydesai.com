// Sprite stacking, in the arcade's own sprite format. An object is a row of
// flat slices, ground slice first, each a top-down pixel grid of one layer.
// To draw it turned, every slice is turned by the same angle (nearest
// neighbour, so pixels stay crisp), squashed for a camera that looks down at
// a slant, and lifted one pixel per slice, later slices covering earlier
// ones; then the finished stack is outlined once, never slice by slice.
//
// The result is an ordinary grid of palette characters, so it goes through
// the same `cachedSprite` / `drawSprite` as every other sprite: no second
// renderer. Turns are quantised (`TURN_STEPS`), so a turning object costs a
// handful of cached grids. Used sparingly, for a round thing that turns in
// place (a finished drink on the counter), where one model beats a drawing
// per angle.
//
// DOM-free: grids in, grid out.

export type Grid = readonly string[];

/** Distinct turns a stack is drawn at; finer turns would only move pixels in jumps anyway. */
export const TURN_STEPS = 48;

export interface StackOptions {
  /** Radians; 0 draws every slice as it is. */
  turn?: number;
  /** Vertical scale for the camera's slant: 1 is straight down, 0.75 a little lower. */
  squash?: number;
  /** Rows of lift between slices. */
  spacing?: number;
  /** A palette character drawn once around the finished stack ("" for none). */
  outline?: string;
  /**
   * Columns each slice shifts sideways from the one under it: a stack that
   * leans (a rider swaying, a tray tipping) rather than turns. 0 stands upright.
   */
  shear?: number;
}

export interface Stacked {
  grid: string[];
  /** Where the ground slice's centre lands in `grid`, in cells: place this on the ground point. */
  anchorX: number;
  anchorY: number;
}

const EMPTY = ".";

/** A turn snapped to the nearest of `TURN_STEPS`, in radians. */
export function quantizeTurn(turn: number) {
  const step = (Math.PI * 2) / TURN_STEPS;
  return Math.round(turn / step) * step;
}

/**
 * Stacks `slices` (each the same width and height, ground first) into one
 * grid seen from above at a slant and turned by `turn`.
 */
export function stackGrid(
  slices: readonly Grid[],
  { turn = 0, squash = 0.75, spacing = 1, outline = "", shear = 0 }: StackOptions = {},
): Stacked {
  const count = slices.length;
  const h = count ? slices[0].length : 0;
  const w = h ? slices[0][0].length : 0;
  if (!count || !w || !h) return { grid: [], anchorX: 0, anchorY: 0 };
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  // Exactly the slice's own size when it isn't turned, so turn 0 is pixel-exact.
  const straight = Math.abs(sin) < 1e-9;
  const flip = straight && cos < 0;
  const tw = straight ? w : Math.ceil(Math.abs(w * cos) + Math.abs(h * sin) - 1e-9);
  const th = straight ? h : Math.ceil(Math.abs(w * sin) + Math.abs(h * cos) - 1e-9);
  const sh = Math.max(1, Math.round(th * squash));
  const lift = Math.round((count - 1) * spacing);
  const pad = outline ? 1 : 0;
  const lean = Math.ceil(Math.abs(shear) * (count - 1) - 1e-9);
  const base = shear < 0 ? lean : 0;
  const W = tw + lean + pad * 2;
  const H = sh + lift + pad * 2;
  const cells: string[][] = Array.from({ length: H }, () => Array(W).fill(EMPTY));

  for (let z = 0; z < count; z++) {
    const slice = slices[z];
    const up = Math.round(z * spacing);
    const side = base + Math.round(z * shear);
    for (let oy = 0; oy < sh; oy++) {
      // Undo the squash, then the turn, to find the slice cell under this one.
      const ry = ((oy + 0.5) / sh) * th - th / 2;
      for (let ox = 0; ox < tw; ox++) {
        const rx = ox + 0.5 - tw / 2;
        let sx: number;
        let sy: number;
        if (straight) {
          sx = flip ? w - 1 - ox : ox;
          sy = flip ? h - 1 - Math.floor(((oy + 0.5) / sh) * th) : Math.floor(((oy + 0.5) / sh) * th);
        } else {
          sx = Math.floor(rx * cos + ry * sin + w / 2);
          sy = Math.floor(-rx * sin + ry * cos + h / 2);
        }
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const ch = slice[sy][sx];
        if (ch === EMPTY || ch === " ") continue;
        cells[pad + lift - up + oy][pad + side + ox] = ch;
      }
    }
  }

  if (outline) {
    const solid = cells.map((row) => row.map((ch) => ch !== EMPTY));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (solid[y][x]) continue;
        if ((y > 0 && solid[y - 1][x]) || (y < H - 1 && solid[y + 1][x]) || (x > 0 && solid[y][x - 1]) || (x < W - 1 && solid[y][x + 1])) {
          cells[y][x] = outline;
        }
      }
    }
  }

  return { grid: cells.map((row) => row.join("")), anchorX: pad + base + tw / 2, anchorY: pad + lift + sh / 2 };
}

export interface LatheLayer {
  /** Radius of this layer, in cells. */
  r: number;
  /** Fill character. */
  fill: string;
  /** Character for the layer's outer ring of cells (its visible side); defaults to `fill`. */
  rim?: string;
}

/**
 * Slices for a round object, from its profile: one layer per slice, ground
 * first, each a disc of its radius. For something round, all four side
 * views are this profile, so this is slicing from views done exactly.
 * `paint` may change any cell (a straw, pearls in the tea, a label).
 */
export function latheSlices(
  layers: readonly LatheLayer[],
  size: number,
  paint?: (z: number, x: number, y: number, ch: string) => string,
): string[][] {
  const c = (size - 1) / 2;
  return layers.map((layer, z) => {
    const rows: string[] = [];
    for (let y = 0; y < size; y++) {
      let row = "";
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c);
        let ch = d <= layer.r + 0.2 ? (d > layer.r - 1 ? (layer.rim ?? layer.fill) : layer.fill) : EMPTY;
        if (paint) ch = paint(z, x, y, ch);
        row += ch;
      }
      rows.push(row);
    }
    return rows;
  });
}
