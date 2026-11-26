import type { GameId } from "#lib/boba.ts";
import { bayer } from "#lib/arcade/core/dither.ts";
import { skyline } from "./ascent";
import { hash, HEIGHT, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintGroundedProp, paintProp } from "./props";

let icePlate: HTMLCanvasElement;
function iceBelt(p: Pixels, time: number) {
  icePlate ??= raster(WIDTH, HEIGHT, (q) => {
    q.rect("#172134", 0, 0, WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const arc = 44 + x * 0.44 + ((x - 162) / 94) ** 2 * 11;
        const across = (y - arc) / 11;
        if (Math.abs(across) > 3.1) continue;
        const striation = Math.sin(across * 7.5 + x / 52);
        const opacity = Math.max(0, 1 - Math.abs(across) / 3.2);
        if (bayer(x, y) < opacity * (striation + 1.15) * 0.48) {
          q.rect(opacity > 0.67 ? "#3a5069" : "#2a3b56", x, y);
        }
        if (hash(x + y * WIDTH) > 0.995 && opacity > 0.25) q.rect("#7b8a96", x, y);
      }
    }
    for (let i = 0; i < 77; i++) {
      const x = hash(i + 752) * 319, y = hash(i + 198) * 167;
      q.rect(i % 8 === 0 ? "#95a1a4" : "#465873", x, y);
    }
    q.oval("#2a3250", 244, 37, 25, 24);
    q.oval("#596877", 241, 35, 21, 22);
    q.oval("#2a3250", 249, 33, 23, 22);
    q.oval("#424f65", 239, 36, 17, 21);
    q.oval("#2a3250", 245, 33, 19, 21);
  });
  p.image(icePlate, 0, 0);
  for (let i = 0; i < 15; i++) {
    const x = wrap(i * 53 + time * (3 + i % 4), 340) - 11;
    const y = 52 + 0.44 * x + (hash(i + 21) - 0.5) * 48;
    const tint = i % 6 ? "#536c80" : "#81939c";
    p.line(tint, x, y, x + 3 + (i % 5), y - 1 - (i % 2), 1);
  }
  paintProp(p, "ice", 27 + Math.sin(time / 6) * 13, 48);
  paintProp(p, "shard", 64 + Math.sin(time / 6) * 13, 67);
  paintProp(p, "buoy", 46 + Math.sin(time / 4) * 9, 109 - Math.cos(time / 3.6) * 5);
  const x = 244 + Math.sin(time / 6) * 13;
  const y = 95 + Math.sin(time / 3.5) * 8;
  p.oval("#313d55", x + 15, y + 37, 31, 10);
  p.oval("#55687d", x + 14, y + 33, 28, 7);
  p.oval("#81979f", x + 9, y + 31, 19, 4);
  p.oval("#55687b", x + 18, y + 35, 12, 4);
  paintGroundedProp(p, "mirror", x + 13, y + 34, Math.sin(time / 6) * 33);
}

let gardenSky: HTMLCanvasElement;
function glassRoofs(p: Pixels, time: number) {
  gardenSky ??= raster(WIDTH, HEIGHT, (q) => {
    q.bands("#5d5f78", "#a4777c", "#dca384", 62, 19);
    q.oval("#edbf93", 73, 77, 27, 27);
    q.rect("#dba88c", 42, 83, 62);
    q.line("#a47c85", 6, 92, 119, 84);
    q.line("#bb8b89", 192, 64, 311, 68);
  });
  p.image(gardenSky, 0, 0);
  skyline(p, 115, -time * 2, 0);
  skyline(p, 131, -time * 5, 1);
  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 101 + 22 - time * 14, 505) - 76;
    const y = 86 + (i % 2) * 9;
    paintProp(p, "greenhouse", x, y);
    p.rect("#575b58", x + 2, y + 39, 74, 7);
    p.rect("#a28870", x + 2, y + 39, 74, 2);
    p.rect("#786b64", x + 10, y + 43, 22);
  }
  p.rect("#515258", 0, 137, WIDTH, HEIGHT - 137);
  p.rect("#90736b", 0, 137, WIDTH, 3);
  p.rect("#c18b6c", 0, 137, WIDTH, 1);
  for (let col = 0; col < 15; col++) {
    const x = wrap(4 + col * 24 - time * 20, 336) - 6;
    p.rect("#65585d", x, 146, 15, 2);
    p.rect("#6a625d", x + 5, 155, 18);
  }
  for (const [x, turn] of [[66, 0], [255, 65]]) {
    p.oval("#42434b", x + 3, 142, 12, 4);
    paintGroundedProp(p, "planter", x, 140, turn);
  }
}

