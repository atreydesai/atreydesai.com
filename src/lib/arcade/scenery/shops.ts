import { skyline } from "./ascent";
import { HEIGHT, hash, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintProp } from "./props";

function bricks(p: Pixels, mortar: string, face: string, edge: string, bottom: number) {
  p.rect(mortar, 0, 0, WIDTH, bottom);
  for (let y = 1; y < bottom; y += 13) {
    for (let x = y % 2 ? -13 : 2; x < WIDTH; x += 27) {
      p.rect(face, x, y, 26, Math.min(12, bottom - y));
      p.rect(edge, x + 1, y + 1, 24);
    }
  }
}

function windowView(p: Pixels, x: number, y: number, w: number, h: number, time: number, raining: boolean) {
  p.rect("#4d3b3e", x - 4, y - 4, w + 8, h + 8);
  p.rect(raining ? "#627484" : "#5f627a", x, y, w, h);
  p.clip(x, y, w, h, () => {
    p.rect(raining ? "#535e71" : "#786b84", x, y + 18, w, h);
    p.rect(raining ? "#5e6878" : "#9a7b84", x, y + 31, w, h);
    skyline(p, y + h - 7, 2, 0, true);
    skyline(p, y + h + 6, 5, 1, true);
    if (raining) {
      for (let i = 0; i < 32; i++) {
        const rx = x + wrap(hash(i + 143) * w + time * 8, w);
        const ry = y + wrap(hash(i + 1705) * h + time * (18 + i % 17), h);
        p.line(i % 5 ? "#7a8b95" : "#a1a8a5", rx, ry, rx + 1, ry + 5);
      }
      p.rect("#77868d", x + 7, y + 2, 1, h);
      p.rect("#7e8b93", x + w - 13, y + 2, 2, h);
    } else {
      p.rect("#585264", x, y + h - 12, w, 3);
      paintProp(p, "tram", x - 64 + wrap(time * 15 + 74, w + 120), y + h - 24);
    }
  });
  p.rect("#7d625c", x + Math.floor(w / 2) - 2, y, 3, h);
  p.rect("#7d625c", x, y + Math.floor(h / 2), w, 3);
  p.rect("#ad8471", x - 5, y + h, w + 10, 3);
  p.rect("#684f51", x - 4, y - 1, w + 8, 2);
}

let kitchen: HTMLCanvasElement;
function kitchenPlate(p: Pixels) {
  bricks(p, "#5f6666", "#737f79", "#839089", 115);
  p.rect("#485456", 0, 104, WIDTH, 14);
  p.rect("#ac8f7b", 0, 106, WIDTH, 2);

  p.rect("#4f4b48", 19, 0, 8, 99);
  p.rect("#b98063", 21, 0, 5, 92);
  p.rect("#d29773", 21, 0, 1, 92);
  p.rect("#a1705d", 21, 88, 66, 5);
  p.rect("#c49677", 22, 88, 64, 1);
  for (const y of [13, 43, 74]) {
    p.rect("#614f50", 17, y, 12, 4);
    p.rect("#a5897a", 18, y, 10);
  }
  p.rect("#563f44", 43, 52, 53, 4);
  p.rect("#b38470", 40, 50, 60, 2);
  paintProp(p, "tins", 55, 28);
  p.rect("#4a484a", 251, 37, 56, 6);
  p.rect("#ae8670", 246, 35, 65, 3);
  paintProp(p, "mold", 271, 18);
  for (let x = 253; x < 301; x += 12) {
    p.rect("#4d5153", x, 49, 2, 25);
    p.oval("#91918a", x + 1, 74, 4, 6);
    p.oval("#a5a498", x, 73, 3, 5);
  }

  p.rect("#98a09a", 0, 118, WIDTH, 15);
  p.rect("#b7b6a2", 0, 118, WIDTH, 2);
  p.rect("#716b68", 0, 132, WIDTH, 36);
  p.rect("#555659", 0, 136, WIDTH, 2);
  for (let x = 10; x <= WIDTH; x += 49) {
    p.rect("#5d5b5b", x, 138, 41, 24);
    p.rect("#807776", x + 1, 139, 38, 21);
    p.rect("#a4978a", x + 8, 144, 15, 2);
  }
  p.rect("#808a86", 84, 121, 155, 8);
  p.rect("#627473", 89, 123, 146, 4);
  p.rect("#b5b7a8", 84, 120, 155, 1);
  p.rect("#563f44", 38, 109, 53, 4);
  p.rect("#b38470", 37, 108, 55, 2);
  paintProp(p, "kettle", 41, 71);
}

export function paintKitchen(p: Pixels, time: number) {
  kitchen ??= raster(WIDTH, HEIGHT, kitchenPlate);
  p.image(kitchen, 0, 0);
  windowView(p, 116, 18, 105, 72, time, true);
  p.rect("#717472", 97, 25, 135, 3);
  p.rect("#b0a496", 99, 24, 132);
  paintProp(p, "sieve", 183 + Math.sin(time / 3) * 25, 23);
}

