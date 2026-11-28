/**
 * The stockroom: a block-walled back room with a high window, a steel and
 * timber rack of open crates (each showing what is in it, with a paper label
 * the view writes the count on), the clipboard stock is ordered from and a
 * cart with the pearl pot. One bulb hangs over the rack after dark.
 */
import { Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, contact, surface, brickAt, concreteAt, windowPane, hangingLamp, pool, beam, dim, ink, type Light, type Tone } from "./kit.ts";

export interface StockCrate {
  color: string;
  group: string;
  /** The oldest of it spoils by tomorrow. */
  soon: boolean;
}

const FLOOR = 206;
const UNIT_X = 96;
const BAY = 60;
const POST = 4;
const BOARDS = [88, 142, 196];
const CRATE_W = 46;
const CRATE_H = 26;
const CRATE_D = 8;

/** Each crate's front face, row by row, left to right. */
export const STOCK_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const column = i % 4;
  const row = Math.floor(i / 4);
  return { x: UNIT_X + column * BAY + POST + 5, y: BOARDS[row] - 4 - CRATE_H, w: CRATE_W, h: CRATE_H };
});

/** Where each crate's paper label is (the view writes on it). */
export const STOCK_LABEL = { dx: 4, dy: 6, w: 38, h: 14 };

/** Points the view hangs its keys on. */
export const STOCK_SPOTS = {
  order: { x: 46, y: 150 },
  batch: { x: 392, y: 186 },
  prev: { x: 84, y: 128 },
  next: { x: 348, y: 128 },
};

export function drawStockroom(p: Painter, light: Light, crates: readonly (StockCrate | null)[]) {
  const t = tone(light, 0.35, 0.4);
  const W = PLACE_W;
  const H = PLACE_H;

  // Block wall, a sage band of paint low down, a skirting board.
  surface(p, 0, 0, W, FLOOR, [t.front("#bdb19a"), t.front("#b4a890"), t.front("#9f937c")], brickAt(16, 8, 5));
  surface(p, 0, 152, W, FLOOR - 152, [t.front("#8e9b86"), t.front("#86937e"), t.front("#74806d")], brickAt(16, 8, 5));
  p.rect(t.top("#a7b39d"), 0, 150, W, 2);
  p.rect(t.front("#6d7866"), 0, 152, W, 1);
  p.rect(ink(t), 0, FLOOR - 6, W, 1);
  p.rect(t.front("#6e5242"), 0, FLOOR - 5, W, 5);
  p.rect(t.top("#8b6a54"), 0, FLOOR - 5, W, 1);
  // The ceiling: a timber beam and a pipe along it.
  p.rect(t.shade("#5e4a3e"), 0, 0, W, 9);
  p.rect(ink(t), 0, 9, W, 1);
  p.rect(t.front("#8d969a"), 0, 13, W, 3);
  p.rect(t.top("#b6bec0"), 0, 13, W, 1);
  for (let x = 30; x < W; x += 96) {
    p.rect(ink(t), x, 10, 2, 3);
    p.rect(t.front("#6f777b"), x - 2, 12, 6, 5);
  }
  p.dither(INK, 0, 10, W, 4, 0.25);

  // Concrete floor, darker where it meets the wall.
  surface(p, 0, FLOOR, W, H - FLOOR, [t.top("#a39a8c"), t.top("#9a9184"), t.top("#8a8174"), t.top("#b6ad9f")], concreteAt(72));
  p.dither(INK, 0, FLOOR, W, 5, 0.3);
  // A drain in the middle of the floor.
  p.rect(ink(t), 206, 246, 22, 6);
  for (let x = 208; x < 227; x += 3) p.rect(t.shade("#55504c"), x, 247, 2, 4);

  window(p, t);
  clipboard(p, t);
  pallet(p, t);
  rack(p, t, crates);
  cart(p, t);

  const lamp = hangingLamp(p, t, 186, 16, 18);
  // Daylight from the high window falls down the wall and across the floor.
  const day = light.sun * (1 - light.night) * 0.4;
  const lean = Math.round(light.azimuth * 80);
  beam(p, 24, 80, 72, 252, lean, day);
  if (lamp.on) {
    const n = Math.max(0.35, light.night);
    dim(p, lamp.x + 30, lamp.y + 90, 300, 230, 0.32 * light.night);
    pool(p, lamp.x + 20, lamp.y + 70, 230, 160, 0.3 * n);
    pool(p, lamp.x, lamp.y + 4, 40, 26, 0.5 * n, "#ffe2a8");
  }
}

