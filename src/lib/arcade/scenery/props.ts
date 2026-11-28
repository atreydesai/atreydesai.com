import { drawSprite } from "#lib/arcade/art.ts";
import { models } from "./stacks/models";
import { TURN_STEPS, stackGrid } from "#lib/arcade/core/sprite-stack.ts";
import type { SpriteModel } from "./stacks/types";
import { dockLamp, iceChest, inkStamp, mirrorArray, rollerValve, roofPlanter, sampleVault } from "./new-stacks";
import { Pixels, raster } from "./pixel";

interface PropFrame {
  canvas: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
}

interface Appearance {
  scale?: number;
  turn?: number;
  /** Mix the prop's ink toward the light around it, preserving its silhouette. */
  light?: { color: string; amount: number };
}

interface Prop {
  name: string;
  art: (turn?: number) => PropFrame;
  slices?: SpriteModel;
}

function stamp(name: string, width: number, height: number, draw: (p: Pixels) => void): Prop {
  return { name, art: () => ({ canvas: raster(width, height, draw), anchorX: width / 2, anchorY: height - 1 }) };
}

function stacked(name: string, model: SpriteModel, angle: number, squash = 0.75): Prop {
  return {
    name,
    slices: model,
    art: (turn = 0) => {
      const { grid, anchorX, anchorY } = stackGrid(model.slices, {
        turn: ((angle + turn) % 360) * Math.PI / 180,
        squash,
        outline: "O",
      });
      const canvas = raster(grid[0].length, grid.length, (p) => drawSprite(p.ctx, grid, 0, 0, 1, model.palette));
      return { canvas, anchorX, anchorY };
    },
  };
}

const dark = "#2a242b";
const ink = "#44333a";
const paper = "#f4debc";
const dim = "#c6a589";
const copper = "#ac6a51";
const gold = "#ddaa68";
const rust = "#835044";
const pink = "#df8f83";
const red = "#ca6155";
const dusk = "#595b78";
const slate = "#3a4d64";
const steel = "#738997";
const blue = "#8eb4c2";