let flats: HTMLCanvasElement;
function longShadow(p: Pixels, time: number) {
  flats ??= raster(WIDTH, HEIGHT, (q) => {
    q.bands("#282b40", "#444052", "#776075", 62, 19);
    q.oval("#bd9d8a", 58, 57, 22, 22);
    q.rect("#d0ad91", 37, 59, 42);
    q.rect("#806b76", 21, 70, 70, 3);
    for (let i = 0; i < 42; i++) q.rect("#646679", hash(i + 584) * 319, hash(i + 1156) * 70);
    for (let x = 0; x < WIDTH; x++) {
      const y = Math.round(111 - 10 * Math.sin(x * 0.025) - 9 * Math.sin(x * 0.05 + 1));
      q.rect("#655465", x, y, 1, 168 - y);
      q.rect("#a7827e", x, y, 1, 2);
      q.rect("#7d6471", x, y + 8, 1, 3);
      q.rect("#563f58", x, y + 25, 1, 3);
      if (bayer(x, y) > 0.5) q.rect("#8a6b73", x, y + 18, 1, 2);
    }
    for (const [cx, foot, top, width] of [[44, 114, 82, 30], [243, 117, 57, 41], [288, 111, 81, 25]]) {
      for (let y = top; y < foot; y++) {
        const inset = Math.floor((foot - y) / 4);
        q.rect("#71586a", cx + inset, y, width - inset);
        q.rect("#9f7974", cx + inset, y, 4);
        if ((y - top) % 8 === 0) q.rect("#b28b7e", cx + inset, y, width - inset);
      }
      for (let line = 0; line < 9; line++) q.line("#594c64", cx + 15, foot + line, cx + width + 79, foot + 12 + line);
    }
    q.line("#503d52", 200, 133, 224, 139, 2);
    q.oval("#574458", 205, 134, 8, 2);
    paintProp(q, "mast", 184, 100);
    paintProp(q, "pennant", 97, 92);
    q.oval("#514056", 57, 143, 15, 4);
    q.line("#59475a", 60, 142, 87, 147, 2);
    paintGroundedProp(q, "vault", 54, 141, 45);
  });
  p.image(flats, 0, 0);
  if (Math.floor(time) % 3 < 2) p.rect("#dfb07e", 206, 126, 2, 2);
}

let serviceRoom: HTMLCanvasElement;
function belowSink(p: Pixels, time: number) {
  serviceRoom ??= raster(WIDTH, HEIGHT, (q) => {
    q.rect("#65576a", 0, 0, WIDTH, HEIGHT);
    for (let row = 0; row < 11; row++) {
      for (let x = row % 2 ? -14 : 0; x < WIDTH; x += 28) {
        q.rect(row > 6 ? "#7b6874" : "#866e77", x, row * 16 + 1, 27, 15);
        q.rect(row > 6 ? "#978079" : "#ab8a81", x + 1, row * 16 + 2, 25);
      }
    }
    q.rect("#6c535a", 0, 0, WIDTH, 23);
    q.rect("#b09383", 0, 16, WIDTH, 4);
    q.rect("#c9ad92", 70, 11, 180, 12);
    q.rect("#d2bca4", 79, 21, 163, 11);
    q.rect("#98776c", 83, 32, 155, 3);
    q.rect("#c2a790", 90, 26, 141, 5);
    q.line("#613e4a", 39, 6, 39, 107, 13); q.line("#b18063", 41, 6, 41, 105, 9);
    q.line("#ca9c79", 42, 5, 42, 105, 2);
    q.line("#634b59", 45, 98, 95, 98, 12); q.line("#b78368", 44, 99, 96, 99, 7);
    q.line("#bd9075", 47, 100, 92, 100);
    q.line("#616779", 259, 26, 259, 116, 10); q.line("#89a19d", 260, 26, 260, 115, 7);
    q.line("#a6afa2", 261, 25, 261, 109, 1);
    q.line("#627080", 223, 106, 260, 106, 10); q.line("#8a9d98", 225, 108, 260, 108, 7);
    for (const [x, y] of [[35, 40], [35, 80], [255, 60]]) {
      q.rect("#775962", x, y, 20, 4); q.rect("#c3a085", x + 2, y, 16);
    }
    q.rect("#5f5766", 0, 125, WIDTH, 43); q.rect("#917a7d", 0, 125, WIDTH, 2);
    q.rect("#4e586a", 106, 122, 103, 7); q.rect("#677b83", 111, 124, 93, 4);
    q.rect("#59454f", 88, 94, 13, 10);
    q.rect("#a78675", 89, 95, 10, 7);
    q.rect("#c3a085", 89, 95, 10);
    paintGroundedProp(q, "valve", 94, 100);
    paintProp(q, "trap", 136, 35);
    paintProp(q, "mold", 284, 104);
  });
  p.image(serviceRoom, 0, 0);
  const drop = wrap(time * 20, 62);
  p.rect("#a5bbac", 158, 52 + drop, 2, 3);
}