function window(p: Painter, t: Tone) {
  windowPane(p, t, 24, 26, 56, 38, "#7f6352", 4);
}

function clipboard(p: Painter, t: Tone) {
  // A nail, the board and the order sheet, a pencil on a string.
  p.rect(ink(t), 30, 94, 28, 38);
  p.rect(t.front("#9a7454"), 31, 95, 26, 36);
  p.rect(t.front("#f3e6cc"), 34, 101, 20, 27);
  for (let i = 0; i < 6; i++) p.rect(t.front("#b9a78a"), 36, 106 + i * 4, 10 + Math.floor(noise(i, 0, 61) * 7), 1);
  p.rect(t.front("#c4574a"), 36, 106, 2, 1);
  p.rect(ink(t), 38, 92, 12, 5);
  p.rect(t.top("#b9c0c2"), 39, 93, 10, 3);
  p.rect(ink(t), 43, 89, 2, 3);
  p.line(t.shade("#7d6a58"), 57, 112, 62, 132);
  p.rect(ink(t), 60, 132, 4, 12);
  p.rect(t.front("#e0b85c"), 61, 133, 2, 9);
  p.rect(t.front("#f1d9b0"), 61, 142, 2, 1);
}

function pallet(p: Painter, t: Tone) {
  // A pallet of tapioca sacks on the floor by the door.
  box(p, t, 8, 240, 78, 6, 4, { top: "#b38a62", front: "#8c6648" });
  for (const x of [12, 44, 78]) p.rect(t.shade("#5e4434"), x, 241, 4, 5);
  sack(p, t, 14, 239, "#d8c39c");
  sack(p, t, 46, 239, "#cdb68d");
  sack(p, t, 30, 226, "#ddc8a2");
  contact(p, 8, 247, 78, 0.35);
}

function sack(p: Painter, t: Tone, x: number, base: number, cloth: string) {
  const w = 30;
  p.rect(ink(t), x + 2, base - 15, w - 4, 16);
  p.rect(ink(t), x, base - 12, w, 12);
  p.rect(t.front(cloth), x + 1, base - 12, w - 2, 11);
  p.rect(t.front(cloth), x + 3, base - 14, w - 6, 2);
  p.rect(t.top(mixHex(cloth, CREAM, 0.35)), x + 4, base - 14, w - 12, 1);
  p.rect(t.away(mixHex(cloth, INK, 0.18)), x + w - 6, base - 11, 4, 9);
  p.rect(t.front(mixHex(cloth, INK, 0.3)), x + 9, base - 9, 12, 1);
  p.rect(t.front("#8f6a4c"), x + 11, base - 7, 8, 1);
  for (let i = 0; i < 5; i++) p.rect(t.front(mixHex(cloth, INK, 0.12)), x + 4 + i * 5, base - 3, 2, 1);
}

