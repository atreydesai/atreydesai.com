/**
 * The Tea Truck: a step van parked at the edge of a park. Its floor rides a
 * chassis above the asphalt, cream body with a terracotta band, stainless
 * inside, a hatch on the near side with a striped awning and the queue on
 * the kerb under it, string lights to the nearest tree.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { checker, panels, ground as groundSurface } from "../surfaces.ts";
import type { Venue, PropSpec } from "../types.ts";
import { cafeTable } from "../seating.ts";
import { menuBoard, shelf, hood, rail } from "../walls.ts";
import { treeProp, aFrameProp, fridgeProp, lampPostProp, spriteProp, INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import type { FrontBox } from "../types.ts";

const BODY = "#ece0c4";
const BAND = "#b9614c";
const STEEL = "#c4c8c6";

const asphalt = groundSurface("#58545a", "#615d63", "#77727a", 0.05, 3);
const grass = groundSurface("#7f9a62", "#86a368", "#9bb67a", 0.08, 5);
const path = groundSurface("#c9b89a", "#d2c2a4", "#b5a486", 0.05, 8);

const snow = groundSurface("#e9ecea", "#dfe4e6", "#c9d1d6", 0.05, 6);
const autumn = groundSurface("#9a9a5e", "#a88a52", "#b8683e", 0.1, 5);

function lotGround(cols: number, rows: number) {
  return (x: number, y: number, light?: Light) => {
    const winter = light?.season === "winter" || light?.weather === "snow";
    const fall = light?.season === "autumn";
    const park = winter ? snow : fall ? autumn : grass;
    // Asphalt lot around the truck, a painted bay line, a footpath, then the park.
    if (y > rows + 3.2 && y < rows + 4.6) return winter ? snow.colors[snow.at(x * 24, y * 24)] : path.colors[path.at(x * 24, y * 24)];
    if (y >= rows + 4.6 || x < -5 || y < -4) return park.colors[park.at(x * 24, y * 24)];
    // The lot is ploughed; snow lies in drifts along its edges.
    const edge = Math.min(Math.abs(x + 1.4), Math.abs(y - (rows + 3)), Math.abs(y + 1.6), Math.abs(x - (cols + 3)));
    if (winter && edge < 0.9 + noise(Math.floor(x * 2), Math.floor(y * 2), 41) * 0.6) return snow.colors[snow.at(x * 24, y * 24)];
    if (Math.abs(x - (cols + 2.6)) < 0.06 && y > -2 && y < rows + 3) return "#e8e2cf";
    if (Math.abs(x + 0.9) < 0.06 && y > -2 && y < rows + 3) return "#e8e2cf";
    if (y > rows + 2.95 && y < rows + 3.2) return "#8c8686";
    return asphalt.colors[asphalt.at(x * 24, y * 24)];
  };
}

function farPark(p: Painter, light: Light, width: number, horizon: number) {
  // A far skyline over the park's tree line.
  const city = light.lit("#9aa0aa", 0.2);
  let x = 0;
  for (let i = 0; x < width; i++) {
    const w = 10 + Math.floor(noise(i, 1, 4) * 16);
    const h = 10 + Math.floor(noise(i, 2, 4) * 22);
    p.rect(city, x, horizon - h - 6, w, h + 6);
    if (light.night > 0.4)
      for (let wy = horizon - h - 3; wy < horizon - 4; wy += 4)
        for (let wx = x + 2; wx < x + w - 2; wx += 3) if (noise(wx, wy, 6) < 0.3) p.rect("#efc77a", wx, wy, 1, 2);
    x += w + 1;
  }
  const trees = light.lit(light.season === "winter" ? "#8d9a98" : light.season === "autumn" ? "#9a7a4e" : "#5f7b55", 0.3);
  for (let tx = -6; tx < width + 6; tx += 7) {
    const r = 5 + Math.floor(noise(tx, 0, 9) * 4);
    p.oval(trees, tx, horizon - 2, r, r - 1);
  }
  p.rect(trees, 0, horizon - 2, width, 4);
}

function view(u: number, v: number, light: Light) {
  const [s0, s1, s2] = light.sky;
  // Tree crowns low in the glass, sky above.
  const crown = 0.42 + Math.sin(u / 7) * 0.08 + noise(Math.floor(u / 3), 0, 2) * 0.05;
  if (v < crown) {
    const leaf = light.season === "winter" ? ["#c9d0d0", "#8d9a98"] : light.season === "autumn" ? ["#c9924a", "#9c5e3a"] : ["#7d9a6a", "#5f7b55"];
    return light.lit(noise(Math.floor(u / 2), Math.floor(v * 20), 3) > 0.7 ? leaf[0] : leaf[1], 0.6);
  }
  return v < 0.7 ? s2 : v < 0.88 ? s1 : s0;
}

/** The cab, parked against the body's far end. */
function cabProp(cols: number, rows: number): PropSpec {
  return {
    key: "out:cab",
    x: cols + 0.02,
    y: 0.6,
    w: 1.6,
    d: rows - 1.2,
    height: 56,
    pad: 6,
    draw(p, g, light) {
      const d = rows - 1.2;
      const f = faceLight(light, 1);
      isoBox(p, g, light, 0, 0, 1.5, d, 28, { top: BODY, left: BODY, right: mixHex(BODY, INK, 0.2) });
      isoBox(p, g, light, 0, 0, 0.85, d, 22, { top: mixHex(BODY, "#ffffff", 0.2), left: BODY, right: mixHex(BODY, INK, 0.2) }, 28);
      // Windscreen across the cab's face, slanted back.
      const a = project(g, 1.5, 0.3, 30);
      const b = project(g, 1.5, d - 0.3, 30);
      const c = project(g, 0.9, d - 0.3, 46);
      const e = project(g, 0.9, 0.3, 46);
      p.poly(light.lit("#3f5560", 0.1), [a.x, a.y, b.x, b.y, c.x, c.y, e.x, e.y]);
      p.line(light.lit("#a8c4cc", 0.6), a.x + 3, a.y - 3, e.x + 3, e.y - 1);
      // Band, grille, headlamps, bumper.
      const band = project(g, 1.5, 0, 16);
      const bandEnd = project(g, 1.5, d, 16);
      p.line(light.lit(BAND, f.right), band.x, band.y, bandEnd.x, bandEnd.y);
      p.line(light.lit(BAND, f.right), band.x, band.y + 1, bandEnd.x, bandEnd.y + 1);
      const gr = project(g, 1.5, d / 2 - 0.6, 6);
      const gr2 = project(g, 1.5, d / 2 + 0.6, 6);
      for (let k = 0; k < 4; k++) p.line(light.lit("#4a4448", 0), gr.x, gr.y - k * 2, gr2.x, gr2.y - k * 2);
      for (const yy of [0.35, d - 0.35]) {
        const h = project(g, 1.5, yy, 12);
        p.rect(light.night > 0.3 ? "#fff0c0" : light.lit("#f3ecd6", 0.6), h.x - 1, h.y - 2, 3, 3);
      }
      const bump = project(g, 1.52, 0, 2);
      const bump2 = project(g, 1.52, d, 2);
      p.line(light.lit("#7c7f82", 0.5), bump.x, bump.y, bump2.x, bump2.y);
      p.line(light.lit("#55585b", 0), bump.x, bump.y + 1, bump2.x, bump2.y + 1);
      // The near wheel and the cab door's window.
      const w = project(g, 0.8, d, 0);
      p.oval(light.lit("#2a2628", 0), w.x, w.y - 5, 6, 6);
      p.oval(light.lit("#8b8e90", 0.4), w.x, w.y - 5, 2, 2);
      const dw = project(g, 0.15, d, 44);
      const dw2 = project(g, 0.75, d, 44);
      p.poly(light.lit("#3f5560", 0.1), [dw.x, dw.y, dw2.x, dw2.y, dw2.x, dw2.y + 10, dw.x, dw.y + 10]);
    },
  };
}

