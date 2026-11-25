import assert from "node:assert/strict";
import test from "node:test";

import { CREAM, NOTE_BACK, NOTE_GOLD, chipWidth, drawChipNote } from "../src/lib/arcade/art.ts";
import { createRng } from "../src/lib/arcade/core/rng.ts";

/**
 * A canvas context that records what each draw call would paint: the call,
 * its arguments, and the fill and alpha it was made with.
 */
function recorder() {
  const drawn = [];
  return {
    drawn,
    ctx: {
      fillStyle: "",
      globalAlpha: 1,
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      measureText: (text) => ({ width: text.length * 6.37 + (text.charCodeAt(0) % 5) * 0.41 }),
      fillRect(...args) {
        drawn.push(["rect", ...args, this.fillStyle, this.globalAlpha]);
      },
      fillText(...args) {
        drawn.push(["text", ...args, this.fillStyle, this.globalAlpha, this.font, this.textAlign, this.textBaseline]);
      },
    },
  };
}

const SC = 4;
const TEXTS = ["+1", "perfect", "×5 golden", "miss", "full cup +40", "a much longer line of praise"];
const KINDS = ["plain", "perfect", "gold", "miss"];

function popupsFor(seed) {
  const random = createRng(seed);
  return Array.from({ length: 60 }, () => {
    const maxLife = 0.5 + random();
    return {
      x: random() * 900 - 50,
      y: random() * 700 - 20,
      text: TEXTS[Math.floor(random() * TEXTS.length)],
      kind: KINDS[Math.floor(random() * KINDS.length)],
      life: random() * maxLife,
      maxLife,
    };
  });
}

// Each game's popup loop as it was written before `drawChipNote`.
const before = {
  strawStab(ctx, popup) {
    const x = Math.round(popup.x);
    const y = Math.round(popup.y);
    const width = Math.ceil((ctx.measureText(popup.text).width + 14) / SC) * SC;
    ctx.globalAlpha = Math.min(1, Math.max(0, (popup.life / popup.maxLife) * 2));
    ctx.fillStyle = NOTE_BACK;
    ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
    ctx.fillStyle = popup.kind === "gold" ? NOTE_GOLD : CREAM;
    ctx.fillText(popup.text, x, y + 0.5);
  },
  cupStack(ctx, popup) {
    const x = Math.round(popup.x);
    const y = Math.round(popup.y);
    const ink = y > 300 ? { fg: "#1a1a1a", back: CREAM, perfect: "#c9462f", gold: "#704a05" } : { fg: CREAM, back: NOTE_BACK, perfect: "#f07563", gold: NOTE_GOLD };
    const width = Math.ceil((ctx.measureText(popup.text).width + 14) / SC) * SC;
    const fade = Math.max(0, popup.life / popup.maxLife);
    ctx.globalAlpha = fade * 0.92;
    ctx.fillStyle = ink.back;
    ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
    ctx.globalAlpha = fade;
    ctx.fillStyle = popup.kind === "perfect" ? ink.perfect : popup.kind === "gold" ? ink.gold : ink.fg;
    ctx.fillText(popup.text, x, y + 0.5);
  },
  orderUp(ctx, popup) {
    const x = Math.round(popup.x);
    const y = Math.round(popup.y);
    const width = Math.ceil((ctx.measureText(popup.text).width + 12) / SC) * SC;
    ctx.globalAlpha = Math.max(0, Math.min(1, (popup.life / popup.maxLife) * 2));
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
    ctx.fillStyle = popup.kind === "perfect" ? NOTE_GOLD : popup.kind === "miss" ? "#f18272" : CREAM;
    ctx.fillText(popup.text, x, y + 0.5);
  },
  crowd(ctx, note, screenWidth) {
    const width = Math.ceil((ctx.measureText(note.text).width + 12) / 4) * 4;
    const x = Math.round(Math.max(width / 2 + 2, Math.min(screenWidth - width / 2, note.x)));
    const y = Math.round(Math.max(10, note.y));
    ctx.globalAlpha = Math.max(0, Math.min(1, (note.life / note.maxLife) * 2));
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
    ctx.fillStyle = NOTE_GOLD;
    ctx.fillText(note.text, x, y + 0.5);
  },
  sugarRush(ctx, popup, font) {
    const alpha = popup.life / popup.maxLife;
    ctx.font = font;
    const width = Math.ceil((ctx.measureText(popup.text).width + 14) / SC) * SC;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = NOTE_BACK;
    ctx.fillRect(Math.round(popup.x - width / 2), Math.round(popup.y) - 10, width, 20);
    ctx.fillStyle = popup.kind === "gold" ? NOTE_GOLD : CREAM;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(popup.text, Math.round(popup.x), Math.round(popup.y) + 0.5);
    ctx.globalAlpha = 1;
  },
};