let stalls: HTMLCanvasElement;
function marketPlate(p: Pixels) {
  p.bands("#352b42", "#624959", "#9b676a", 50, 20);
  skyline(p, 125, 8, 0);
  skyline(p, 139, 21, 1);
  p.rect("#4b3440", 0, 11, 62, 132);
  p.rect("#523945", 232, 12, 88, 134);
  for (const x of [4, 242, 276]) {
    p.rect("#6b4b52", x, 64, 41, 69);
    p.rect("#3d3443", x + 3, 69, 35, 57);
    p.rect("#a67765", x + 3, 69, 33);
  }
  paintProp(p, "shutter", 247, 83);
  paintProp(p, "seal-roll", 40, 106);
  paintProp(p, "straw-caddy", 281, 96);
  paintProp(p, "awning", 273, 82);
  p.rect("#6d4c54", 0, 44, WIDTH, 3);
  p.rect("#715361", 0, 38, WIDTH, 3);
  p.rect("#4e3746", 0, 0, WIDTH, 17);
  for (let x = -10; x < WIDTH; x += 36) {
    const stripe = (x + 10) % 72 ? ["#a96965", "#b07b70", "#86616a"] : ["#65505d", "#856772", "#634c5f"];
    p.rect(stripe[0], x, 8, 33, 19);
    p.rect(stripe[1], x + 2, 9, 30, 12);
    p.rect(stripe[2], x + 2, 25, 30, 5);
    p.rect("#463745", x + 4, 29, 25, 2);
  }
  p.line("#473543", 48, 46, 220, 54);
  p.line("#473543", 220, 54, 318, 41);
  p.rect("#3c3039", 0, 137, WIDTH, 31);
  p.rect("#58424c", 0, 137, WIDTH, 4);
  p.rect("#805859", 0, 141, WIDTH, 2);
  p.rect("#49404b", 0, 143, WIDTH, 13);
  p.rect("#655462", 0, 154, WIDTH, 2);
}

export function paintMarket(p: Pixels, time: number) {
  stalls ??= raster(WIDTH, HEIGHT, marketPlate);
  p.image(stalls, 0, 0);
  for (const [i, x] of [38, 91, 217, 270].entries()) {
    const y = 44 + (i === 1 || i === 2 ? 7 : 0);
    const sway = Math.sin(time + i) * 2;
    paintProp(p, "lantern", x + sway, y);
    if (Math.floor(time / 2 + i) % 3 === 0) p.rect("#eab178", x + sway + 9, y + 11, 3, 4);
  }
}

let counter: HTMLCanvasElement;
function counterPlate(p: Pixels) {
  p.bands("#615455", "#8a6d63", "#a38270", 55, 14);
  for (let x = 2; x < WIDTH; x += 21) {
    p.rect("#79645f", x, 0, 1, 125);
    p.rect("#8c7165", x + 1, 0, 1, 125);
  }
  p.oval("#a98972", 75, 79, 55, 75);
  p.oval("#b79779", 73, 74, 40, 64);
  p.rect("#705653", 0, 81, 101, 6);
  p.rect("#c29472", 0, 81, 101, 2);
  p.rect("#735a55", 235, 72, 85, 6);
  p.rect("#ba8a70", 235, 72, 85, 2);
  p.rect("#4d4042", 67, 0, 3, 28);
  p.oval("#624b49", 68, 28, 17, 7);
  p.rect("#d3a988", 52, 29, 30, 2);
  paintProp(p, "tins", 24, 59);
  paintProp(p, "sugar-jar", 61, 56);
  paintProp(p, "milk-crate", 244, 46);
  paintProp(p, "sugar-jar", 285, 46);
  p.rect("#7e5e52", 0, 114, WIDTH, 52);
  p.rect("#c99569", 0, 114, WIDTH, 16);
  p.rect("#e2b18a", 0, 114, WIDTH, 3);
  p.rect("#b58162", 0, 129, WIDTH, 3);
  for (let i = 0; i < 28; i++) {
    p.rect(i % 3 ? "#956c58" : "#ae8067", hash(i + 107) * 320, 137 + hash(i + 1021) * 30, 11 + i % 27);
  }
  for (const x of [37, 109, 218, 284]) {
    p.rect("#5c4b47", x, 136, 3, 32);
    p.rect("#996e58", x + 3, 135, 1, 32);
  }
}

export function paintBar(p: Pixels, time: number) {
  counter ??= raster(WIDTH, HEIGHT, counterPlate);
  p.image(counter, 0, 0);
  windowView(p, 107, 17, 118, 73, time, false);
  paintProp(p, "receipt", 37, 94);
  paintProp(p, "pump", 259, 89);
  p.oval("#835e52", 156, 121, 28, 4);
  p.oval("#cba175", 155, 119, 26, 3);
}
