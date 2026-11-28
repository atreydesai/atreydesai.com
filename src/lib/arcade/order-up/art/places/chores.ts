/**
 * Closing chores: the shop's back counter after hours, tiled wall, a shelf,
 * a clock. On the counter stands what is being cleaned (a machine in its
 * tier's metal, the till) or, for the floor, a mop leans in a grimy puddle.
 * Grime lifts as the job goes; a sponge works over it, suds rise, and a
 * gauge under it times each scrub. The room is baked; the grime, sponge
 * and gauge are painted every frame.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, contact, surface, tileAt, floorAt, floorRows, windowPane,
  hangingLamp, pool, dim, beam, gauge, ink, type Light, type Tone,
} from "./kit.ts";

export interface ChoreTarget {
  kind: "machine" | "till" | "mop";
  station?: string;
  tier?: number;
  tint?: string;
}

const W = PLACE_W;
const H = PLACE_H;
const TOP = 176;
const TOP_D = 14;
const FLOOR = 232;
const CX = 216;

export function drawChoresBackdrop(p: Painter, light: Light, target: ChoreTarget) {
  const t = tone(light, 0.3, 0.45);
  surface(p, 0, 0, W, TOP - TOP_D, [t.front("#dfe3d6"), t.front("#d3d9c9"), t.front("#b9c0ad")], tileAt(10, 5));
  p.rect(t.front("#7d8e7d"), 0, 98, W, 3);
  p.rect(t.top("#a6b5a2"), 0, 98, W, 1);
  surface(p, 0, FLOOR, W, H - FLOOR, [t.top("#8c6a52"), t.top("#94705a"), t.top("#6e523f"), t.top("#a17b60")], floorAt(floorRows(H - FLOOR, 5, 1.4), 60));
  p.dither(INK, 0, FLOOR, W, 3, 0.35);

  windowPane(p, t, 28, 28, 70, 54, "#6d7b6e", 21);
  clock(p, t, light, 380, 48);
  // A shelf of clean cups and a stack of towels.
  box(p, t, 272, 74, 86, 3, 5, { top: "#a77856", front: "#7a5a46" });
  for (let i = 0; i < 6; i++) {
    const cx = 278 + i * 13;
    p.rect(ink(t), cx - 1, 60, 10, 14);
    p.rect(t.front("#f4efe4"), cx, 61, 8, 13);
    p.rect(t.left("#ffffff"), cx, 61, 2, 13);
    p.rect(t.front("#c4574a"), cx, 66, 8, 2);
  }
  for (let i = 0; i < 3; i++) box(p, t, 116 + i * 2, 70 - i * 6, 30 - i * 4, 5, 2, { top: ["#e8d6b4", "#a9c0cc", "#e8a39c"][i], front: mixHex(["#e8d6b4", "#a9c0cc", "#e8a39c"][i], INK, 0.12) });
  box(p, t, 108, 74, 46, 3, 4, { top: "#a77856", front: "#7a5a46" });

  counter(p, t);
  if (target.kind === "machine") machine(p, t, target.station ?? "brew", target.tier ?? 1, target.tint ?? "#bd895c");
  else if (target.kind === "till") register(p, t);
  else {
    // The floor's turn: a wet-floor sign on the counter's end.
    sign(p, t, 330, FLOOR + 18);
  }
  // Suds in a bucket and a spray bottle.
  bucket(p, t, 34, FLOOR + 24);
  spray(p, t, 360, TOP - 2);

  const lamp = hangingLamp(p, t, CX, 0, 48, "#7d8e7d");
  beam(p, 28, 98, 88, 240, Math.round(light.azimuth * 70), light.sun * (1 - light.night) * 0.3);
  if (lamp.on) {
    dim(p, CX, 170, 280, 190, 0.32 * light.night);
    pool(p, CX, 172, 180, 80, 0.38 * Math.max(0.4, light.night));
  }
}

function clock(p: Painter, t: Tone, light: Light, cx: number, cy: number) {
  p.oval(ink(t), cx, cy, 13, 13);
  p.oval(t.front("#f6efe0"), cx, cy, 11, 11);
  p.oval(t.front("#7d8e7d"), cx, cy - 11, 2, 1);
  const ha = ((light.hour % 12) / 12) * Math.PI * 2;
  const ma = (light.hour % 1) * Math.PI * 2;
  p.line(ink(t), cx, cy, Math.round(cx + Math.sin(ha) * 6), Math.round(cy - Math.cos(ha) * 6));
  p.line(t.front("#c4574a"), cx, cy, Math.round(cx + Math.sin(ma) * 9), Math.round(cy - Math.cos(ma) * 9));
}

function counter(p: Painter, t: Tone) {
  box(p, t, 0, TOP, W, FLOOR - TOP, TOP_D, { top: "#cfc7b6", front: "#8f6a50" }, false);
  p.rect(ink(t), 0, TOP - TOP_D - 1, W, 1);
  // A steel lip, cupboard doors.
  p.rect(t.front("#a9b0ae"), 0, TOP, W, 3);
  p.rect(ink(t), 0, TOP + 3, W, 1);
  for (let k = 0; k < 6; k++) {
    const dx = 8 + k * 72;
    p.rect(t.shade("#6e5240"), dx, TOP + 9, 64, FLOOR - TOP - 16);
    p.rect(t.front("#94705a"), dx + 1, TOP + 10, 62, FLOOR - TOP - 18);
    p.rect(t.front("#a8826a"), dx + 1, TOP + 10, 62, 1);
    p.rect(ink(t), dx + (k % 2 ? 6 : 54), TOP + 22, 3, 12);
  }
  p.rect(t.shade("#4f3a2e"), 0, FLOOR - 4, W, 4);
}

const METALS: Record<number, [string, string, string]> = {
  1: ["#b8846c", "#d9a98e", "#8a5c4b"],
  2: ["#a9bab4", "#d5e0dc", "#6e8c87"],
  3: ["#c9a560", "#ecd08e", "#8c7149"],
};

/** The machine on the counter, by what it does, in its tier's metal. */
function machine(p: Painter, t: Tone, station: string, tier: number, tint: string) {
  const [metal, hi, lo] = METALS[Math.max(1, Math.min(3, tier))];
  const base = TOP - 4;
  contact(p, CX - 40, base + 1, 80, 0.45);
  if (station === "serve" || station === "front") {
    // A cup sealer: a press arm over a well.
    box(p, t, CX - 34, base - 36, 68, 36, 8, { top: hi, front: metal });
    p.rect(ink(t), CX - 22, base - 88, 44, 30);
    p.rect(t.front(metal), CX - 21, base - 87, 42, 28);
    p.rect(t.left(hi), CX - 21, base - 87, 3, 28);
    p.rect(t.away(lo), CX + 16, base - 85, 5, 26);
    p.rect(ink(t), CX - 4, base - 58, 8, 12);
    p.rect(t.front(lo), CX - 3, base - 58, 6, 11);
    p.rect(t.shade("#3a3337"), CX - 14, base - 30, 28, 18);
    p.rect(t.front("#f4efe4"), CX - 7, base - 26, 14, 14);
    p.rect(t.front(tint), CX - 6, base - 20, 12, 8);
    p.rect(t.front("#f0c482"), CX - 7, base - 27, 14, 2);
  } else if (station === "prep" || station === "back") {
    // A pot cooker: a round-shouldered body, a lid, a dial.
    p.rect(ink(t), CX - 33, base - 52, 66, 53);
    p.oval(ink(t), CX, base - 52, 33, 10);
    p.rect(t.front(metal), CX - 32, base - 52, 64, 52);
    p.oval(t.top(hi), CX, base - 52, 32, 9);
    p.oval(t.top(metal), CX, base - 52, 26, 6);
    p.rect(t.left(hi), CX - 32, base - 50, 4, 48);
    p.rect(t.away(lo), CX + 25, base - 50, 7, 48);
    p.rect(ink(t), CX - 4, base - 66, 8, 6);
    p.rect(t.top(lo), CX - 3, base - 65, 6, 4);
    p.rect(t.front(lo), CX - 32, base - 26, 64, 2);
    p.oval(ink(t), CX + 16, base - 14, 5, 5);
    p.oval(t.front("#f6efe0"), CX + 16, base - 14, 4, 4);
    p.line(t.front("#c4574a"), CX + 16, base - 14, CX + 18, base - 17);
    p.rect(t.front(tint), CX - 20, base - 40, 20, 3);
  } else {
    // A tea urn (brew) or dispenser (build): a tall tank with a sight glass and a tap.
    const tall = station === "brew" ? 82 : 64;
    p.rect(ink(t), CX - 27, base - tall - 1, 54, tall + 1);
    p.rect(t.front(metal), CX - 26, base - tall, 52, tall);
    p.rect(t.top(hi), CX - 26, base - tall, 52, 3);
    p.rect(t.left(hi), CX - 26, base - tall + 3, 4, tall - 3);
    p.rect(t.away(lo), CX + 19, base - tall + 3, 7, tall - 3);
    for (const y of [base - tall + 18, base - 20]) p.rect(t.front(lo), CX - 26, y, 52, 2);
    // The lid and its knob.
    p.rect(ink(t), CX - 22, base - tall - 7, 44, 7);
    p.rect(t.top(hi), CX - 21, base - tall - 6, 42, 5);
    p.rect(ink(t), CX - 4, base - tall - 12, 8, 5);
    p.rect(t.top(lo), CX - 3, base - tall - 11, 6, 3);
    // The sight glass shows the tea.
    p.rect(ink(t), CX - 15, base - tall + 22, 10, tall - 46);
    p.rect(t.front("#e8eee6"), CX - 14, base - tall + 23, 8, tall - 48);
    p.rect(t.front(tint), CX - 14, base - tall + 23 + Math.round((tall - 48) * 0.35), 8, Math.round((tall - 48) * 0.65));
    p.rect(t.left("#ffffff"), CX - 13, base - tall + 24, 1, tall - 50);
    if (station === "build") {
      for (let i = 0; i < 3; i++) {
        p.rect(ink(t), CX + 1 + i * 6, base - 30, 5, 10);
        p.rect(t.front(["#c98a4b", "#9e3f4a", "#e0c070"][i]), CX + 2 + i * 6, base - 29, 3, 8);
      }
    } else {
      p.rect(ink(t), CX + 2, base - 32, 14, 6);
      p.rect(t.front(lo), CX + 3, base - 31, 12, 4);
      p.rect(ink(t), CX + 12, base - 27, 4, 7);
    }
    p.rect(ink(t), CX - 2, base - 12, 26, 6);
    p.rect(t.top("#3a3337"), CX - 1, base - 11, 24, 4);
  }
  // A tier badge: a pip per tier.
  p.rect(ink(t), CX + 8, base - 50, 4 + tier * 4, 7);
  for (let i = 0; i < tier; i++) p.rect(t.front("#f0c482"), CX + 10 + i * 4, base - 48, 2, 3);
}