function rack(p: Painter, t: Tone, crates: readonly (StockCrate | null)[]) {
  const right = UNIT_X + BAY * 4 + POST;
  const steel = "#617570";
  const wood = "#b48a60";
  // What sits on the top shelf: a spare carton and a stack of cup sleeves.
  box(p, t, UNIT_X, 34, right - UNIT_X, 5, 4, { top: wood, front: "#8f6847" });
  box(p, t, 112, 22, 30, 8, 6, { top: "#d4b184", front: "#c09a6c" });
  p.rect(t.front("#a27f56"), 112, 25, 30, 1);
  box(p, t, 238, 18, 14, 12, 4, { top: "#f2ead8", front: "#e4d8c0" });
  box(p, t, 256, 22, 14, 8, 4, { top: "#f2ead8", front: "#e4d8c0" });
  box(p, t, 296, 24, 22, 6, 5, { top: "#7f9a72", front: "#647c59" });
  for (const [r, y] of BOARDS.entries()) {
    for (let c = 0; c < 4; c++) {
      const crate = crates[r * 4 + c];
      const slot = STOCK_SLOTS[r * 4 + c];
      // The back of the bay in shadow, so what stands in it has room.
      p.alpha(0.16, () => p.rect(INK, UNIT_X + c * BAY + POST, y - 52, BAY - POST, 48));
      if (!crate) {
        // A chalked outline where a crate goes.
        p.alpha(0.3, () => {
          p.rect(CREAM, slot.x + 4, y - 6, slot.w - 8, 1);
          p.rect(CREAM, slot.x + 4, y - 9, 1, 3);
          p.rect(CREAM, slot.x + slot.w - 5, y - 9, 1, 3);
        });
      }
    }
    box(p, t, UNIT_X, y, right - UNIT_X, 5, 4, { top: wood, front: "#8f6847" });
    for (let c = 0; c < 4; c++) {
      const crate = crates[r * 4 + c];
      if (crate) drawCrate(p, t, STOCK_SLOTS[r * 4 + c], crate, r * 4 + c);
    }
  }
  // Uprights in front, feet on the floor.
  for (let k = 0; k <= 4; k++) {
    const x = UNIT_X + k * BAY;
    p.rect(ink(t), x - 1, 26, POST + 2, FLOOR + 6 - 26);
    p.rect(t.front(steel), x, 27, POST, FLOOR + 4 - 27);
    p.rect(t.left(mixHex(steel, CREAM, 0.3)), x, 27, 1, FLOOR + 4 - 27);
    p.rect(t.away(mixHex(steel, INK, 0.25)), x + POST - 1, 27, 1, FLOOR + 4 - 27);
    for (let y = 40; y < FLOOR; y += 9) p.rect(t.shade(mixHex(steel, INK, 0.45)), x + 1, y, 2, 2);
    p.rect(ink(t), x - 2, FLOOR + 3, POST + 4, 3);
    contact(p, x - 3, FLOOR + 6, POST + 6, 0.35);
  }
}

function drawCrate(p: Painter, t: Tone, s: { x: number; y: number; w: number; h: number }, crate: StockCrate, seed: number) {
  const { x, y, w, h } = s;
  const kraft = "#c39a6a";
  // Its shadow on the bay's back, thrown away from the bulb or the window.
  p.alpha(0.22, () => p.rect(INK, x + 3, y - CRATE_D + 3, w, h + CRATE_D - 3));
  p.rect(ink(t), x - 1, y - CRATE_D - 1, w + 2, h + CRATE_D + 2);
  // The open top: a rim and what is in it.
  p.rect(t.top("#d9b583"), x, y - CRATE_D, w, CRATE_D);
  p.rect(t.shade("#6b4c37"), x + 2, y - CRATE_D + 1, w - 4, CRATE_D - 2);
  contents(p, t, x + 2, y - CRATE_D + 1, w - 4, CRATE_D - 2, crate, seed);
  // The front: three slats, corner posts, nail heads.
  p.rect(t.front(kraft), x, y, w, h);
  p.rect(t.front(mixHex(kraft, CREAM, 0.25)), x, y, w, 1);
  p.rect(t.front(mixHex(kraft, INK, 0.25)), x, y + 8, w, 1);
  p.rect(t.front(mixHex(kraft, INK, 0.25)), x, y + 17, w, 1);
  p.rect(t.front(mixHex(kraft, INK, 0.12)), x, y + 9, w, 1);
  p.rect(t.left(mixHex(kraft, INK, 0.1)), x, y + 1, 3, h - 1);
  p.rect(t.away(mixHex(kraft, INK, 0.22)), x + w - 3, y + 1, 3, h - 1);
  for (const ny of [y + 3, y + 12, y + 21]) {
    p.rect(t.shade("#5a4436"), x + 1, ny, 1, 1);
    p.rect(t.shade("#5a4436"), x + w - 2, ny, 1, 1);
  }
  p.rect(t.front(mixHex(kraft, INK, 0.3)), x, y + h - 1, w, 1);
  // A paper label, pink when the oldest of it is going off.
  const lx = x + STOCK_LABEL.dx;
  const ly = y + STOCK_LABEL.dy;
  const paper = crate.soon ? "#f0b4a2" : "#f4e8d0";
  p.rect(t.shade(mixHex(kraft, INK, 0.4)), lx + 1, ly + 1, STOCK_LABEL.w, STOCK_LABEL.h);
  p.rect(t.front(paper), lx, ly, STOCK_LABEL.w, STOCK_LABEL.h);
  p.rect(t.front(mixHex(paper, CREAM, 0.5)), lx, ly, STOCK_LABEL.w, 1);
  p.rect(t.front(crate.color), lx, ly + STOCK_LABEL.h - 2, STOCK_LABEL.w, 2);
  if (crate.soon) {
    // A red tag on a string from the corner.
    p.line(t.shade("#7d6a58"), x + w - 4, y + 1, x + w + 2, y + 8);
    p.rect(ink(t), x + w, y + 7, 7, 9);
    p.rect(t.front("#c4574a"), x + w + 1, y + 8, 5, 7);
    p.rect(t.front("#e48f88"), x + w + 1, y + 8, 5, 1);
  }
}

