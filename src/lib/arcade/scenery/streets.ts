import { bayer } from "#lib/arcade/core/dither.ts";
import { skyline } from "./ascent";
import { hash, HEIGHT, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintGroundedProp, paintProp } from "./props";

let rainySky: HTMLCanvasElement;
export function paintRoute(p: Pixels, time: number) {
  rainySky ??= raster(WIDTH, HEIGHT, (q) => q.bands("#252d43", "#424762", "#78606e", 50, 19));
  p.image(rainySky, 0, 0);
  p.oval("#6e677a", 255, 46, 21, 20);
  p.rect("#766b80", 227, 48, 79);
  p.rect("#625d77", 213, 51, 93, 2);
  skyline(p, 116, -time * 3, 0, true);
  skyline(p, 133, -time * 8, 1, true);
  p.rect("#363449", 0, 119, WIDTH, 4);
  p.rect("#6d596a", 0, 118, WIDTH);
  for (let x = 7; x < WIDTH; x += 39) p.rect("#3b394f", x, 122, 5, 19);
  paintProp(p, "tram", wrap(time * 24 + 190, 390) - 61, 103);
  skyline(p, 152, -time * 19, 2, true);
  for (let i = 0; i < 4; i++) {
    const x = wrap(-time * 21 + 34 + i * 94, 376) - 30;
    paintProp(p, i % 2 ? "awning" : "tank", x, i % 2 ? 105 : 91);
  }

  for (let i = 0; i < 47; i++) {
    const x = wrap(hash(i + 509) * 320 + time * 25, WIDTH);
    const y = wrap(hash(i + 521) * 155 + time * (44 + i % 17), 146);
    p.line(i % 8 ? "#626a82" : "#888599", x, y, x + 2, y + 4);
  }
  p.rect("#322f40", 0, 137, WIDTH, 31);
  p.rect("#665e77", 0, 137, WIDTH, 2);
  p.rect("#4e445c", 0, 140, WIDTH, 4);
  for (let i = 0; i < 18; i++) {
    const x = wrap(i * 53 - time * 31, 320);
    const y = 146 + i % 19;
    p.rect(i % 3 ? "#494359" : "#7a606c", x, y, 5 + i % 7);
  }
  p.oval("#292735", 58, 138, 13, 2);
  p.oval("#292735", 272, 138, 7, 2);
  p.oval("#292735", 214, 141, 15, 6);
  paintProp(p, "vent", 45, 119);
  paintProp(p, "signal", 265, 113);
  paintGroundedProp(p, "courier-crate", 211, 140);
}

const farRidge = [[0, 95], [26, 81], [48, 92], [72, 64], [86, 82], [100, 78], [141, 109], [162, 93], [181, 99], [214, 76], [231, 88], [245, 82], [280, 94], [320, 71]];
const nearRidge = [[0, 112], [29, 107], [48, 110], [61, 102], [83, 109], [113, 114], [140, 114], [161, 112], [176, 114], [185, 123], [197, 148], [214, 155], [229, 149], [236, 126], [244, 111], [278, 110], [301, 97], [320, 110]];

function ridgeline(p: Pixels, points: number[][], face: string, strata: string[]) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    for (let x = x0; x < x1; x++) {
      const y = Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
      p.rect(face, x, y, 1, HEIGHT - y);
      strata.forEach((color, line) => {
        const offset = line * (i > 9 && i < 16 ? 5 : 8);
        p.rect(color, x, y + offset, 1, line === 0 ? 1 : 2);
        if (line > 0 && (x + line) % 3 === 0) p.rect(color, x, y + offset + 2);
      });
    }
  }
}

let rille: HTMLCanvasElement;
function rillePlate(p: Pixels) {
  p.bands("#13192c", "#242e46", "#515873", 63, 18);
  for (let i = 0; i < 55; i++) p.rect(i % 6 ? "#53627f" : "#8d959e", hash(i + 901) * 315, hash(i + 177) * 94);
  p.oval("#605f78", 244, 44, 29, 28);
  p.oval("#879795", 242, 43, 25, 25);
  p.oval("#7f8992", 239, 36, 21, 17);
  p.oval("#a2a79d", 229, 35, 8, 6);
  p.oval("#9aa6a2", 232, 49, 11, 4);
  p.oval("#1d2338", 257, 36, 23, 23);
  ridgeline(p, farRidge, "#424c67", ["#647189", "#56617e"]);
  ridgeline(p, nearRidge, "#666e83", ["#90939b", "#777985", "#555d75", "#776c7b"]);
  for (let y = 119; y < HEIGHT; y += 2) {
    for (let x = 1; x < WIDTH; x += 2) {
      if (x > 177 && x < 253 && y < 151) continue;
      if (hash(x + y * WIDTH) > 0.96) p.rect("#8e8f98", x, y, 2 + (x % 4));
    }
  }
  // A packed track on the left bank and a small service terrace beyond the rille.
  p.line("#777884", 5, 118, 93, 118, 5);
  p.line("#93929b", 5, 117, 93, 117);
  p.line("#5d6073", 8, 122, 90, 122);
  p.line("#84838d", 243, 119, 277, 117, 4);
  p.line("#756f7d", 241, 124, 281, 122, 2);
  p.oval("#56596c", 260, 120, 16, 5);
  p.oval("#484d63", 270, 122, 13, 2);
  p.oval("#55586b", 297, 117, 20, 3);
  paintGroundedProp(p, "lunar-beacon", 258, 119);
  paintProp(p, "relay", 277, 84);
  p.rect("#55586c", 96, 118, 11, 2);
  paintProp(p, "pennant", 95, 92);
}

export function paintRille(p: Pixels, time: number) {
  rille ??= raster(WIDTH, HEIGHT, rillePlate);
  p.image(rille, 0, 0);
  const x = 28 + Math.sin(time / 6) * 19;
  p.oval("#5d6176", x + 19, 119, 18, 2);
  paintProp(p, "rover", x, 93);
  if (Math.floor(time * 1.4) % 2 === 0) p.rect("#deb481", 294, 107, 5, 2);
}

let print: HTMLCanvasElement;
export function paintCatch(p: Pixels) {
  print ??= raster(WIDTH, HEIGHT, (q) => {
    q.rect("#efe0cb", 0, 0, WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y += 2) {
      for (let x = 0; x < WIDTH; x += 2) {
        if (bayer(x + y % 3, y + x % 5) < 0.19 && hash(x + y * WIDTH) < 0.65) q.rect("#e5d1b8", x, y);
      }
    }
    q.rect("#dabfa7", 27, 22, 203, 117);
    q.rect("#faedda", 25, 18, 203, 117);
    q.rect("#dec8b3", 43, 43, 166);
    q.rect("#8f6d60", 43, 31, 50, 3);
    q.rect("#bfa78f", 43, 37, 71, 2);
    for (let row = 0; row < 8; row++) {
      const y = 51 + row * 9;
      q.rect("#ac9483", 43, y, 84 + row * 47 % 72, 2);
      q.rect("#d8c1a9", 43, y + 4, 73 + row * 13 % 61);
      if (row % 3 === 0) {
        q.rect("#b27664", 35, y, 5, 2);
        q.rect("#c77461", 43, y + 2, 32 + row, 1);
      }
    }
    q.rect("#ad625c", 238, 42, 42, 29);
    q.rect("#dd917e", 236, 38, 42, 31);
    q.rect("#f0b59b", 241, 43, 31, 21);
    q.rect("#9d6156", 235, 44, 45);
    paintProp(q, "ticket", 243, 81);
  });
  p.image(print, 0, 0);
  paintProp(p, "takeaway", 251, 116);
}