function register(p: Painter, t: Tone) {
  const base = TOP - 4;
  contact(p, CX - 40, base + 1, 80, 0.45);
  box(p, t, CX - 36, base - 26, 72, 26, 12, { top: "#b4c1a6", front: "#8c9a7f" });
  // Keys on the sloped top, a display on a stalk, a drawer below.
  for (let i = 0; i < 12; i++) {
    const kx = CX - 30 + (i % 6) * 10;
    const ky = base - 37 + Math.floor(i / 6) * 5;
    p.rect(ink(t), kx, ky, 8, 4);
    p.rect(t.top(i % 6 === 5 ? "#e8a39c" : "#f1e9d6"), kx + 1, ky, 6, 3);
  }
  p.rect(ink(t), CX + 12, base - 62, 4, 24);
  p.rect(ink(t), CX + 2, base - 66, 26, 12);
  p.rect(t.front("#2f3a37"), CX + 3, base - 65, 24, 10);
  p.rect(t.front("#9fc3a9"), CX + 5, base - 63, 14, 3);
  p.rect(t.front(mixHex("#8c9a7f", INK, 0.25)), CX - 36, base - 12, 72, 1);
  p.rect(ink(t), CX - 6, base - 8, 12, 3);
  p.rect(t.front("#e0b85c"), CX - 5, base - 8, 10, 1);
  // A roll of receipt paper curling off it.
  p.rect(t.front("#fbf7ee"), CX - 34, base - 46, 8, 10);
  p.rect(ink(t), CX - 35, base - 47, 10, 1);
}