/** What fills an open crate, by kind: leaves, fruit, bottles, cartons, tubs. */
function contents(p: Painter, t: Tone, x: number, y: number, w: number, h: number, crate: StockCrate, seed: number) {
  const c = crate.color;
  const dark = t.shade(mixHex(c, INK, 0.35));
  const mid = t.top(c);
  const hi = t.top(mixHex(c, CREAM, 0.45));
  switch (crate.group) {
    case "fruit": {
      // A heap of round fruit, rising over the rim.
      for (let i = 0; i < 7; i++) {
        const fx = x + 3 + i * 6 + (i % 2);
        const fy = y + 2 - (i % 2 ? 2 : 0) - Math.round(Math.sin((i / 6) * Math.PI) * 2);
        p.oval(ink(t), fx, fy, 3, 3);
        p.oval(mid, fx, fy, 2, 2);
        p.rect(hi, fx - 1, fy - 1, 1, 1);
        if (noise(i, seed, 3) > 0.6) p.rect(t.top("#6f9260"), fx, fy - 3, 2, 1);
      }
      break;
    }
    case "syrup":
    case "finish": {
      // Bottles standing in a row, necks over the rim.
      for (let i = 0; i < 6; i++) {
        const bx = x + 3 + i * 7;
        p.rect(ink(t), bx - 1, y - 6, 6, h + 6);
        p.rect(mid, bx, y - 2, 4, h + 2);
        p.rect(hi, bx, y - 2, 1, h + 1);
        p.rect(t.top("#e9dfca"), bx + 1, y - 5, 2, 3);
        p.rect(t.top("#c4574a"), bx + 1, y - 6, 2, 1);
      }
      break;
    }
    case "milk": {
      // Cartons with gabled tops.
      for (let i = 0; i < 5; i++) {
        const bx = x + 2 + i * 8;
        p.rect(ink(t), bx - 1, y - 6, 8, h + 6);
        p.rect(t.top("#f4efe4"), bx, y - 3, 6, h + 3);
        p.rect(t.top(c), bx, y + 1, 6, 2);
        p.poly(t.top("#fbf7ee"), [bx, y - 3, bx + 3, y - 6, bx + 6, y - 3]);
      }
      break;
    }
    case "topping": {
      // Tubs with lids, the colour showing at the rim.
      for (let i = 0; i < 4; i++) {
        const bx = x + 2 + i * 10;
        p.rect(ink(t), bx - 1, y - 3, 10, h + 3);
        p.rect(t.top("#efe8da"), bx, y - 2, 8, h + 2);
        p.rect(mid, bx, y - 2, 8, 2);
        p.rect(hi, bx + 1, y - 2, 3, 1);
      }
      break;
    }
    case "side": {
      // Paper packets, folded over.
      for (let i = 0; i < 4; i++) {
        const bx = x + 1 + i * 10;
        p.rect(ink(t), bx, y - 4, 10, h + 4);
        p.rect(t.top("#e8d6b4"), bx + 1, y - 3, 8, h + 3);
        p.rect(mid, bx + 1, y, 8, 2);
      }
      break;
    }
    default: {
      // Loose leaves or powder, heaped, specked light and dark.
      p.rect(mid, x, y + 1, w, h - 1);
      for (let i = 0; i < w; i++) {
        const top = Math.round(Math.sin((i / w) * Math.PI) * 2);
        p.rect(mid, x + i, y + 1 - top, 1, top);
      }
      for (let i = 0; i < 26; i++) {
        const sx = x + Math.floor(noise(i, seed, 5) * w);
        const sy = y + Math.floor(noise(i, seed, 6) * h);
        p.rect(i % 3 ? dark : hi, sx, sy, 1, 1);
      }
    }
  }
}

