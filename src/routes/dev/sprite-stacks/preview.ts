import { drawSprite, cachedSprite, HALO, SPRITE_PAD } from "#lib/arcade/art.ts";
import { modelFrame } from "#lib/arcade/scenery/stacks/frames.ts";
import { bayer } from "#lib/arcade/core/dither.ts";
import type { SpriteModel } from "#lib/arcade/scenery/stacks/types.ts";

export const STAGE_WIDTH = 150;
export const STAGE_HEIGHT = 80;
const CENTER_X = STAGE_WIDTH / 2;
export const DEFAULT_GROUND_Y = 49;

const sceneColors: Record<string, { sky: string; join: string; ground: string; edge: string; detail: string }> = {
  catch: { sky: "#f3e2cf", join: "#eddbc5", ground: "#e5c9af", edge: "#d7b599", detail: "#e7cbb5" },
  roof: { sky: "#5e526a", join: "#a7716d", ground: "#594652", edge: "#443742", detail: "#766174" },
  moon: { sky: "#172135", join: "#283953", ground: "#535a75", edge: "#404760", detail: "#65728b" },
  orbit: { sky: "#182036", join: "#2d4161", ground: "#263652", edge: "#1d2b43", detail: "#455775" },
  kitchen: { sky: "#d3d9ce", join: "#c4cdc3", ground: "#a2afa5", edge: "#8e9e95", detail: "#b8c6bb" },
  stall: { sky: "#46394f", join: "#72525a", ground: "#573d43", edge: "#46323a", detail: "#9b6a57" },
  counter: { sky: "#b7b8a0", join: "#a4aa94", ground: "#c69b75", edge: "#af8460", detail: "#d8af87" },
};

export function paintScene(scene: string, groundY: number) {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE_WIDTH;
  canvas.height = STAGE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const colors = sceneColors[scene];
  const horizon = groundY - 12;
  const block = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  block(colors.sky, 0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  for (let y = 14; y < 36; y++) {
    for (let x = 0; x < STAGE_WIDTH; x++) {
      if (bayer(x, y) < (y - 14) / 16) block(colors.join, x, y, 1, 1);
    }
  }

  if (scene === "kitchen" || scene === "counter") {
    const grout = scene === "kitchen" ? "#b3c0b4" : "#a2a58e";
    for (let y = 6; y < horizon; y += 12) {
      block(grout, 0, y, STAGE_WIDTH, 1);
      for (let x = y % 24; x < STAGE_WIDTH; x += 19) block(grout, x, y, 1, 12);
    }
  }

  if (scene === "roof" || scene === "stall") {
    for (let x = 0; x < STAGE_WIDTH; x += 9) {
      const height = 4 + (x * 7 % 13);
      const wall = scene === "roof" ? "#514453" : "#413440";
      block(wall, x, horizon - height, 7, height);
      if (height > 8) block(colors.detail, x + 2, horizon + 3 - height, 2, 2);
    }
  }

  if (scene === "moon" || scene === "orbit") {
    for (let i = 1; i <= 27; i++) {
      block(i % 4 ? "#66728a" : "#9696a1", i * 43 % STAGE_WIDTH, i * 17 % 34, 1, 1);
    }
    for (let x = 0; x < STAGE_WIDTH; x += 7) {
      const height = 2 + (x * 3 % 7 + x / 7) % 7;
      block(colors.ground, x, horizon - height, 7, height);
    }
  }

  block(colors.ground, 0, horizon, STAGE_WIDTH, STAGE_HEIGHT - horizon);
  block(colors.detail, 0, horizon, STAGE_WIDTH, 1);
  const front = Math.min(STAGE_HEIGHT - 4, groundY + 20);
  block(colors.edge, 0, front, STAGE_WIDTH, STAGE_HEIGHT - front);

  for (let i = 0; i < 23; i++) {
    const x = (17 + i * 47) % STAGE_WIDTH;
    const y = horizon + 3 + (i * 19) % (front - horizon - 3);
    block(colors.detail, x, y, 2 + (i % 5), 1);
  }

  // The backdrop is a painted set. The specimen and its ground point stay
  // fixed in it while the slices turn, and the ground shadow stays still.
  block(colors.edge, CENTER_X - 16, groundY - 2, 32, 5);
  block(colors.edge, CENTER_X - 12, groundY - 4, 24, 9);
  return canvas;
}

export function paintTurntable(
  canvas: HTMLCanvasElement,
  scene: HTMLCanvasElement,
  model: SpriteModel,
  id: string,
  groundY: number,
  angle: number,
  squash: number,
  spacing: number,
  layers: number,
) {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene, 0, 0);
  const frame = modelFrame(model, angle, squash, spacing, layers);
  const sprite = cachedSprite(["specimen", id, angle, squash, spacing, layers].join("-"), frame.grid, 1, model.palette, HALO);
  ctx.drawImage(sprite, Math.round(CENTER_X - frame.anchorX) - SPRITE_PAD, Math.round(groundY - frame.anchorY) - SPRITE_PAD);
}

export function paintThumbnail(canvas: HTMLCanvasElement, model: SpriteModel, angle: number) {
  const ctx = canvas.getContext("2d")!;
  const { grid } = modelFrame(model, angle, 0.75, 1);
  let left = grid[0].length;
  let right = -1;
  let top = grid.length;
  let bottom = -1;
  for (const [y, row] of grid.entries()) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ".") continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = y;
    }
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSprite(ctx, grid, Math.round((canvas.width - left - right - 1) / 2), Math.round((canvas.height - top - bottom - 1) / 2), 1, model.palette);
}
