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
 * variant is cached by camera position and clock tick, without its own loop.
 */
export function createBackdrop(game: GameId) {
  const plates: Array<{
    canvas: HTMLCanvasElement;
    time: number;
    altitude: number;
    entry: number;
  } | undefined> = [];
  // Cup stack's sky pans with the tower and drifts behind it the whole game,
  // so its plate is redrawn every frame on a grid as fine as the screen's
  // (up to four steps an art pixel). Moving a whole art pixel at a time,
  // three to five screen pixels, read as a choppy frame rate.
  const smooth = game === "stack";
  const rate = smooth ? 60 : 15;
  let time = 0;
  let grain = 1;

  function plate(altitude: number, alternate: boolean, entry = 1) {
    const index = Number(alternate);
    let frame = plates[index];
    if (!frame || frame.canvas.width !== WIDTH * grain) {
      const canvas = frame?.canvas ?? document.createElement("canvas");
      canvas.width = WIDTH * grain;
      canvas.height = HEIGHT * grain;
      frame = plates[index] = { canvas, time: -1, altitude: -1, entry: -1 };
    }
    const height = alternate ? 0 : altitude;
    if (frame.time !== time || frame.altitude !== height || frame.entry !== entry) {
      renderBackdrop(frame.canvas, game, height, time, alternate, entry);
      frame.time = time;
      frame.altitude = height;
      frame.entry = entry;
    }
    return frame.canvas;
  }

  function draw(ctx: CanvasRenderingContext2D, options: Frame) {
    const {
      left = 0, top = 0, width, height, opacity = 1, focus = 0.55,
      rows = HEIGHT, alternate = 0, align,
    } = options;
    if (width < 1 || height < 1 || opacity <= 0) return;
    if (smooth) grain = clamp(Math.round(width * Math.abs(ctx.getTransform().a) / WIDTH), 1, 4);
    const steps = smooth ? 64 : 8;
    const altitude = Math.round(clamp(options.altitude ?? 0, 0, 124) * steps) / steps;
    // A preference change leaves an already-painted view where it is.
    if (!options.still || options.time < time) time = Math.floor(Math.max(0, options.time) * rate) / rate;

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
      ctx.drawImage(canvas, 0, 0, WIDTH * grain, rows * grain, left, artTop, width, artHeight);
      const bottom = artTop + artHeight;
      if (bottom < top + height) ctx.drawImage(canvas, 0, rows * grain - 1, 1, 1, left, bottom, width, top + height - bottom);
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
    transition ??= document.createElement("canvas");
    if (transition.width !== WIDTH * grain) {
      transition.width = WIDTH * grain;
      transition.height = HEIGHT * grain;
    }
    const ctx = transition.getContext("2d")!;
    ctx.globalAlpha = 1;
    ctx.drawImage(plate(altitude, false), 0, 0);
    ctx.globalAlpha = amount;
    const entry = game === "stack" ? Math.round(amount * 160) / 160 : 1;
    ctx.drawImage(plate(altitude, true, entry), 0, 0);
    return transition;
  }

  return draw;
}