let waterfront: HTMLCanvasElement;
function ferryMarket(p: Pixels, time: number) {
  waterfront ??= raster(WIDTH, HEIGHT, (q) => {
    q.bands("#8f8290", "#be9d98", "#e2b69e", 48, 19);
    q.oval("#f2c995", 232, 55, 22, 22);
    skyline(q, 101, 3, 0);
    q.rect("#8f858c", 0, 99, WIDTH, 29);
    q.rect("#ba9e98", 0, 105, WIDTH, 3);
    q.rect("#a59599", 0, 118, WIDTH, 2);
    q.rect("#66545e", 0, 126, WIDTH, 42);
    q.rect("#9c7d76", 0, 128, WIDTH, 3);
    q.rect("#715d67", 0, 135, WIDTH, 2);
    q.rect("#5f505e", 0, 150, WIDTH, 4);
    q.rect("#a37c75", 0, 153, WIDTH, 2);
    q.rect("#765b64", 5, 2, 5, 124);
    q.rect("#765b64", 311, 2, 5, 124);
    q.line("#6d5764", 8, 14, 109, 31);
    q.line("#6d5764", 109, 31, 215, 28);
    q.line("#6d5764", 215, 28, 313, 15);
    for (let i = 0; i < 16; i++) {
      const x = 16 + i * 19, y = x < 110 ? 15 + x / 6 : x < 215 ? 31 : 28 - (x - 215) / 8;
      q.rect(i % 3 ? "#ddaa91" : "#ad777b", x, y, 9, 5); q.rect("#ac7a77", x, y + 5, 5, 3);
    }
  });
  p.image(waterfront, 0, 0);
  paintProp(p, "ferry", wrap(time * 10 + 121, 412) - 85, 79 + Math.sin(time) * 1.3);
  for (let i = 0; i < 14; i++) p.rect(i % 3 ? "#b19899" : "#d0a99b", wrap(i * 49 + time * 2.6, 320), 104 + (i * 7) % 20, 4 + i % 13);
  for (const [x, turn] of [[28, 0], [291, 45]]) {
    p.rect("#705c63", x - 10, 118, 20, 8);
    p.rect("#ae8b7d", x - 10, 118, 20);
    p.oval("#624e57", x + 1, 122, 8, 2);
    paintGroundedProp(p, "dock-lamp", x, 120, turn);
  }
}

