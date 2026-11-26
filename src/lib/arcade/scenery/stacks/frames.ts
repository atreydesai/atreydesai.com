import { drawSprite } from "#lib/arcade/art.ts";
import { stackGrid } from "#lib/arcade/core/sprite-stack.ts";
import type { SpriteModel } from "./types";

export function modelFrame(model: SpriteModel, angle: number, squash: number, spacing: number, layers = model.slices.length) {
  return stackGrid(model.slices.slice(0, layers), { turn: (angle % 360) * Math.PI / 180, squash, spacing, outline: "O" });
}

export function paintSheet(canvas: HTMLCanvasElement, model: SpriteModel) {
  const width = model.slices[0][0].length;
  canvas.width = width * model.slices.length;
  canvas.height = model.slices[0].length;
  const ctx = canvas.getContext("2d")!;
  for (const [index, slice] of model.slices.entries()) {
    drawSprite(ctx, slice, index * width, 0, 1, model.palette);
  }
}