/** Wheels under the body's near side, on the ground. */
function wheels(cols: number, rows: number): PropSpec[] {
  return [0.9, cols - 1.2].map((x, i) => ({
    key: "out:wheel" + i,
    x,
    y: rows + 0.02,
    height: 16,
    shadow: "none" as const,
    draw(p, g, light) {
      const c = project(g, 0.5, 0, 0);
      p.alpha(0.35, () => p.oval(INK, c.x + 2, c.y, 10, 3));
      p.oval(light.lit("#262224", 0), c.x, c.y - 7, 8, 8);
      p.oval(light.lit("#3a3537", 0.2), c.x, c.y - 7, 6, 6);
      p.oval(light.lit("#9a9da0", faceLight(light, 1).left), c.x, c.y - 7, 3, 3);
      p.rect(light.lit("#cfd2d4", 0.6), c.x - 1, c.y - 9, 2, 1);
    },
  }));
}

/** The hatch's striped awning, hung out over the kerb. */
function awning(cols: number, rows: number) {
  return (p: Painter, g: Parameters<NonNullable<Venue["overhead"]>>[1], light: Light) => {
    const x0 = 1.6,
      x1 = 4.4;
    const back = (x: number) => project(g, x, rows, 58);
    const front = (x: number) => project(g, x, rows + 0.85, 46);
    const f = faceLight(light, 1);
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const a = x0 + ((x1 - x0) * i) / stripes;
      const b = x0 + ((x1 - x0) * (i + 1)) / stripes;
      const A = back(a),
        B = back(b),
        C = front(b),
        D = front(a);
      p.poly(light.lit(i % 2 ? "#f1e4c8" : BAND, f.top * 0.8), [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
    }
    const D0 = front(x0),
      D1 = front(x1);
    // Scalloped valance.
    for (let k = 0; k < 13; k++) {
      const t = k / 13;
      const x = D0.x + (D1.x - D0.x) * t;
      const y = D0.y + (D1.y - D0.y) * t;
      p.rect(light.lit(k % 2 ? "#f1e4c8" : BAND, f.left), x, y, 4, 3);
    }
    p.line(light.lit(INK, 0), D0.x, D0.y, D1.x, D1.y);
    // Struts down to the body.
    for (const x of [x0 + 0.1, x1 - 0.1]) {
      const s = front(x);
      const w = project(g, x, rows, 40);
      p.line(light.lit("#55585b", 0.2), s.x, s.y + 2, w.x, w.y);
    }
    // Bulbs from the awning to the tree by the picnic table.
    const from = front(x0);
    const to = project({ ...g, oy: g.oy + 20 }, -0.9, rows + 2.6, 50);
    const on = light.night > 0.15;
    let px = from.x,
      py = from.y;
    const n = 12;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * 10;
      p.line(light.lit("#3a2c2c", 0), px, py, x, y);
      px = x;
      py = y;
      if (i < n) {
        p.rect(on ? ["#ffe08a", "#ffb38a", "#c9e6a0"][i % 3] : light.lit("#d9c9a4", 0.3), x, y + 1, 2, 2);
        if (on) p.alpha(0.3 * light.night, () => p.rect("#ffe08a", x - 1, y, 4, 4));
      }
    }
  };
}