function cart(p: Painter, t: Tone) {
  const x = 362;
  const w = 62;
  const steel = "#9aa3a3";
  // A steel cart on casters.
  box(p, t, x, 164, w, 34, 8, { top: "#c3cbca", front: steel });
  p.rect(t.front(mixHex(steel, INK, 0.25)), x + 4, 172, w - 8, 1);
  p.rect(t.front(mixHex(steel, INK, 0.25)), x + 4, 186, w - 8, 1);
  for (const cx of [x + 4, x + w - 9]) {
    p.rect(ink(t), cx, 198, 6, 7);
    p.rect(t.shade("#3e3a3c"), cx + 1, 200, 4, 4);
  }
  contact(p, x, FLOOR + 2, w, 0.35);
  // The hot plate and its knob.
  box(p, t, x + 8, 154, 46, 3, 2, { top: "#3e3739", front: "#2f2a2c" });
  p.rect(t.front("#d9534f"), x + 48, 155, 2, 1);
  // The pearl pot, lid ajar over a dark simmer.
  const px = x + 12;
  const pw = 38;
  p.rect(ink(t), px - 1, 129, pw + 2, 26);
  p.rect(t.front("#b6bcbc"), px, 132, pw, 22);
  p.rect(t.left("#d6dcdc"), px, 132, 4, 22);
  p.rect(t.away("#868d8e"), px + pw - 5, 132, 5, 22);
  p.rect(t.front("#8f9697"), px, 140, pw, 1);
  p.rect(ink(t), px - 5, 136, 5, 3);
  p.rect(ink(t), px + pw, 136, 5, 3);
  p.oval(ink(t), px + pw / 2, 131, pw / 2 + 1, 4);
  p.oval(t.shade("#4a3430"), px + pw / 2, 131, pw / 2 - 1, 3);
  for (let i = 0; i < 12; i++) p.rect(t.top(i % 3 ? "#3a2a28" : "#6b4a3b"), px + 6 + ((i * 7) % (pw - 10)), 130 + (i % 3), 2, 1);
  // The lid leant against the pot's side and a ladle in the simmer.
  p.oval(ink(t), px + pw + 6, 140, 4, 11);
  p.oval(t.right("#c9cfce"), px + pw + 6, 140, 3, 10);
  p.rect(t.right("#e6eaea"), px + pw + 5, 132, 1, 14);
  p.rect(ink(t), px + pw + 4, 138, 3, 4);
  for (let i = 0; i < 16; i++) p.rect(ink(t), px + 8 - Math.round(i * 0.5), 128 - i, 3, 1);
  for (let i = 0; i < 15; i++) p.rect(t.left("#cfd5d4"), px + 9 - Math.round(i * 0.5), 128 - i, 1, 1);
  p.rect(ink(t), px - 2, 110, 5, 3);
  // A sign of what it is.
  p.rect(ink(t), x + 18, 176, 28, 8);
  p.rect(t.front("#f1e3c6"), x + 19, 177, 26, 6);
  for (let i = 0; i < 5; i++) p.oval(t.front("#3a2a28"), x + 23 + i * 5, 180, 1, 1);
}
