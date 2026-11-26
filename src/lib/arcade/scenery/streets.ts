import { bayer } from "#lib/arcade/core/dither.ts";
import { paintCup, skyline } from "./ascent";
import { hash, HEIGHT, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintProp } from "./props";

let rainySky: HTMLCanvasElement;
export function paintRoute(p: Pixels, time: number, gameplay: boolean) {
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
  paintProp(p, "vent", 45, 118);
  paintProp(p, "signal", 265, 112);
  paintProp(p, "courier-crate", 194, 110);
  if (gameplay) paintRunner(p, time);
}

export function paintRunner(p: Pixels, time: number) {
  const bounce = Math.round(Math.abs(Math.sin(time * 7)) * 3);
  const x = 124, y = 115 - bounce;
  paintCup(p, x, y, ["#a26a52", "#dfa879"]);
  p.line("#f5e4ca", x + 15, y + 1, x + 18, y - 9, 2);
  p.line("#e85d4c", x + 18, y - 9, x + 18, y - 4, 2);
  const foot = Math.round(Math.sin(time * 10) * 6);
  p.line("#edd5bb", x + 9, y + 10, x + 8 + foot, 135, 2);
  p.line("#edd5bb", x + 15, y + 10, x + 16 - foot, 135, 2);
  p.rect("#e97868", x + 7 + foot, 135, 4, 2);
  p.rect("#e97868", x + 15 - foot, 135, 4, 2);
}

const farRidge = [[0, 95], [26, 81], [48, 92], [72, 64], [86, 82], [100, 78], [141, 109], [162, 93], [181, 99], [214, 76], [231, 88], [245, 82], [280, 94], [320, 71]];
const nearRidge = [[0, 112], [29, 107], [48, 110], [61, 102], [83, 109], [113, 114], [140, 114], [161, 112], [176, 114], [185, 123], [197, 148], [214, 155], [229, 149], [242, 117], [257, 106], [278, 107], [301, 97], [320, 110]];

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
  p.line("#8c7478", 19, 119, 78, 116);
  p.line("#8c7478", 17, 121, 77, 118);
  p.line("#81828d", 30, 127, 108, 121);
  p.line("#5e626d", 58, 135, 109, 128);
  paintProp(p, "lunar-beacon", 220, 79);
  paintProp(p, "relay", 257, 75);
  paintProp(p, "pennant", 91, 85);
}

export function paintRille(p: Pixels, time: number, gameplay: boolean) {
  rille ??= raster(WIDTH, HEIGHT, rillePlate);
  p.image(rille, 0, 0);
  const x = 30 + Math.sin(time / 6) * 19;
  paintProp(p, "rover", x, 86);
  if (Math.floor(time * 1.4) % 2 === 0) p.rect("#deb481", 274, 98, 5, 2);
  if (gameplay) {
    p.rect("#98949a", 120, 112, 47, 2);
    p.rect("#795f69", 121, 114, 46, 2);
    p.rect("#ce9774", 129, 111, 28, 2);
    paintLander(p, time);
  }
}

export function paintLander(p: Pixels, time: number) {
  const lx = 129 + Math.sin(time * 0.5) * 6;
  const ly = 67 + Math.sin(time * 0.9) * 4;
  paintCup(p, lx, ly, ["#a66a42", "#e8b07b"]);
  p.line("#f8e5cb", lx + 14, ly, lx + 14, ly - 8, 2);
  p.line("#e87569", lx + 14, ly - 7, lx + 14, ly - 4, 2);
  p.line("#eee1c4", lx + 7, ly + 9, lx + 4, ly + 16, 2);
  p.line("#eee1c4", lx + 17, ly + 9, lx + 20, ly + 16, 2);
  if (Math.floor(time * 7) % 4 < 3) {
    p.line("#d47761", lx + 11, ly + 11, lx + 10, ly + 19, 3);
    p.line("#e4ac78", lx + 12, ly + 11, lx + 12, ly + 16, 2);
  }
}

let print: HTMLCanvasElement;
export function paintCatch(p: Pixels, time: number, gameplay: boolean) {
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
  if (gameplay) {
    for (const [offset, start] of [[0, 62], [0.95, 125], [1.84, 171]]) {
      const step = wrap(time + offset, 3.6) / 3.6;
      const x = start + step * 51;
      const y = 61 - 136 * step * (1 - step) + step * 65;
      paintCup(p, x, y, ["#9f604f", "#db9e7d"]);
      p.line("#d87965", x + 15, y - 5, x + 15, y, 2);
    }
    const basket = 122 + Math.sin(time * 1.2) * 57;
    p.oval("#d9bb9e", basket + 16, 149, 23, 4);
    paintProp(p, "basket", basket, 123);
  } else {
    paintProp(p, "takeaway", 251, 116);
  }
}