/** The truck from the kerb: its long side, hatch up, the awning out, the cab at the front. */
function truckSide(p: Painter, light: Light, box: FrontBox) {
  const lit = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const ground = box.ground;
  const x0 = box.x - 6;
  const bodyW = Math.round(box.w * 0.78);
  const top = ground - 92;
  const bottom = ground - 12;
  const wheels = [x0 + 28, x0 + bodyW - 28, x0 + bodyW + 24];
  // Shadow under the chassis, longer when the sun is low.
  p.alpha(0.35, () => p.rect(INK, x0 + 2, ground - 2, bodyW + 48, 4));
  // Body, down to the skirt, with the wheel arches cut dark.
  p.rect(lit(INK, 0), x0 - 1, top - 1, bodyW + 2, bottom - top + 2);
  p.rect(lit(BODY, 0.6), x0, top, bodyW, bottom - top);
  p.rect(lit(mixHex(BODY, "#ffffff", 0.25), 0.8), x0, top, bodyW, 2);
  p.rect(lit(mixHex(BODY, INK, 0.12), 0.4), x0, bottom - 8, bodyW, 8);
  // The hatch: open with the inside lit, or shuttered.
  const hx = x0 + 10,
    hw = bodyW - 48,
    hy = top + 14,
    hh = 28;
  p.rect(lit(INK, 0), hx - 1, hy - 1, hw + 2, hh + 2);
  if (box.open) {
    p.rect(light.night > 0.4 ? "#e9c98c" : lit("#c9ccc8", 0.3), hx, hy, hw, hh);
    for (let i = 0; i < 3; i++) p.rect(lit("#8a8e90", 0.3), hx + 6 + i * 22, hy + 5, 14, 2);
    p.rect(lit("#b4b8b6", 0.5), hx, hy + hh - 6, hw, 6);
    p.rect(lit("#d9dcdb", 0.8), hx - 3, hy + hh, hw + 6, 3);
    for (let x = hx - 6; x < hx + hw + 6; x++) {
      const on = Math.floor((x - hx) / 6) % 2;
      const stripe = on ? "#f1e4c8" : BAND;
      p.rect(lit(stripe, 0.7), x, hy - 10, 1, 8);
      p.rect(lit(mixHex(stripe, INK, 0.2), 0.3), x, hy - 2, 1, on ? 2 : 3);
    }
  } else {
    p.rect(lit("#a7acaa", 0.4), hx, hy, hw, hh);
    for (let y = hy + 3; y < hy + hh; y += 4) p.rect(lit("#7f8382", 0.2), hx, y, hw, 1);
  }
  // The band and the name under the hatch.
  p.rect(lit(BAND, 0.6), x0, hy + hh + 7, bodyW, 4);
  const name = "TEA TRUCK";
  bigWord(p, name, lit("#8a3f32", 0.5), x0 + Math.round((bodyW - bigWidth(name)) / 2), hy + hh + 14);
  // A menu board by the hatch.
  const mx = hx + hw + 7;
  p.rect(lit(INK, 0), mx, hy, 22, 30);
  p.rect(lit("#2f3b37", 0.2), mx + 1, hy + 1, 20, 28);
  word(p, "TEA", lit("#efe4cc", 0.4), mx + 5, hy + 4);
  for (let i = 0; i < 4; i++) p.rect(lit(["#e8b48a", "#a9c98c", "#c3a0cf", "#f2d58a"][i], 0.3), mx + 4, hy + 12 + i * 4, 10, 1);
  // The cab at the front, on the right.
  const cx = x0 + bodyW;
  const cw = 46;
  const ct = top + 26;
  p.rect(lit(INK, 0), cx - 1, ct - 1, cw + 1, bottom - ct + 2);
  p.rect(lit(BODY, 0.6), cx, ct, cw - 1, bottom - ct);
  p.poly(lit("#3f5560", 0.2), [cx + 4, ct + 5, cx + 26, ct + 5, cx + 40, ct + 24, cx + 4, ct + 24]);
  p.line(lit("#a8c4cc", 0.7), cx + 8, ct + 7, cx + 15, ct + 7);
  p.rect(lit(BAND, 0.6), cx, hy + hh + 7, cw - 1, 4);
  p.rect(light.night > 0.3 ? "#fff0c0" : lit("#f3ecd6", 0.8), cx + cw - 6, bottom - 18, 4, 3);
  p.rect(lit("#7c7f82", 0.6), cx + cw - 5, bottom - 4, 7, 3);
  // Wheels in their arches.
  for (const wx of wheels) {
    p.oval(lit(mixHex(BODY, INK, 0.55), 0), wx, bottom - 2, 12, 10);
    p.oval(lit("#262224", 0), wx, ground - 9, 9, 9);
    p.oval(lit("#3a3537", 0.2), wx, ground - 9, 6, 6);
    p.oval(lit("#9a9da0", 0.6), wx, ground - 9, 3, 3);
    p.rect(lit("#cfd2d4", 0.8), wx - 1, ground - 11, 2, 1);
  }
  // String lights from the awning back to a pole.
  if (box.open) {
    const on = light.night > 0.15;
    p.rect(lit("#3e3a3f", 0.2), x0 - 46, hy - 14, 2, ground - hy + 14);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = hx - 6 - Math.round(t * 38);
      const y = hy - 9 + Math.round(Math.sin(t * Math.PI) * 6) - Math.round(t * 4);
      p.rect(lit("#3a2c2c", 0), x, y, 4, 1);
      if (i % 2 === 0) {
        p.rect(on ? ["#ffe08a", "#ffb38a", "#c9e6a0"][i % 3] : lit("#d9c9a4", 0.4), x, y + 1, 2, 2);
        if (on) p.alpha(0.3 * light.night, () => p.rect("#ffe08a", x - 1, y, 4, 4));
      }
    }
  }
}