let courtyard: HTMLCanvasElement;
function courtyardStand(p: Pixels, time: number) {
  courtyard ??= raster(WIDTH, HEIGHT, (q) => {
    q.rect("#e3b495", 0, 0, WIDTH, HEIGHT);
    q.rect("#c58c81", 0, 75, WIDTH, 35); q.rect("#e3a68e", 0, 74, WIDTH, 2);
    for (let x = -5; x < WIDTH; x += 22) for (let y = 81; y < 112; y += 11) {
      q.rect("#d8a08c", x + (y % 2 ? 9 : 0), y, 20, 9);
      q.rect("#ce9789", x + (y % 2 ? 9 : 0) + 3, y, 14);
    }
    q.rect("#936975", 101, 22, 119, 92);
    q.oval("#825d6f", 159, 43, 58, 37);
    q.rect("#6d515d", 111, 43, 98, 66);
    q.oval("#6d515d", 160, 43, 49, 31);
    q.rect("#73756e", 117, 48, 85, 60);
    q.oval("#73756e", 160, 48, 42, 28);
    q.rect("#637570", 124, 51, 73, 50);
    q.rect("#a28675", 104, 91, 112, 5);
    q.rect("#c8a684", 104, 91, 112, 2);
    q.rect("#e2b796", 100, 104, 120, 6);
    for (const x of [24, 260]) {
      q.rect("#a57176", x, 25, 38, 49);
      q.rect("#806576", x + 3, 29, 32, 39);
      q.rect("#848587", x + 4, 31, 29, 36);
      q.rect("#b58a83", x + 17, 28, 3, 42);
      q.rect("#b58a83", x, 46, 37, 2);
    }
    q.rect("#c29382", 0, 112, WIDTH, 56);
    for (let i = 0; i < 28; i++) {
      const x = i * 47 % 320, y = 119 + i * 13 % 49;
      q.rect(i % 3 ? "#b88c82" : "#d3a18b", x, y, 6 + i % 17);
    }
    q.rect("#a5716d", 85, 112, 148, 28);
    q.rect("#81666b", 94, 126, 130, 25);
    q.rect("#be8b76", 81, 111, 156, 7);
    q.rect("#dfac8a", 81, 111, 156, 2);
  });
  p.image(courtyard, 0, 0);
  for (const [x, turn] of [[37, 13], [288, 50]]) {
    p.rect("#a77470", x - 15, 103, 30, 17);
    p.rect("#d5a28b", x - 15, 103, 30, 8);
    p.oval("#b68275", x + 2, 107, 12, 4);
    paintGroundedProp(p, "planter", x, 105, turn);
  }
  p.oval("#a37469", 209, 108, 14, 4);
  paintGroundedProp(p, "ice-chest", 207, 106);
  const sway = Math.sin(time / 3) * 2;
  paintProp(p, "lantern", 71 + sway, 36);
  paintProp(p, "lantern", 227 - sway, 36);
  paintProp(p, "tray", 101, 93);
}

let folded: HTMLCanvasElement;
function foldedMenu(p: Pixels) {
  folded ??= raster(WIDTH, HEIGHT, (q) => {
    q.rect("#e7ccac", 0, 0, WIDTH, HEIGHT);
    q.rect("#e2bb9d", 0, 96, WIDTH, 72);
    for (let x = 1; x < WIDTH; x += 6) q.line("#e8c4a6", x, 96, x + 4, HEIGHT);
    q.rect("#b97e71", 46, 22, 191, 117);
    q.rect("#f8e8ce", 43, 17, 191, 119);
    q.rect("#ddba9e", 140, 17, 2, 119);
    q.rect("#fdf0d8", 51, 24, 82, 102);
    q.rect("#a66e63", 56, 33, 44, 3);
    q.rect("#bb9b82", 57, 42, 63, 2);
    for (let i = 0; i < 7; i++) {
      const y = 54 + i * 10;
      q.rect(i % 2 ? "#b89981" : "#967969", 57, y, 51 + (i * 17) % 16, 2);
      q.rect("#e2c3a5", 57, y + 4, 58 + i % 14);
    }
    for (let x = 154; x < 223; x += 6) for (let y = 40; y < 123; y += 6) {
      if (hash(x + y * WIDTH) > 0.4) q.rect("#e7c6aa", x, y);
    }
    q.oval("#d49783", 186, 81, 24, 22);
    q.oval("#f0b395", 184, 78, 22, 20);
    q.oval("#e5b49a", 184, 78, 19, 17);
    q.line("#b77466", 169, 72, 198, 72, 2);
    q.line("#b77466", 173, 76, 178, 90, 2);
    q.line("#b77466", 194, 76, 190, 90, 2);
    q.rect("#b77466", 178, 90, 13, 2);
    q.line("#a66f66", 188, 70, 190, 57, 2);
    q.rect("#d1947e", 18, 120, 41, 20);
    q.rect("#f4d8b8", 14, 116, 41, 20);
    q.rect("#b67d6b", 19, 121, 30, 2);
    q.rect("#c6a88f", 19, 127, 19);
    paintProp(q, "carrier", 253, 43);
    q.oval("#cea589", 267, 115, 12, 4);
    q.oval("#cda285", 246, 136, 15, 5);
    paintGroundedProp(q, "stamp", 265, 113, 15);
    paintGroundedProp(q, "basket", 244, 134);
  });
  p.image(folded, 0, 0);
}

export const alternateScenes: Record<GameId, (p: Pixels, time: number) => void> = {
  stack: iceBelt,
  runner: glassRoofs,
  lander: longShadow,
  spill: belowSink,
  stab: ferryMarket,
  orders: courtyardStand,
  catch: foldedMenu,
};