// The same loops on the shared helper, as the games now call it.
const after = {
  strawStab(ctx, popup) {
    const alpha = Math.min(1, Math.max(0, (popup.life / popup.maxLife) * 2));
    drawChipNote(ctx, popup.text, Math.round(popup.x), popup.y, { color: popup.kind === "gold" ? NOTE_GOLD : CREAM, alpha, cell: SC });
  },
  cupStack(ctx, popup) {
    const ink = Math.round(popup.y) > 300 ? { fg: "#1a1a1a", back: CREAM, perfect: "#c9462f", gold: "#704a05" } : { fg: CREAM, back: NOTE_BACK, perfect: "#f07563", gold: NOTE_GOLD };
    const fade = Math.max(0, popup.life / popup.maxLife);
    const color = popup.kind === "perfect" ? ink.perfect : popup.kind === "gold" ? ink.gold : ink.fg;
    drawChipNote(ctx, popup.text, Math.round(popup.x), popup.y, { color, back: ink.back, alpha: fade, backAlpha: fade * 0.92, cell: SC });
  },
  orderUp(ctx, popup) {
    const alpha = Math.max(0, Math.min(1, (popup.life / popup.maxLife) * 2));
    const color = popup.kind === "perfect" ? NOTE_GOLD : popup.kind === "miss" ? "#f18272" : CREAM;
    drawChipNote(ctx, popup.text, Math.round(popup.x), popup.y, { color, back: "#1a1a1a", pad: 12, alpha, cell: SC });
  },
  crowd(ctx, note, screenWidth) {
    const width = chipWidth(ctx, note.text, 12);
    const x = Math.round(Math.max(width / 2 + 2, Math.min(screenWidth - width / 2, note.x)));
    const alpha = Math.max(0, Math.min(1, (note.life / note.maxLife) * 2));
    drawChipNote(ctx, note.text, x, Math.max(10, note.y), { color: NOTE_GOLD, back: "#1a1a1a", alpha, width });
  },
  sugarRush(ctx, popup, font) {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawChipNote(ctx, popup.text, popup.x, popup.y, { color: popup.kind === "gold" ? NOTE_GOLD : CREAM, alpha: popup.life / popup.maxLife, cell: SC });
    ctx.globalAlpha = 1;
  },
};

test("a note on a chip draws exactly what each game's own popup loop drew", () => {
  for (const game of Object.keys(before)) {
    for (const seed of [1, 2, 3, 99]) {
      const old = recorder();
      const now = recorder();
      for (const { ctx } of [old, now]) {
        // What each loop sets once before its notes (sugar rush sets it per note).
        ctx.font = "500 13px test";
        if (game !== "sugarRush") {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
        }
      }
      for (const popup of popupsFor(seed)) {
        before[game](old.ctx, popup, 640, "500 13px test");
        after[game](now.ctx, popup, 640, "500 13px test");
      }
      assert.deepEqual(now.drawn, old.drawn, `${game}, seed ${seed}`);
      assert.equal(now.ctx.globalAlpha, old.ctx.globalAlpha, `${game} leaves the alpha as it was`);
      assert.equal(now.ctx.fillStyle, old.ctx.fillStyle, `${game} leaves the fill as it was`);
    }
  }
});