function sign(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 12, base + 1, 26, 0.4);
  p.poly(ink(t), [x - 12, base, x - 6, base - 30, x + 6, base - 30, x + 12, base]);
  p.poly(t.front("#e9c46a"), [x - 10, base - 1, x - 5, base - 28, x + 5, base - 28, x + 10, base - 1]);
  p.poly(ink(t), [x, base - 22, x + 5, base - 12, x - 5, base - 12]);
  p.rect(t.front("#e9c46a"), x - 1, base - 18, 2, 3);
}

function bucket(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 2, base + 1, 34, 0.45);
  p.rect(ink(t), x - 1, base - 24, 32, 25);
  p.rect(t.front("#7f97a3"), x, base - 23, 30, 23);
  p.rect(t.left("#a9bcc6"), x, base - 23, 3, 23);
  p.rect(t.away("#5f7682"), x + 25, base - 21, 5, 21);
  p.rect(t.front("#5f7682"), x, base - 12, 30, 1);
  for (let i = 0; i < 9; i++) p.oval(t.top("#f3f6f1"), x + 4 + (i % 5) * 5 + (i > 4 ? 2 : 0), base - 24 - (i > 4 ? 3 : 0), 3, 2);
  for (let i = 0; i <= 28; i++) p.rect(ink(t), x + 1 + i, base - 23 - Math.round(Math.sin((i / 28) * Math.PI) * 9), 1, 1);
}

