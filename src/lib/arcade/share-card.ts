// The share card: a small image of a run that a player can paste or send,
// drawn on a canvas in the arcade's print style. A riso sheet (cream paper, a
// rough ink edge, the accent slab printed off register) on the shop wall,
// with the game's pixel icon and name, the score circled in pen, a new-best
// stamp when it earned one, the run's best stats as a receipt, the game's
// own emoji lines, and the site.
//
// It always prints in the light palette, whatever theme the player is in, so
// every card looks like every other. It must stand on its own: some share
// targets drop the text sent beside a file, so the name, the score, and the
// site are all drawn in.

import { LOOPS, MENU_ICONS } from "./art";
import { SITE, figure, sharedStats, unitFor, type ShareInput } from "./share";

export const CARD_W = 1200;
export const CARD_H = 800;

const INK = "#1a1a1a";
const PAPER = "#fbf2e8";
const SLAB = "#e85d4c";
const MUTED = "#6b625c";
const WALL = "#d9c7b0";
const WALL_DOT = "#cfbba2";
const RULE = "rgba(26, 26, 26, 0.28)";

/** The sheet on the wall, and the padding inside it. */
const SHEET = { x: 44, y: 40, w: CARD_W - 100, h: CARD_H - 92 };
const PAD = 58;

function cssFamily(variable: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

/** A small seeded generator, so a game's card is roughened the same way every time. */
function seeded(text: string) {
  let state = 2166136261;
  for (const char of text) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

/** A rectangle with hand-cut corners and a wobble along its sides. */
function roughRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  random: () => number,
  wobble = 1.6,
) {
  const radii = [14, 20, 13, 17];
  const jitter = () => (random() - 0.5) * 2 * wobble;
  const side = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 46));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      ctx.lineTo(x0 + (x1 - x0) * t + jitter(), y0 + (y1 - y0) * t + jitter());
    }
  };
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  side(x + radii[0], y, x + w - radii[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radii[1]);
  side(x + w, y + radii[1], x + w, y + h - radii[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h);
  side(x + w - radii[2], y + h, x + radii[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radii[3]);
  side(x, y + h - radii[3], x, y + radii[0]);
  ctx.quadraticCurveTo(x, y, x + radii[0], y);
  ctx.closePath();
}

function drawIcon(ctx: CanvasRenderingContext2D, gameId: string, x: number, y: number, px: number) {
  const icon = MENU_ICONS[gameId];
  if (!icon) return 0;
  icon.grid.forEach((row, rowIndex) => {
    [...row].forEach((cell, column) => {
      const color = icon.palette[cell];
      if (cell === "." || !color) return;
      ctx.fillStyle = color === "currentColor" ? INK : color;
      ctx.fillRect(x + column * px, y + rowIndex * px, px, px);
    });
  });
  return Math.max(...icon.grid.map((row) => row.length)) * px;
}

/** Shrinks `size` until `text` fits in `width`. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number, min = 16) {
  let fitted = size;
  ctx.font = font(fitted);
  while (fitted > min && ctx.measureText(text).width > width) {
    fitted -= 2;
    ctx.font = font(fitted);
  }
  return fitted;
}

/**
 * Draws the card for a run and resolves to it as a PNG. Waits for the site's
 * faces first, so the very first card isn't set in a fallback.
 */
export async function renderShareCard(input: ShareInput): Promise<Blob> {
  const display = cssFamily("--font-display", '"neue-haas-grotesk-display", Helvetica, Arial, sans-serif');
  const ui = cssFamily("--font-ui", '"neue-haas-grotesk-text", Helvetica, Arial, sans-serif');
  const faces = [`700 120px ${display}`, `400 40px ${ui}`, `500 40px ${ui}`, `italic 400 40px ${ui}`];
  try {
    await Promise.race([
      Promise.all(faces.map((face) => document.fonts.load(face))),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Fonts unavailable: the fallbacks in the stack still draw a card.
  }

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const random = seeded(`${input.gameId}-${input.expert}`);

  // The shop wall, with a faint print of dots.
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = WALL_DOT;
  for (let y = 10; y < CARD_H; y += 20) {
    for (let x = (y / 20) % 2 ? 20 : 10; x < CARD_W; x += 20) ctx.fillRect(x, y, 3, 3);
  }

  // The accent slab, printed off register behind the sheet.
  ctx.save();
  ctx.translate(SHEET.x + SHEET.w / 2, SHEET.y + SHEET.h / 2);
  ctx.rotate((-0.6 * Math.PI) / 180);
  ctx.translate(-(SHEET.x + SHEET.w / 2), -(SHEET.y + SHEET.h / 2));
  roughRect(ctx, SHEET.x + 12, SHEET.y + 12, SHEET.w, SHEET.h, random, 2.4);
  ctx.fillStyle = SLAB;
  ctx.fill();
  ctx.restore();

  // The paper, and its rough ink edge.
  roughRect(ctx, SHEET.x, SHEET.y, SHEET.w, SHEET.h, random);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.stroke();

  const left = SHEET.x + PAD;
  const right = SHEET.x + SHEET.w - PAD;
  const top = SHEET.y + PAD;
  const bottom = SHEET.y + SHEET.h - PAD;

  // The masthead: icon, name, and the mode; the site on the right.
  ctx.textBaseline = "alphabetic";
  const iconWidth = drawIcon(ctx, input.gameId, left, top - 4, 8);
  const nameX = left + iconWidth + 24;
  ctx.fillStyle = INK;
  ctx.font = `400 52px ${ui}`;
  ctx.fillText(input.game, nameX, top + 44);
  if (input.expert) {
    const nameWidth = ctx.measureText(input.game).width;
    ctx.fillStyle = SLAB;
    ctx.font = `italic 400 32px ${ui}`;
    ctx.fillText("expert", nameX + nameWidth + 16, top + 44);
  }
  ctx.fillStyle = MUTED;
  ctx.font = `italic 400 26px ${ui}`;
  ctx.fillText("the boba arcade", nameX, top + 80);
  ctx.textAlign = "right";
  ctx.font = `500 26px ${ui}`;
  ctx.fillText(SITE, right, top + 40);
  ctx.textAlign = "left";

  // Two columns under the masthead: the score on the left, the receipt on
  // the right; the game's emoji lines run across the foot of the sheet.
  const stats = sharedStats(input.stats, input.score, input.unit);
  const lines = input.lines.map((line) => line.trim()).filter(Boolean).slice(0, 4);
  const columnX = SHEET.x + SHEET.w * 0.55;
  const bandTop = top + 132;
  const footTop = lines.length ? bottom - Math.min(4, lines.length) * 46 - 28 : bottom;
  const bandBottom = footTop - (lines.length ? 22 : 0);
  const scoreRight = stats.length ? columnX - 56 : right;

  // The score, circled in pen, its unit under the loop.
  const scoreText = figure(input.score);
  const loopPadX = 46;
  const scoreSize = fitSize(
    ctx,
    scoreText,
    (size) => `700 ${size}px ${display}`,
    176,
    scoreRight - left - 2 * loopPadX,
    72,
  );
  const scoreWidth = ctx.measureText(scoreText).width;
  const capHeight = scoreSize * 0.72;
  const blockHeight = capHeight + 44 + 40;
  const scoreBase = Math.round(bandTop + (bandBottom - bandTop - blockHeight) / 2 + capHeight + 22);
  const scoreX = left + loopPadX;
  const loopX = scoreX - loopPadX;
  const loopY = scoreBase - capHeight - 26;
  const loopW = scoreWidth + 2 * loopPadX;
  const loopH = capHeight + 52;
  ctx.save();
  ctx.translate(loopX, loopY);
  ctx.scale(loopW / 44, loopH / 28);
  ctx.strokeStyle = SLAB;
  ctx.lineWidth = 0.95;
  ctx.lineCap = "round";
  ctx.stroke(new Path2D(LOOPS[1]));
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${scoreSize}px ${display}`;
  ctx.fillText(scoreText, scoreX, scoreBase);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${ui}`;
  ctx.fillText(unitFor(input.score, input.unit), scoreX, loopY + loopH + 40);

  // A new best is stamped across the top of the loop, a little crooked.
  if (input.newBest) {
    ctx.save();
    ctx.translate(loopX + loopW / 2, loopY + 4);
    ctx.rotate((-6 * Math.PI) / 180);
    ctx.font = `500 22px ${ui}`;
    const spaced = [..."NEW BEST"].join(String.fromCharCode(8202));
    const width = ctx.measureText(spaced).width + 30;
    ctx.fillStyle = PAPER;
    ctx.fillRect(-width / 2, -20, width, 40);
    ctx.strokeStyle = SLAB;
    ctx.lineWidth = 3;
    ctx.strokeRect(-width / 2, -20, width, 40);
    ctx.fillStyle = SLAB;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(spaced, 0, 1);
    ctx.restore();
  }

  const dashed = (x0: number, x1: number, y: number) => {
    ctx.save();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.restore();
  };

  // The receipt: the run's best stats, label, dot leader, figure, centred
  // in the band beside the score.
  if (stats.length) {
    const rowGap = 60;
    const receiptHeight = (stats.length - 1) * rowGap + 30;
    let rowY = Math.round(bandTop + (bandBottom - bandTop - receiptHeight) / 2 + 30);
    dashed(columnX, right, rowY - 52);
    ctx.textBaseline = "alphabetic";
    for (const stat of stats) {
      const value = String(figure(stat.value));
      ctx.font = `500 32px ${ui}`;
      const valueWidth = ctx.measureText(value).width;
      ctx.fillStyle = INK;
      ctx.textAlign = "right";
      ctx.fillText(value, right, rowY);
      ctx.textAlign = "left";
      const labelSize = fitSize(ctx, stat.label, (size) => `400 ${size}px ${ui}`, 29, right - columnX - valueWidth - 44, 18);
      ctx.font = `400 ${labelSize}px ${ui}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(stat.label, columnX, rowY);
      const labelWidth = ctx.measureText(stat.label).width;
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = MUTED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(columnX + labelWidth + 12, rowY - 7);
      ctx.lineTo(right - valueWidth - 12, rowY - 7);
      ctx.stroke();
      ctx.restore();
      rowY += rowGap;
    }
    dashed(columnX, right, rowY - 36);
  }

  // The game's own emoji lines across the foot, whole lines at a time
  // (splitting them would break keycaps and joined emoji), as large as fits.
  if (lines.length) {
    dashed(left, right, footTop - 4);
    const room = bottom + 8 - footTop;
    let size = Math.min(44, Math.floor((room - 12) / (lines.length * 1.25)));
    ctx.font = `${size}px ${ui}`;
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (widest > right - left) size = Math.max(16, Math.floor((size * (right - left)) / widest));
    ctx.font = `${size}px ${ui}`;
    ctx.fillStyle = INK;
    ctx.textBaseline = "top";
    lines.forEach((line, index) => ctx.fillText(line, left, footTop + 18 + index * size * 1.25));
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
}