export function truckVenue(cols: number, rows: number, hour: () => number): Venue {
  // Under the tree by the lot, a table with seats round it.
  const sit = cafeTable("truck-picnic", -1.4, rows + 1.5, ["-x", "-y", "+x"], { wood: "#a8774f", seat: "#a8774f", top: "#b88a5c" }, { outside: true, share: 1 });
  void hour;
  return {
    id: "truck",
    cols,
    rows,
    floor: checker("#a9adab", "#9ea2a0", "#8a8e8c", 6),
    wall: panels(STEEL, mixHex(STEEL, "#ffffff", 0.08), "#9a9e9c", "#7f8382", 22, 26),
    wainscot: { surface: panels("#b2b6b4", "#aeb2b0", "#8f9391", "#7f8382", 22, 30), height: 20, rail: "#8a8e90" },
    cap: BODY,
    slab: BODY,
    slabHeight: 20,
    wallHeight: 72,
    windows: [
      { wall: "right", at: 2.2, width: 2.2, sill: 30, top: 54, bars: 1, frame: "#6f7476" },
      { wall: "left", at: 1.4, width: 1.2, sill: 34, top: 52, frame: "#6f7476" },
    ],
    doors: [{ wall: "left", at: 3.4, width: 1, height: 58, color: "#9aa09e", glass: true }],
    lamps: [
      { kind: "tube", x: 2.6, y: 0.25, z: 66, reach: 2.8 },
      { kind: "tube", x: 0.25, y: 2.6, z: 66, reach: 2.8 },
    ],
    wallItems: [
      hood("right", 0.3, 50, 34),
      shelf("right", 4.7, 40, 26, ["cups", "cups", "tin"], "#8a8e90"),
      rail("right", 0.5, 30, 28),
      shelf("left", 0.3, 40, 22, ["jar", "jar", "tin"], "#8a8e90"),
      menuBoard("left", 2.9, 62, { w: 30, h: 8, title: "TEA", board: "#3a3f3c", frame: "#8a8e90" }),
    ],
    props: [fridgeProp("prop:fridge", 0, 0, "#d4d8d6", 0.3), spriteProp("prop:ext", "extinguisher", 5, 0, 10)],
    counter: { top: "#d9dcdb", front: "#b4b8b6", side: "#9da19f", trim: "#c9cccb", panel: "steel", height: 16 },
    outside: {
      ground: lotGround(cols, rows),
      far: farPark,
      view,
      props: [
        ...sit.props,
        cabProp(cols, rows),
        ...wheels(cols, rows),
        treeProp("out:tree1", -1.6, rows + 2.2, "#6f8f5c", 3, 66),
        treeProp("out:tree2", cols + 1.2, -2.8, "#5f8455", 7, 62),
        treeProp("out:tree3", -2.2, -0.6, "#6a8a58", 11, 60),
        aFrameProp("out:aframe", 1.2, rows + 1.6, "TEA"),
        lampPostProp("out:lamp", -0.9, rows - 0.4),
      ],
    },
    front: { height: 18, color: BODY, cap: mixHex(BODY, "#ffffff", 0.2), stripe: [BAND, 4, 8], gapsLeft: [2, 3] },
    // Guests never board: they line up on the lot under the hatch and take their cup through it.
    seats: sit.seats,
    doorway: null,
    entry: [cols + 3.5, rows + 4.3],
    queue: [
      [3.5, rows + 0.95],
      [3.8, rows + 1.7],
      [4.15, rows + 2.4],
      [4.6, rows + 3.05],
      [5.15, rows + 3.6],
      [5.8, rows + 4.1],
    ],
    pickup: [2.5, rows + 0.95],
    out: [
      [2.6, rows + 2.3],
      [5.0, rows + 4.6],
    ],
    overhead: awning(cols, rows),
    facade: {
      wall: panels(BODY, BODY, BODY, BODY),
      trim: BAND,
      sign: { board: BAND, ink: "#f1e4c8" },
      door: BODY,
      neighbours: "none",
      queueAt: 0.32,
      paint: truckSide,
    },
    indoorSun: 0.5,
    backHook(p, g, light) {
      // The truck's name painted on the body's skirt under the hatch.
      const at = project(g, 1.7, rows, -8);
      word(p, "TEA TRUCK", light.lit("#8a3f32", 0.3), at.x, at.y - 1, 0.5);
    },
  };
}
