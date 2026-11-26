import type { GameId } from "#lib/boba.ts";
import { clamp, HEIGHT, WIDTH } from "./pixel";
import { renderBackdrop } from "./stage";

interface Placement {
  left?: number;
  top?: number;
  width: number;
  height: number;
  /** Where to align the painting vertically when the view's aspect changes. */
  focus?: number;
  /** An upper crop, for games with their own opaque lower set. */
  rows?: number;
  opacity?: number;
  /** Tie a row of the painting to a landmark in a game's existing camera. */
  align?: { row: number; y: number };
}

interface Frame extends Placement {
  time: number;
  still: boolean;
  altitude?: number;
  /** Share of the alternate painting, from 0 to 1. */
  alternate?: number;
}

/**
 * The scenery rides the game's canvas and clock. One native-pixel plate per
 * variant is cached by camera band and 15 Hz clock tick. It has no frame loop
 * of its own.
 */
export function createBackdrop(game: GameId) {
  const plates: Array<{
    canvas: HTMLCanvasElement;
    time: number;
    altitude: number;
  } | undefined> = [];
  let time = 0;

  function plate(altitude: number, alternate: boolean) {
    const index = Number(alternate);
    let frame = plates[index];
    if (!frame) {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      frame = plates[index] = { canvas, time: -1, altitude: -1 };
    }
    const height = alternate ? 0 : altitude;
    if (frame.time !== time || frame.altitude !== height) {
      renderBackdrop(frame.canvas, game, height, time, alternate);
      frame.time = time;
      frame.altitude = height;
    }
    return frame.canvas;
  }

  function draw(ctx: CanvasRenderingContext2D, options: Frame) {
    const {
      left = 0, top = 0, width, height, opacity = 1, focus = 0.55,
      rows = HEIGHT, alternate = 0, align,
    } = options;
    if (width < 1 || height < 1 || opacity <= 0) return;
    const altitude = Math.round(clamp(options.altitude ?? 0, 0, 100));
    // A preference change leaves an already-painted view where it is.
    if (!options.still || options.time < time) time = Math.floor(Math.max(0, options.time) * 15) / 15;

    const artHeight = Math.max(1, Math.round(width * rows / WIDTH));
    const positioned = align ? align.y - align.row * width / WIDTH : top + (height - artHeight) * focus;
    const artTop = Math.round(clamp(positioned, top - artHeight, top + height));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (artTop < top || artTop + artHeight > top + height) {
      ctx.beginPath();
      ctx.rect(left, top, width, height);
      ctx.clip();
    }

    function place(canvas: HTMLCanvasElement) {
      // Fill the extra sky/floor on narrow displays with flat edge ink. A
      // detailed row would stretch any prop it happened to cross.
      if (artTop > top) ctx.drawImage(canvas, 0, 0, 1, 1, left, top, width, artTop - top);
      ctx.drawImage(canvas, 0, 0, WIDTH, rows, left, artTop, width, artHeight);
      const bottom = artTop + artHeight;
      if (bottom < top + height) ctx.drawImage(canvas, 0, rows - 1, 1, 1, left, bottom, width, top + height - bottom);
    }

    // Crossfade the two paintings once into a plate, before laying that
    // plate over the game. The background underneath stays at the same
    // opacity for the entire changeover.
    ctx.globalAlpha *= opacity;
    if (alternate <= 0) place(plate(altitude, false));
    else if (alternate >= 1) place(plate(altitude, true));
    else place(blend(altitude, alternate));
    ctx.restore();
  }

  let transition: HTMLCanvasElement | undefined;

  function blend(altitude: number, amount: number) {
    if (!transition) {
      transition = document.createElement("canvas");
      transition.width = WIDTH;
      transition.height = HEIGHT;
    }
    const ctx = transition.getContext("2d")!;
    ctx.globalAlpha = 1;
    ctx.drawImage(plate(altitude, false), 0, 0);
    ctx.globalAlpha = amount;
    ctx.drawImage(plate(altitude, true), 0, 0);
    return transition;
  }

  return draw;
}