export const props: Record<string, Prop> = {
  tank: stamp("copper water tank", 30, 42, (p) => {
    p.line(ink, 7, 22, 4, 41, 2); p.line(ink, 22, 22, 24, 41, 2);
    p.line(rust, 6, 34, 22, 29); p.line(rust, 6, 29, 24, 36);
    p.oval(ink, 14, 8, 13, 7); p.rect(ink, 2, 8, 25, 18);
    p.oval(ink, 14, 25, 12, 4); p.rect(copper, 3, 9, 23, 16);
    p.oval(copper, 14, 24, 11, 4); p.oval(gold, 13, 8, 11, 4);
    p.rect("#bf7c59", 6, 12, 4, 13); p.rect(rust, 20, 12, 6, 14);
    p.rect(ink, 2, 14, 25); p.rect(rust, 2, 20, 25);
    p.rect(dim, 11, 2, 6, 2); p.rect(ink, 28, 15, 2, 15); p.rect(ink, 24, 28, 5, 2);
  }),

  balloon: stamp("milk-tea balloon", 33, 45, (p) => {
    p.oval("#713e43", 16, 15, 15, 14);
    p.oval("#da9b75", 15, 14, 13, 12);
    p.oval("#f2bf93", 13, 13, 9, 11);
    p.oval("#f4d7ac", 12, 13, 4, 10);
    p.rect(rust, 5, 16, 23, 2); p.rect(red, 6, 16, 19);
    for (const [x, y] of [[9, 21], [15, 23], [21, 20], [25, 21]]) p.rect("#895145", x, y, 2, 2);
    p.rect("#f3c595", 11, 1, 11, 3); p.rect(copper, 10, 3, 13, 2);
    p.line(ink, 9, 25, 13, 38); p.line(ink, 23, 25, 19, 38);
    p.rect(ink, 11, 37, 11, 7); p.rect(gold, 12, 38, 9, 4);
    p.rect(rust, 15, 38, 2, 4); p.rect(rust, 18, 38, 2, 4);
  }),

  courier: stamp("sunlit courier plane", 49, 15, (p) => {
    p.line(slate, 2, 7, 28, 7, 3);
    p.line(slate, 18, 8, 28, 1, 2); p.line(slate, 25, 9, 34, 13, 2);
    p.line(dusk, 5, 7, 3, 3, 2); p.rect(steel, 13, 8, 21, 3);
    p.rect("#c7d5cd", 10, 6, 30, 3); p.rect(paper, 20, 6, 20); p.rect(blue, 40, 7, 3, 2);
    p.line(blue, 18, 6, 28, 1); p.line("#9aabae", 21, 9, 34, 12);
    p.rect(copper, 25, 8, 5); p.rect("#657c8f", 34, 6, 3, 2);
  }),

  station: stamp("orbital tea service", 57, 35, (p) => {
    p.rect("#333b51", 1, 19, 54, 4); p.rect(steel, 2, 18, 51, 2);
    for (const x of [1, 39]) {
      p.rect(slate, x, 12, 17, 15);
      p.rect("#62839e", x + 1, 13, 15, 12);
      for (let step = 4; step <= 13; step += 4) p.rect(slate, x + step, 13, 1, 12);
      p.rect(slate, x + 1, 19, 15); p.rect(blue, x + 1, 13, 15);
    }
    p.oval(ink, 28, 13, 12, 10); p.oval("#ae7c67", 28, 13, 11, 9);
    p.rect(ink, 19, 14, 20, 13); p.rect("#b78466", 20, 15, 18, 10);
    p.rect("#576879", 20, 17, 18, 5); p.rect("#d7a779", 21, 18, 16, 2);
    for (const x of [23, 28, 33]) p.rect(ink, x, 17, 1, 4);
    p.rect(paper, 23, 6, 11, 3); p.rect(dim, 19, 9, 18, 2);
    p.rect(dusk, 27, 0, 2, 5); p.rect(gold, 26, 0, 4, 2);
    p.rect("#886759", 21, 27, 16, 4); p.rect(rust, 23, 31, 12, 3);
    p.rect(dim, 25, 27, 5, 2); p.rect("#d39562", 48, 21, 2, 2);
  }),

  probe: stamp("tea-canister probe", 22, 25, (p) => {
    p.line(steel, 8, 8, 2, 2); p.line(steel, 14, 17, 20, 22);
    p.rect(dusk, 1, 1, 5, 3); p.rect(blue, 2, 1, 3);
    p.rect(dusk, 17, 20, 5, 3); p.rect(steel, 18, 20, 4);
    p.oval(dark, 11, 5, 6, 3); p.rect(dark, 5, 5, 13, 12); p.oval(dark, 11, 17, 6, 3);
    p.rect(copper, 6, 5, 11, 12); p.oval(gold, 11, 5, 5, 2); p.oval(rust, 11, 17, 5, 2);
    p.rect(paper, 8, 9, 6, 5); p.rect(copper, 9, 10, 4, 2);
    p.rect(rust, 6, 7, 2, 8); p.rect(dim, 14, 7, 2, 5); p.rect(red, 10, 20, 2, 3);
  }),

  ice: stamp("ice-chip comet", 29, 17, (p) => {
    p.line("#465773", 1, 12, 23, 4); p.line("#536d88", 9, 13, 24, 7);
    p.line("#547587", 15, 11, 23, 7);
    p.line("#53677c", 16, 10, 20, 4, 3); p.line("#788f9c", 19, 6, 25, 3, 4);
    p.line("#89a7ac", 20, 10, 26, 6, 3); p.rect("#a2b7b7", 23, 4, 4, 3);
    p.rect("#b4c8c2", 24, 3, 3, 2); p.rect("#6d8594", 18, 10, 4, 3);
    p.rect("#8ba2a7", 23, 8, 3, 2); p.rect("#829ea9", 11, 7, 2);
    p.rect("#6a8794", 12, 14, 2, 2); p.rect("#526579", 6, 15, 2);
  }),

  shard: stamp("tumbling ice fragment", 18, 14, (p) => {
    p.line("#40586c", 2, 12, 10, 5);
    p.line("#5e7e90", 6, 10, 10, 4, 3);
    p.line("#91a6ae", 9, 7, 13, 2, 3);
    p.line("#acc3bd", 12, 3, 15, 4, 2);
    p.line("#617e91", 11, 9, 13, 6, 2);
    p.rect("#8ba5ad", 5, 11, 2);
    p.rect("#567687", 0, 13, 2);
  }),

  ringed: stamp("ringed pearl", 103, 62, (p) => {
    const cx = 50, cy = 31, r = 23;
    const ring = (front: boolean) => {
      for (let x = -49; x <= 49; x++) {
        const dy = Math.sqrt(1 - (x / 50) ** 2) * 9;
        const y = cy - x * 0.31 + (front ? dy : -dy);
        p.rect(front ? "#817779" : "#625b70", cx + x, y, 1, 2);
        if (Math.abs(x) < 44) p.rect(front ? "#a08b84" : "#746c7d", cx + x, y + (front ? 2 : -2));
      }
    };
    ring(false);
    p.oval("#39384e", cx, cy, r, r);
    for (let y = -r; y <= r; y++) {
      const width = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -width; x <= width; x++) {
        const light = (-x - y * 0.4) / r;
        if (light < -0.15) continue;
        const stripe = (Math.floor((y + r + x * 0.18) / 4) % 4 + 4) % 4;
        const tone = ["#8c7885", "#7b6a80", "#a1858c", "#6b5e75"][stripe];
        p.rect(light < 0.17 && (x + y) % 2 === 0 ? "#555066" : tone, cx + x, cy + y);
      }
    }
    ring(true);
  }),

  "coaster-moon": stamp("the moon coaster", 65, 61, (p) => {
    p.oval("#4e526b", 32, 32, 28, 28); p.oval("#828595", 29, 26, 25, 21);
    p.oval("#9da09b", 27, 21, 22, 16);
    p.oval("#787b88", 22, 27, 8, 5); p.oval("#8d9093", 20, 26, 6, 3);
    p.oval("#686d83", 39, 40, 10, 5); p.oval("#828595", 37, 38, 8, 3);
    p.oval("#696f83", 16, 36, 4, 3); p.oval("#a9a69a", 38, 16, 7, 4);
    p.oval(rust, 41, 22, 13, 6); p.oval(gold, 40, 20, 12, 5); p.oval("#f0ce99", 40, 19, 8, 3);
    p.rect(rust, 38, 19, 5); p.rect(rust, 40, 18, 1, 3); p.rect(paper, 34, 17, 7);
  }),

  rover: stamp("cold-sample rover", 37, 27, (p) => {
    for (const x of [8, 18, 29]) {
      p.oval(dark, x, 21, 5, 5); p.oval(steel, x, 21, 3, 3); p.rect(slate, x - 1, 20, 3, 2);
    }
    p.rect(slate, 5, 15, 27, 4); p.rect("#c4b5a6", 6, 9, 26, 7); p.rect("#eee0cb", 9, 8, 17, 3);
    p.rect(steel, 26, 9, 5, 4); p.rect(red, 8, 13, 17, 2); p.rect(slate, 12, 5, 2, 6);
    p.line(steel, 7, 2, 15, 4, 2); p.rect(gold, 31, 10, 3, 2); p.rect(rust, 2, 10, 3, 5);
  }),

  relay: stamp("copper relay shelter", 39, 34, (p) => {
    p.rect(dark, 4, 17, 33, 15); p.rect(dusk, 6, 16, 26, 14); p.rect(steel, 9, 14, 21, 12);
    p.rect(copper, 7, 18, 28, 3); p.rect(ink, 26, 23, 7, 7);
    p.rect(ink, 16, 22, 8, 5); p.rect(gold, 17, 23, 6, 3); p.rect(dim, 7, 28, 17, 2);
    p.rect(ink, 10, 7, 2, 10); p.line(steel, 4, 4, 17, 9, 2); p.line(blue, 5, 4, 17, 8);
    p.rect(dusk, 27, 3, 2, 12); p.rect(red, 27, 2, 2, 2); p.rect(steel, 31, 24, 2, 6);
  }),

  pennant: stamp("survey pennant", 22, 27, (p) => {
    p.rect(dusk, 4, 2, 2, 23); p.rect("#8b92a0", 4, 2, 1, 23); p.rect(ink, 1, 25, 8, 2);
    p.rect(copper, 6, 4, 14, 7); p.rect(red, 6, 4, 8, 6); p.rect(pink, 6, 4, 7, 2);
    p.rect(red, 14, 5, 7, 2); p.rect(red, 19, 7, 3, 2); p.rect(paper, 9, 6, 4, 2);
  }),

  awning: stamp("folded shop awning", 35, 24, (p) => {
    p.rect(ink, 3, 15, 2, 9); p.rect(ink, 30, 14, 2, 10);
    for (let y = 0; y < 9; y++) {
      const x = 8 - Math.floor(y / 2);
      p.rect(copper, x, y + 5, 35 - x * 2);
      for (let j = 0; j < 3; j++) p.rect(j % 2 === 0 ? paper : pink, x + 1 + (6 + y / 3) * j, y + 5, 3 + y / 3);
    }
    p.rect(ink, 2, 14, 31, 2);
    for (let x = 3; x <= 27; x += 6) p.rect(red, x, 16, 4, 2);
  }),

  vent: stamp("rain gutter vent", 27, 21, (p) => {
    p.rect(ink, 2, 11, 23, 9); p.rect(steel, 3, 11, 21, 7); p.rect(blue, 5, 11, 16, 2);
    p.rect(slate, 8, 4, 10, 10); p.rect(steel, 9, 4, 7, 7); p.rect(slate, 6, 2, 16, 4);
    p.rect(blue, 7, 2, 14); p.rect(dark, 9, 5, 12, 2);
    for (let x = 6; x < 21; x += 4) p.rect(slate, x, 14, 2, 3);
  }),

  signal: stamp("brickwork signal", 17, 25, (p) => {
    p.rect(slate, 6, 10, 3, 14); p.rect(slate, 3, 23, 9, 2);
    p.rect(dark, 4, 1, 10, 12); p.rect(dusk, 5, 1, 8, 2); p.rect(ink, 5, 4, 8, 8);
    p.rect(gold, 7, 4, 4, 2); p.rect(red, 7, 8, 4, 2); p.rect(copper, 8, 9, 2);
  }),

  tram: stamp("last tram", 61, 16, (p) => {
    p.line(ink, 28, 1, 35, 6); p.line(dusk, 33, 1, 38, 5);
    p.rect(ink, 2, 5, 57, 9); p.rect("#805256", 3, 6, 55, 6);
    p.rect(copper, 5, 5, 49, 2); p.rect("#a96451", 4, 11, 54, 2);
    for (let x = 7; x <= 52; x += 7) p.rect(x % 3 ? "#e5b07d" : "#ad7f69", x, 7, 4, 3);
    p.rect(paper, 58, 8, 2, 2); p.rect(red, 1, 8, 2); p.rect(dark, 11, 13, 8, 2); p.rect(dark, 42, 13, 8, 2);
  }),

  sieve: stamp("brass sieve trolley", 34, 27, (p) => {
    p.rect(ink, 2, 3, 31, 3); p.rect(steel, 4, 2, 27, 2);
    for (const x of [7, 25]) { p.oval(slate, x, 4, 3, 3); p.rect(gold, x - 1, 3, 3, 2); p.rect(steel, x, 7, 1, 9); }
    p.rect(ink, 3, 15, 29, 10); p.rect(gold, 4, 16, 27, 8); p.rect(slate, 6, 17, 23, 6);
    for (let x = 6; x <= 27; x += 3) p.rect(dim, x, 17, 1, 7);
    for (let y = 18; y < 23; y += 2) p.rect(steel, 6, y, 23);
  }),

  mold: stamp("jelly mould", 24, 18, (p) => {
    p.oval(ink, 11, 13, 11, 4); p.oval(copper, 11, 12, 10, 4);
    for (let x = 3; x <= 18; x += 4) {
      p.oval(rust, x + 1, 10, 3, 5); p.oval(pink, x, 8, 2, 4); p.rect(red, x, 10, 3, 4);
    }
    p.oval("#e9a883", 11, 6, 5, 2); p.rect(paper, 10, 5, 4);
  }),

  tins: stamp("tea tins", 27, 22, (p) => {
    for (const [x, y, color] of [[1, 1, "#687f73"], [13, 5, copper]] as const) {
      p.oval(ink, x + 6, y + 2, 6, 2);
      p.rect(ink, x, y + 2, 13, 16); p.rect(color, x + 1, y + 3, 11, 14); p.oval(gold, x + 6, y + 2, 5, 2);
      p.rect(paper, x + 3, y + 7, 7, 6); p.rect(rust, x + 5, y + 9, 3, 2); p.rect(dim, x + 1, y + 15, 11);
    }
  }),

  lantern: stamp("star lantern", 23, 31, (p) => {
    p.rect("#676075", 11, 0, 1, 5);
    p.oval(rust, 11, 14, 10, 10); p.oval(red, 11, 14, 8, 9); p.oval(pink, 10, 13, 6, 8);
    p.rect(ink, 6, 5, 11, 2); p.rect(rust, 6, 22, 11, 3);
    p.rect(gold, 10, 25, 3, 4); p.rect("#a46a58", 9, 29, 5);
    p.rect("#f3c089", 7, 13, 8, 2); p.rect("#f3c089", 10, 9, 2, 9); p.rect(paper, 10, 12, 2, 3);
  }),

  "seal-roll": stamp("stack of sealing film", 22, 18, (p) => {
    for (let y = 13; y >= 4; y -= 3) {
      p.oval(ink, 10, y, 10, 3); p.oval(y % 2 ? red : copper, 10, y - 1, 9, 3);
      p.oval(paper, 10, y - 2, 8, 2); p.rect(dim, 7, y - 2, 6);
    }
    p.rect(red, 16, 14, 6, 2);
  }),

  shutter: stamp("folded stall shutter", 27, 31, (p) => {
    p.rect(ink, 1, 1, 25, 28); p.rect(dusk, 3, 3, 21, 24);
    for (let y = 4; y < 26; y += 3) { p.rect("#7b7584", 4, y, 19); p.rect(slate, 4, y + 1, 20); }
    p.rect(ink, 3, 3, 2, 25); p.rect(ink, 22, 3, 2, 25); p.rect(copper, 10, 23, 7, 2); p.rect(steel, 3, 28, 22);
  }),

  "sugar-jar": stamp("rock sugar jar", 18, 26, (p) => {
    p.oval(ink, 8, 5, 7, 4); p.rect(ink, 1, 5, 15, 17); p.oval(ink, 8, 21, 7, 4);
    p.oval(gold, 8, 5, 6, 2); p.rect("#a09876", 2, 6, 13, 16); p.oval("#9c826e", 8, 21, 6, 3);
    p.rect(dim, 3, 10, 11, 10); p.rect(paper, 4, 12, 4, 3); p.rect("#e9c996", 9, 11, 3, 3);
    p.rect("#ebc494", 9, 16, 4, 3); p.rect("#fae3b5", 5, 17, 2, 3);
    p.rect("#7c6752", 3, 5, 12, 3); p.rect("#dfb484", 4, 5, 7);
  }),

  receipt: stamp("counter receipt wheel", 20, 21, (p) => {
    p.rect(ink, 1, 10, 18, 10); p.rect(steel, 2, 12, 16, 7); p.rect(slate, 3, 12, 13, 3);
    p.rect(paper, 4, 2, 10, 11); p.rect(dim, 4, 1, 10);
    p.rect(rust, 6, 4, 6); p.rect(dim, 7, 7, 5); p.rect(dim, 6, 9, 6); p.rect(red, 14, 16, 3, 2);
  }),

  "milk-crate": stamp("milk-bottle crate", 33, 26, (p) => {
    for (const [x, y] of [[7, 2], [15, 0], [23, 3]]) {
      p.rect(steel, x, y + 3, 5, 14); p.rect(paper, x + 1, y + 4, 3, 11);
      p.rect(copper, x, y + 1, 5, 3); p.rect(gold, x, y + 1, 4);
    }
    p.rect(ink, 1, 14, 31, 10); p.rect(copper, 2, 15, 29, 8); p.rect(gold, 3, 15, 27, 2);
    p.rect(rust, 3, 21, 27, 2); p.rect(ink, 12, 18, 8, 2);
    p.rect(red, 3, 17, 3, 6); p.rect(red, 27, 17, 3, 6);
  }),

  ticket: stamp("torn order ticket", 24, 31, (p) => {
    p.rect(ink, 2, 3, 20, 25); p.rect(paper, 2, 2, 19, 25);
    for (const y of [8, 11, 17, 20, 23]) p.rect(y === 8 ? rust : dim, 5, y, y === 8 ? 9 : 12);
    p.rect(red, 4, 4, 14); p.rect(pink, 3, 14, 16);
    for (let x = 2; x < 22; x += 4) p.rect(ink, x, 26, 2, 2);
  }),

  takeaway: stamp("paper takeaway cup", 24, 30, (p) => {
    for (let y = 5; y < 28; y++) {
      const inset = 3 + Math.floor((y - 5) / 6);
      p.rect(ink, inset, y, 24 - inset * 2);
      p.rect(y > 10 && y < 22 ? copper : paper, inset + 1, y, 22 - inset * 2);
      p.rect(dim, 20 - inset, y);
    }
    p.rect(ink, 1, 3, 22, 4); p.rect("#d1b392", 2, 3, 20, 2); p.rect(paper, 4, 1, 15, 2);
    p.rect(red, 9, 14, 5, 4); p.rect(gold, 10, 15, 3, 2); p.rect(ink, 8, 27, 9);
  }),

  buoy: stamp("ice-belt buoy", 25, 24, (p) => {
    p.line(steel, 3, 5, 19, 17); p.line(steel, 6, 20, 19, 3);
    p.rect("#9f8478", 9, 1, 5, 4);
    p.oval("#434459", 12, 12, 8, 8); p.oval("#ab8c74", 11, 11, 6, 6);
    p.oval("#d5aa76", 10, 10, 3, 3); p.rect("#5e5767", 11, 6, 1, 11);
    p.rect("#be7165", 10, 17, 4, 5); p.rect("#b5b5ad", 21, 17, 2, 2);
  }),

  greenhouse: stamp("lit greenhouse", 76, 40, (p) => {
    p.rect("#61535b", 3, 18, 69, 20); p.rect("#889583", 4, 19, 67, 18);
    for (let y = 0; y < 14; y++) {
      const x = 11 - Math.floor(y / 2);
      p.rect("#495d60", x - 1, y + 4, 76 - x * 2 + 1);
      p.rect(y < 5 ? "#9aab91" : "#819e8a", x, y + 5, 76 - x * 2);
    }
    for (let x = 11; x < 71; x += 11) {
      p.line("#526a64", x, 5, x - 2, 37, 2); p.rect("#b5b69c", x - 1, 20, 6, 2);
      p.rect("#6a7e5b", x + 4, 31, 4, 5);
    }
    p.rect("#66786c", 3, 18, 69, 2); p.rect("#d2ae84", 5, 19, 64, 1);
    p.rect("#5b5855", 5, 37, 64, 3);
  }),

  // Side-on stand-ins for the sprite stacks in sugar rush's side-on scenes.
  // A stack is seen from above at a slant, so on a ledge seen edge-on it
  // hangs off the front; the guide keeps stacks for things that turn.
  "planter-box": stamp("rooftop tomato planter", 15, 13, (p) => {
    p.rect("#567551", 2, 2, 11, 6); p.rect("#779a59", 3, 1, 4, 4); p.rect("#779a59", 8, 0, 4, 5);
    p.rect("#aac478", 4, 1, 2); p.rect("#aac478", 9, 0, 2);
    p.rect("#be665e", 3, 5, 2, 2); p.rect("#e49375", 10, 4, 2, 2); p.rect("#be665e", 7, 6, 2, 2);
    p.rect(ink, 0, 7, 15, 6); p.rect("#ad6d50", 1, 8, 13, 4); p.rect("#d59b71", 1, 8, 13);
    p.rect("#7e5642", 1, 11, 13);
  }),

  parcel: stamp("courier parcel", 14, 11, (p) => {
    p.rect(ink, 0, 1, 14, 10); p.rect("#b4825d", 1, 2, 12, 8); p.rect("#d3a377", 1, 2, 12, 2);
    p.rect(ink, 1, 0, 12, 1); p.rect("#8c6249", 6, 1, 2, 9);
    p.rect(paper, 9, 5, 3, 3); p.rect(red, 9, 5, 3);
  }),

  mast: stamp("folding solar mast", 36, 35, (p) => {
    p.rect(ink, 14, 29, 11, 5); p.rect(steel, 17, 10, 4, 20);
    p.line(steel, 8, 26, 25, 25); p.rect(ink, 1, 4, 32, 11);
    p.rect("#596e87", 2, 5, 30, 9);
    for (let x = 7; x < 32; x += 6) p.rect("#37465e", x, 5, 1, 9);
    p.rect("#879ba2", 3, 5, 28); p.rect("#3d526a", 2, 10, 30, 1);
    p.rect("#a8755d", 17, 10, 3, 17); p.rect(gold, 22, 26, 2, 2);
  }),

  trap: stamp("glazed overflow trap", 47, 24, (p) => {
    p.line(ink, 2, 5, 16, 5, 6); p.line(ink, 16, 5, 16, 15, 6);
    p.line(ink, 16, 15, 34, 15, 6); p.line(ink, 34, 15, 34, 2, 6);
    p.line("#66858a", 2, 6, 17, 6, 4); p.line("#7d9994", 17, 7, 17, 17, 4);
    p.line("#9ab0a1", 19, 16, 37, 16, 3); p.line("#6b898b", 35, 16, 35, 3, 4);
    p.rect(gold, 1, 3, 3, 10); p.rect(copper, 34, 1, 7, 3);
    p.rect("#d0b491", 23, 14, 3, 9); p.rect(rust, 22, 21, 5, 3);
  }),

  ferry: stamp("little tea ferry", 86, 37, (p) => {
    p.line(ink, 1, 26, 77, 26, 3); p.line(ink, 7, 28, 68, 33, 3);
    p.line("#6b6669", 10, 28, 69, 32, 2);
    p.rect("#655762", 15, 20, 58, 8); p.rect("#d6a07d", 16, 20, 54, 6);
    p.rect("#825b5c", 20, 10, 46, 12); p.rect("#e3bc8f", 23, 11, 42, 8);
    p.rect("#8c9a9a", 25, 12, 38, 4);
    for (let x = 27; x < 61; x += 8) p.rect("#626d7d", x, 12, 1, 4);
    p.rect(paper, 20, 9, 47, 2); p.rect(copper, 39, 3, 6, 8); p.rect(steel, 61, 2, 2, 8);
    p.rect("#b8a29e", 70, 21, 5, 4); p.rect(red, 15, 25, 55, 2);
    p.rect("#84717a", 8, 35, 58, 2); p.rect("#aa9390", 16, 36, 42);
  }),

  tray: stamp("three-cup service tray", 47, 23, (p) => {
    p.oval(ink, 23, 17, 22, 5); p.oval(copper, 23, 16, 21, 4);
    p.oval(gold, 24, 15, 16, 2);
    for (const [x, y, tea] of [[7, 4, "#c27969"], [19, 1, "#a1a681"], [31, 5, "#ce9a65"]] as const) {
      p.rect(ink, x, y + 3, 10, 11); p.rect(tea, x + 1, y + 4, 8, 8);
      p.rect(paper, x, y + 2, 10, 2); p.rect("#a4655c", x + 6, y, 2, 4);
      p.rect(rust, x + 2, y + 11, 2); p.rect(rust, x + 6, y + 11, 2);
    }
  }),

  carrier: stamp("folded paper carrier", 28, 27, (p) => {
    p.line(ink, 8, 6, 11, 1, 2); p.line(ink, 11, 1, 17, 1, 2); p.line(ink, 17, 1, 20, 6, 2);
    p.rect(ink, 3, 7, 22, 17); p.rect(paper, 4, 7, 20, 16);
    p.rect(dim, 19, 7, 5, 16); p.line(copper, 19, 8, 23, 13); p.line(copper, 19, 21, 23, 17);
    p.rect(red, 6, 10, 10, 8); p.rect("#eda88e", 7, 9, 8, 7);
    p.rect(rust, 8, 12, 5, 1); p.rect(rust, 9, 13, 3, 3);
    p.rect("#ad7771", 2, 24, 24);
  }),

  mirror: stacked("parabolic radio mirror", mirrorArray, 22.5, 0.55),
  planter: stacked("rooftop tomato planter", roofPlanter, 22.5, 0.55),
  vault: stacked("lunar sample vault", sampleVault, 30, 0.5),
  valve: stacked("copper roller valve", rollerValve, 30),
  "dock-lamp": stacked("brass dock lamp", dockLamp, 22.5, 0.52),
  "ice-chest": stacked("open ice chest", iceChest, 22.5, 0.58),
  stamp: stacked("coral order stamp", inkStamp, 30),
  basket: stacked("wicker carry basket", models.catch, 30),
  "lunar-beacon": stacked("parked survey lander", models.lander, 15, 0.48),
  "pearl-satellite": stacked("pearl satellite", models.stack, 30),
  "straw-caddy": stacked("straw caddy", models.stab, 22.5, 0.52),
  kettle: stacked("copper kettle", models.spill, 97.5, 0.6),
  pump: stacked("amber syrup pump", models.orders, 30, 0.56),
};