function spray(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 1, base + 1, 12, 0.4);
  p.rect(ink(t), x - 1, base - 18, 11, 19);
  p.rect(t.front("#a9cfd6"), x, base - 17, 9, 17);
  p.rect(t.left("#d6eef2"), x, base - 17, 2, 17);
  p.rect(ink(t), x + 1, base - 24, 9, 7);
  p.rect(t.front("#c4574a"), x + 2, base - 23, 6, 5);
  p.rect(ink(t), x + 8, base - 23, 4, 2);
}

/**
 * The moving part: grime by how dirty it still is, the sponge at work,
 * the timing gauge. `cursor` is the needle 0..1; `working` while a job runs.
 */
export function drawChoresLife(p: Painter, light: Light, target: ChoreTarget, dirt: number, time: number, cursor: number, working: boolean) {
  const t = tone(light, 0.3, 0.45);
  const d = Math.max(0, Math.min(1, dirt));
  const floor = target.kind === "mop";
  // Where the grime sits: over the machine or the till, or a puddle on the floor.
  const area = floor ? { x: 120, y: FLOOR + 6, w: 190, h: 28 } : { x: CX - 30, y: TOP - 80, w: 60, h: 70 };
  if (d > 0.02) {
    p.alpha(Math.min(0.85, d * 0.95), () => {
      for (let i = 0; i < 14; i++) {
        const gx = area.x + Math.floor(noise(i, 0, 60) * area.w);
        const gy = area.y + Math.floor(noise(i, 1, 60) * area.h);
        const r = floor ? 6 + (i % 4) * 3 : 3 + (i % 3);
        p.oval(i % 3 ? "#6b5640" : "#857055", gx, gy, r, floor ? r * 0.35 : r * 0.7);
      }
    });
  }
  if (floor) mop(p, t, 214 + Math.round(working ? Math.sin(time * 5) * 22 : 0), FLOOR + 30);
  else if (working) {
    // A sponge circling where it scrubs, suds behind it.
    const sx = Math.round(CX - 10 + Math.cos(time * 6) * 16);
    const sy = Math.round(area.y + 28 + Math.sin(time * 6) * 10);
    for (let k = 0; k < 4; k++) p.oval("#f3f6f1", sx - 8 + k * 5, sy + 6 + (k % 2), 2, 2);
    p.rect(INK, sx - 1, sy - 1, 18, 11);
    p.rect(t.front("#e2c35d"), sx, sy, 16, 5);
    p.rect(t.front("#7f9a72"), sx, sy + 5, 16, 4);
  }
  if (!working && d < 0.05)
    for (let k = 0; k < 4; k++) {
      // Clean: a glint or two.
      const gx = area.x + 8 + k * 14;
      const gy = area.y + 10 + (k % 2) * 16;
      p.rect("#fffbe8", gx, gy - 2, 1, 5);
      p.rect("#fffbe8", gx - 2, gy, 5, 1);
    }
  if (working) gauge(p, CX, H - 22, 70, cursor, 0.28);
}

function mop(p: Painter, t: Tone, x: number, base: number) {
  p.line(ink(t), x - 1, base - 6, x + 26, base - 78);
  p.line(t.front("#c9a27a"), x, base - 6, x + 27, base - 78);
  p.line(t.front("#c9a27a"), x + 1, base - 6, x + 28, base - 78);
  p.rect(ink(t), x - 12, base - 8, 26, 4);
  for (let i = 0; i < 12; i++) p.rect(t.front(i % 2 ? "#e8e2d2" : "#d4cbb8"), x - 11 + i * 2, base - 4, 2, 4 + (i % 3));
}