const artCache = new Map<string, PropFrame>();

function propArt(id: string, turn: number, light: Appearance["light"]) {
  const step = 360 / TURN_STEPS;
  const angle = props[id].slices ? ((Math.round(turn / step) * step % 360) + 360) % 360 : 0;
  const key = id + ":" + angle;
  let art = artCache.get(key);
  if (!art) {
    art = props[id].art(angle);
    artCache.set(key, art);
  }
  if (!light) return art;

  const litKey = `${key}:${light.color}:${light.amount}`;
  let lit = artCache.get(litKey);
  if (!lit) {
    const source = art.canvas;
    const canvas = raster(source.width, source.height, (p) => {
      p.image(source, 0, 0);
      p.ctx.globalCompositeOperation = "source-atop";
      p.ctx.globalAlpha = light.amount;
      p.rect(light.color, 0, 0, source.width, source.height);
    });
    lit = { ...art, canvas };
    artCache.set(litKey, lit);
  }
  return lit;
}

export function paintProp(p: Pixels, id: string, x: number, y: number, { scale = 1, turn = 0, light }: Appearance = {}) {
  p.image(propArt(id, turn, light).canvas, x, y, scale);
}

/** Place the prop's ground point on a surface, regardless of its scale and turn. */
export function paintGroundedProp(
  p: Pixels,
  id: string,
  x: number,
  y: number,
  { scale = 1, turn = 0, light }: Appearance = {},
) {
  const { canvas, anchorX, anchorY } = propArt(id, turn, light);
  p.image(canvas, x, y, scale, anchorX, anchorY);
}
