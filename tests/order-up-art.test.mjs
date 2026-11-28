import assert from "node:assert/strict";
import test from "node:test";

import { lightAt, shiftHour, PLANNING_HOUR } from "../src/lib/arcade/core/light.ts";
import { PixelBuffer, packColor } from "../src/lib/arcade/core/pixel-buffer.ts";
import { Painter, halfGrid } from "../src/lib/arcade/core/painter.ts";
import { bakeAtlas } from "../src/lib/arcade/core/atlas.ts";
import { project, unproject, faceLight } from "../src/lib/arcade/core/iso.ts";
import { bakeRoom, composeRoom, roomHeight, sunPatches, frontWalls } from "../src/lib/arcade/order-up/art/room/scene.ts";
import { bakeWindow, bakeStreet, useCupSprites } from "../src/lib/arcade/order-up/art/room/front.ts";
import { cupSprite } from "../src/lib/arcade/order-up/art/sprites.ts";

useCupSprites(cupSprite);
import { venueFor, stationProps } from "../src/lib/arcade/order-up/art/room/venues/index.ts";
import { createCast, workSpot, guestRoute, routePoint, habitsOf, usableSeats } from "../src/lib/arcade/order-up/art/room/actors.ts";
import { walkway } from "../src/lib/arcade/order-up/art/room/walkway.ts";
import { lookOf } from "../src/lib/arcade/order-up/art/room/cast-draw.ts";
import { placeDecor, decorKind } from "../src/lib/arcade/order-up/art/room/decor.ts";
import { runBake } from "../src/lib/arcade/order-up/art/room/bake-job.ts";
import { SHOPS, DECOR, BADGES, MACHINES, RECIPES, GUESTS } from "../src/lib/arcade/order-up/content/index.ts";
import { newCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { emptyShop, initialExpansion, normalizeExpansion } from "../src/lib/arcade/order-up/engine/state.ts";
import { moveCounter } from "../src/lib/arcade/order-up/engine/management.ts";
import { command } from "../src/lib/arcade/order-up/engine/commands.ts";

test("light follows the hour, the season and the weather, and is shared per step", () => {
  const noon = lightAt({ hour: 13 });
  const night = lightAt({ hour: 22.5 });
  assert.ok(noon.sun > 0.8 && noon.night === 0, "midday is sunny");
  assert.ok(night.sun === 0 && night.night > 0.9, "late evening is dark");
  assert.equal(lightAt({ hour: 13.01 }), noon, "the same quarter hour is the same light object");
  assert.ok(lightAt({ hour: 13, weather: "rain" }).sun < noon.sun * 0.3, "rain hides the sun");
  assert.ok(lightAt({ hour: 13, weather: "night" }).night > 0.5, "a night event is lit as night");
  assert.ok(lightAt({ hour: 18, season: "winter" }).night > lightAt({ hour: 18, season: "summer" }).night, "winter evenings come sooner");
  const [sx, sy] = lightAt({ hour: 9 }).sunDir;
  assert.ok(Math.abs(Math.hypot(sx, sy) - 1) < 1e-9);
  // Morning sun is in the east (screen right), so right faces catch it; evening lights the left.
  assert.ok(faceLight(lightAt({ hour: 9 })).right > faceLight(lightAt({ hour: 9 })).left);
  assert.ok(faceLight(lightAt({ hour: 17.5 })).left > faceLight(lightAt({ hour: 17.5 })).right);
  assert.notEqual(noon.lit("#b88a70", 1), noon.lit("#b88a70", 0), "a sunlit face differs from a shaded one");
  assert.equal(shiftHour(0), 10);
  assert.equal(shiftHour(1), 21);
  assert.ok(PLANNING_HOUR < 10);
});

test("the pixel buffer fills, clips and blends; the painter fills a diamond by scanline", () => {
  const b = new PixelBuffer(8, 8);
  b.fillStyle = "#ff0000";
  b.fillRect(0, 0, 8, 8);
  assert.equal(b.get(3, 3), packColor("#ff0000"));
  b.clip = { x0: 2, y0: 2, x1: 4, y1: 4 };
  b.fillStyle = "#0000ff";
  b.fillRect(0, 0, 8, 8);
  assert.equal(b.get(0, 0), packColor("#ff0000"), "outside the clip is untouched");
  assert.equal(b.get(2, 2), packColor("#0000ff"));
  b.clip = null;
  b.globalAlpha = 0.5;
  b.fillStyle = "#000000";
  b.fillRect(6, 6, 1, 1);
  assert.equal(b.data[(6 * 8 + 6) * 4], 128, "half black over red is half red");

  const c = new PixelBuffer(48, 24);
  const p = new Painter(c, 48, 24);
  p.poly("#ffffff", [24, 0, 48, 12, 24, 24, 0, 12]);
  let filled = 0;
  for (let i = 0; i < c.words.length; i++) if (c.words[i]) filled++;
  assert.ok(Math.abs(filled - 576) < 30, "a 48 by 24 diamond covers about half its box");
});

test("half a sprite keeps its shape", () => {
  const grid = ["aa..", "aa..", "....", "...."];
  const half = halfGrid(grid);
  assert.equal(half.length, 2);
  assert.equal(half[0].length, 2);
  assert.ok(half.join("").includes("a"), "the filled middle survives");
  assert.deepEqual(halfGrid(["..", ".."]), ["."], "empty stays empty");
});

test("the atlas packs every entry once, inside the image, without overlaps", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ key: "k" + i, w: 10 + (i % 7) * 9, h: 8 + (i % 5) * 11, ax: 0, ay: 0, draw: (p) => p.rect("#123456", 0, 0, 4, 4) }));
  entries.push({ ...entries[0] });
  const { buffer, frames } = bakeAtlas(entries, 128);
  assert.equal(frames.size, 30);
  const boxes = [...frames.values()];
  for (const f of boxes) assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= buffer.width && f.y + f.h <= buffer.height);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, "cells overlap");
    }
  const f = frames.get("k3");
  assert.equal(buffer.get(f.x, f.y), packColor("#123456"), "each entry drew into its own cell");
});

test("iso projection round-trips", () => {
  const g = { ox: 200, oy: 90, hw: 24, hh: 12 };
  const s = project(g, 3.25, 1.5);
  const t = unproject(g, s.x, s.y);
  assert.ok(Math.abs(t.x - 3.25) < 1e-9 && Math.abs(t.y - 1.5) < 1e-9);
});

test("every shop's room bakes at morning, evening and night, opaque, with its counters in the atlas", () => {
  for (const shop of SHOPS) {
    for (const hour of [9, 17.5, 21.5]) {
      const venue = venueFor(shop.id, { cols: shop.layout.width, rows: shop.layout.height, hour: () => hour });
      const props = stationProps(venue, shop.layout.counters, shop.id);
      const room = bakeRoom({ venue, light: lightAt({ hour }), outdoor: lightAt({ hour, indoor: false }), width: Math.round(roomHeight(venue) * 1.7), props });
      assert.equal(room.height, roomHeight(venue));
      let clear = 0;
      for (let i = 0; i < room.background.words.length; i++) if (room.background.words[i] >>> 24 !== 255) clear++;
      assert.equal(clear, 0, `${shop.id} at ${hour}: the background has no holes`);
      for (const s of ["brew", "prep", "build", "serve", "stock"]) assert.ok(room.frames.has("station:" + s), `${shop.id} has its ${s} counter`);
      for (const s of room.sprites) assert.ok(room.frames.has(s.key) && Number.isFinite(s.depth), `${shop.id} sprite ${s.key}`);
      const frame = composeRoom(room, venue, [{ sprite: { grid: ["OO", "OO"], palette: { O: "#000000" } }, x: 1, y: 1 }]);
      assert.equal(frame.width, room.width);
    }
  }
});

test("the order window and the street bake for every shop", () => {
  for (const shop of SHOPS) {
    const venue = venueFor(shop.id, { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
    const w = bakeWindow(venue, lightAt({ hour: 13 }), lightAt({ hour: 13, indoor: false }), 180);
    const s = bakeStreet(venue, lightAt({ hour: 19 }), lightAt({ hour: 19, indoor: false }), 260, shop.name, true, RECIPES[0].id);
    assert.ok(w.background.words.every((x) => x >>> 24 === 255), shop.id + " window");
    assert.ok(s.background.words.every((x) => x >>> 24 === 255), shop.id + " street");
    assert.ok(s.door && s.door.x > 0 && s.door.x < 260);
  }
});

test("the worker's bake job returns the same room the page would bake", () => {
  const shop = SHOPS.find((s) => s.id === "truck");
  const job = { shop: "truck", cols: shop.layout.width, rows: shop.layout.height, layout: shop.layout.counters, decor: [], hour: 13, season: "spring", weather: "sun", width: 456 };
  const a = runBake(job);
  const b = runBake(job);
  assert.deepEqual(a.background, b.background, "baking is deterministic");
  assert.equal(a.background.length, a.width * a.height * 4);
  assert.equal(a.atlas.length, a.atlasWidth * a.atlasHeight * 4);
});

test("window sun moves with the hour", () => {
  const shop = SHOPS.find((s) => s.id === "truck");
  const venue = venueFor("truck", { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
  assert.equal(sunPatches(venue, lightAt({ hour: 22 })).length, 0, "no sun patches at night");
  const morning = JSON.stringify(sunPatches(venue, lightAt({ hour: 8.5 })));
  const evening = JSON.stringify(sunPatches(venue, lightAt({ hour: 18 })));
  assert.notEqual(morning, evening);
});

test("the chef walks to the picked counter; guests queue, are served and leave", () => {
  const shop = SHOPS.find((s) => s.id === "corner");
  const venue = venueFor("corner", { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
  const cast = createCast();
  const layout = shop.layout.counters;
  const order = (id, status, sealed) => ({ id, customerId: "g", customerName: "mika", arrivesAt: 0, patience: 50, maxPatience: 60, status, cup: { sealed }, slot: 0 });
  cast.plan(venue, layout, "brew", { day: 1, elapsed: 0, orders: [order("1", "accepted", false)], receipts: [] }, [], true);
  const chef = cast.people.get("chef");
  assert.deepEqual([chef.x, chef.y], workSpot(layout.brew));
  cast.plan(venue, layout, "serve", { day: 1, elapsed: 1, orders: [order("1", "accepted", true)], receipts: [] }, []);
  for (let i = 0; i < 200; i++) cast.step(0.05, venue);
  assert.deepEqual([chef.x, chef.y], workSpot(layout.serve), "the chef reached the serve counter");
  const guest = cast.people.get("g:1");
  assert.deepEqual([guest.x, guest.y], venue.pickup, "a guest whose cup is ready waits at pickup");
  cast.plan(venue, layout, "serve", { day: 1, elapsed: 2, orders: [order("1", "served", true)], receipts: [] }, []);
  for (let i = 0; i < 400; i++) cast.step(0.05, venue);
  assert.equal(cast.people.has("g:1"), false, "a served guest walks out and is gone");
});

test("decor: each piece has a kind; wall pieces hang on a back wall, the rest stand", () => {
  for (const d of DECOR.filter((x) => x.kind === "decor")) assert.ok(decorKind(d.art.motif), d.id);
  const shelf = DECOR.find((d) => d.id === "fern-wall-print");
  const plant = DECOR.find((d) => d.id === "fern-window-plant");
  const { props, wall } = placeDecor(
    [
      { id: shelf.id, x: 3, y: 0, rotation: 0 },
      { id: plant.id, x: 3, y: 3, rotation: 0 },
      { id: shelf.id, x: 3, y: 3, rotation: 0 },
    ],
    DECOR,
    8,
    7,
    () => 12,
  );
  assert.equal(wall.length, 1);
  assert.equal(props.length, 2, "a print away from the walls stands on an easel");
});

test("the generated catalogues are whole and their ids unique", () => {
  assert.equal(DECOR.length, 334);
  assert.equal(new Set(DECOR.map((d) => d.id)).size, DECOR.length);
  const sum = (s) => [...s].reduce((n, c) => n + c.charCodeAt(0), 0);
  assert.ok(DECOR.every((d) => d.art.seed === sum(d.id) && d.art.motif === d.id));
  assert.equal(BADGES.length, 120);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 120);
  assert.ok(MACHINES.every((m) => m.tiers.length === 3 && m.tiers.map((t) => t.name).join() === "enamel,steel,brass"));
});

test("a new guest comes in by the door and up the line from its far end, and pickup follows a moved serve counter where it can", () => {
  const shop = SHOPS.find((s) => s.id === "corner");
  const venue = venueFor("corner", { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
  const cast = createCast();
  const order = (id, sealed) => ({ id, customerId: "g", customerName: "jun", arrivesAt: 0, patience: 50, maxPatience: 60, status: "accepted", cup: { sealed }, slot: 0 });
  cast.plan(venue, shop.layout.counters, "brew", { day: 1, elapsed: 0, orders: [order("1", false)], receipts: [] }, [], false, shop.layout.counters.serve);
  const guest = cast.people.get("g:1");
  assert.deepEqual(guest.via, [...(venue.way ?? []), ...venue.queue.slice(1).reverse()], "comes in by the door and through the back of the line");
  const pickupWith = (serve) => {
    const other = createCast();
    other.plan(venue, { ...shop.layout.counters, serve }, "brew", { day: 1, elapsed: 0, orders: [order("2", true)], receipts: [] }, [], true, shop.layout.counters.serve);
    const ready = other.people.get("g:2");
    return [ready.tx, ready.ty];
  };
  const [sx, sy] = shop.layout.counters.serve;
  // Moved a step along the wall: open floor in front of it, so pickup comes along.
  assert.deepEqual(pickupWith([sx + 1, sy]), [venue.pickup[0] + 1, venue.pickup[1]], "pickup moved with the counter");
  // Moved so the same step beside it would put guests in the counter's way: pickup stays where it was.
  assert.deepEqual(pickupWith([sx - 2, sy + 1]), venue.pickup, "pickup kept clear of the counter");
});

/*
 * Where people walk and stand, against the room as it is drawn: its walls
 * (the back walls and the low front walls' pieces, with the doorway the only
 * way through them), its counters, what stands on its floor and outside.
 * The cast is driven through `createCast().plan/step`, as the room does.
 */
const near = (a, b) => Math.abs(a - b) < 0.05;
const fmt = (p) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;

function roomOf(id, counters) {
  const shop = SHOPS.find((s) => s.id === id);
  const v = venueFor(id, { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
  const layout = counters ?? shop.layout.counters;
  const w = (p) => p.w ?? 1;
  const d = (p) => p.d ?? 1;
  // The low walls along the near edges are thin pieces standing on them; anything else on the floor is in the way.
  const drawn = [...v.props, ...frontWalls(v)];
  const onRight = (p) => w(p) <= 0.3 && d(p) >= 0.5 && near(p.x + w(p), v.cols);
  const onLeft = (p) => d(p) <= 0.3 && w(p) >= 0.5 && near(p.y + d(p), v.rows);
  const box = (key, x0, y0, x1, y1) => ({ key, x0, y0, x1, y1 });
  const pieces = { "front-right": drawn.filter(onRight).map((p) => [p.y, p.y + d(p)]), "front-left": drawn.filter(onLeft).map((p) => [p.x, p.x + w(p)]) };
  const counterBoxes = stationProps(v, layout, id).map((p) => box(p.key, p.x + 0.06, p.y + 0.06, p.x + w(p) - 0.06, p.y + d(p) - 0.06));
  const things = [...drawn.filter((p) => !onRight(p) && !onLeft(p)), ...(v.outside.props ?? [])].filter((p) => !p.flat).map((p) => box(p.key, p.x, p.y, p.x + w(p), p.y + d(p)));
  const edges = [
    { wall: "right", a: [0, 0], b: [v.cols, 0] },
    { wall: "left", a: [0, 0], b: [0, v.rows] },
    { wall: "front-right", a: [v.cols, 0], b: [v.cols, v.rows] },
    { wall: "front-left", a: [0, v.rows], b: [v.cols, v.rows] },
  ];
  // Solid stretches of the four edges: all of them but the doorway's span.
  const solid = [];
  for (const e of edges) {
    const alongX = e.wall === "right" || e.wall === "front-left";
    const len = alongX ? v.cols : v.rows;
    const spans = v.doorway && v.doorway.wall === e.wall ? [[0, v.doorway.from], [v.doorway.to, len]] : [[0, len]];
    for (const [s0, s1] of spans) if (s1 - s0 > 1e-6) solid.push({ wall: e.wall, a: alongX ? [s0, e.a[1]] : [e.a[0], s0], b: alongX ? [s1, e.a[1]] : [e.a[0], s1] });
  }
  return { id, shop, v, layout, pieces, counterBoxes, things, edges, solid };
}

function segDist(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

/**
 * What is wrong with someone at p, or "" if nothing: standing (or passing,
 * with `walking`) too close to a wall for the sprite's width, in a counter
 * or in something standing, inside a venue whose guests stay outside, on
 * the slab's edge where the sprite is drawn halfway down it, or (crew)
 * working outside the room.
 */
function spotProblem(room, p, { walking = false, guest = true, allow = null } = {}) {
  const { v } = room;
  const verb = walking ? "walks" : "stands";
  const wall = walking ? 0.25 : 0.4;
  for (const s of room.solid) if (segDist(p, s.a, s.b) < wall) return `${verb} ${segDist(p, s.a, s.b).toFixed(2)} from the ${s.wall} wall at ${fmt(p)}`;
  const m = walking ? 0.05 : 0.1;
  for (const b of room.counterBoxes) if (p[0] > b.x0 - m && p[0] < b.x1 + m && p[1] > b.y0 - m && p[1] < b.y1 + m) return `${verb} in the ${b.key} counter at ${fmt(p)}`;
  // Nobody walks into furniture but the chair they sit on.
  for (const b of room.things) if (!allow?.has(b.key) && p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1) return `${verb} in ${b.key} at ${fmt(p)}`;
  const inside = p[0] > 0 && p[1] > 0 && p[0] < v.cols && p[1] < v.rows;
  const onSlab = p[0] > -0.6 && p[1] > -0.6 && p[0] < v.cols + 0.6 && p[1] < v.rows + 0.6;
  if (guest && v.doorway === null && onSlab) return `${verb} in or against the ${v.id} at ${fmt(p)}`;
  if (!walking && !inside && onSlab) return `stands on the slab's edge at ${fmt(p)}`;
  if (!guest && !inside) return `works outside the room at ${fmt(p)}`;
  return "";
}

/** What is wrong with a step from a to b: a wall crossed anywhere but the doorway, or a bad point on the way. */
function legProblem(room, a, b, opts = {}) {
  const { v } = room;
  for (const e of room.edges) {
    const fixed = e.wall === "right" || e.wall === "front-left" ? 1 : 0;
    const da = a[fixed] - e.a[fixed],
      db = b[fixed] - e.a[fixed];
    if ((da < 0 && db < 0) || (da > 0 && db > 0) || (da === 0 && db === 0)) continue;
    const cross = a[1 - fixed] + ((b[1 - fixed] - a[1 - fixed]) * da) / (da - db);
    if (cross < 0 || cross > (fixed === 1 ? v.cols : v.rows)) continue;
    // Through the doorway, with room either side for the sprite.
    const door = v.doorway && v.doorway.wall === e.wall && cross >= v.doorway.from + 0.25 && cross <= v.doorway.to - 0.25;
    if (!door) return `crosses the ${e.wall} wall at ${fmt(fixed === 1 ? [cross, e.a[1]] : [e.a[0], cross])}`;
  }
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  for (let i = 0; i <= n; i++) {
    const bad = spotProblem(room, [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], { ...opts, walking: true });
    if (bad) return bad;
  }
  return "";
}

/** The doorway is drawn as an opening: the one gap in the low front walls, or a door (or an airlock) in a back wall. */
function doorwayProblem(room) {
  const { v, pieces } = room;
  const d = v.doorway;
  if (d === undefined) return "has no doorway";
  if (d === null) return "";
  for (const wall of ["front-right", "front-left"]) {
    const len = wall === "front-right" ? v.rows : v.cols;
    for (let s = 0.05; s < len; s += 0.1) {
      const covered = pieces[wall].some(([a, b]) => s > a - 1e-6 && s < b + 1e-6);
      const door = d.wall === wall && s > d.from && s < d.to;
      if (door && covered) return `has a wall across its doorway at ${wall} ${s.toFixed(2)}`;
      if (!door && !covered) return `has an opening in its ${wall} wall at ${s.toFixed(2)} that isn't its doorway`;
    }
  }
  if (d.wall === "left" || d.wall === "right") {
    const spans = (at, width) => at <= d.from + 0.05 && at + width >= d.to - 0.05;
    const cut = v.doors.some((x) => x.wall === d.wall && spans(x.at, x.width ?? 1));
    const open = v.windows.some((x) => x.wall === d.wall && x.sill <= 1 && x.top >= 40 && spans(x.at, x.width));
    const airlock = v.props.some((p) => /door|airlock/.test(p.key) && (d.wall === "right" ? p.y < 0.1 && spans(p.x, p.w ?? 1) : p.x < 0.1 && spans(p.y, p.d ?? 1)));
    if (!cut && !open && !airlock) return `has nothing drawn for its doorway in the ${d.wall} wall at ${d.from}..${d.to}`;
  }
  return "";
}

/**
 * Guests of every habit, by who they are: a student and a sketcher (who sit), someone passing through (who
 * doesn't), a pair of cups (a friend or a child along), a parent and child, a dog walker, a crammer.
 */
const habitual = (want) => GUESTS.map((g) => g.id).find((g) => want(habitsOf({ id: "0", customerId: g, cups: 1, special: null })));
const VISITORS = [
  { customerId: GUESTS.find((g) => g.story[0].prop === "book").id },
  { customerId: habitual((h) => !h.sits && !h.dog) },
  { customerId: GUESTS.find((g) => g.story[0].prop === "pencil").id, cups: 2 },
  { customerId: habitual((h) => h.sits && h.dog) },
  { customerId: GUESTS[7].id, special: "parent", cups: 2 },
  { customerId: habitual((h) => !h.sits && h.dog) },
  { customerId: GUESTS[11].id, special: "crammer" },
  { customerId: GUESTS[13].id, cups: 2 },
];
const guestOrder = (id, status, sealed) => ({ id: String(id), customerName: GUESTS[id % 9].id, arrivesAt: id, patience: 50, maxPatience: 60, status, cup: { sealed }, slot: id % 6, special: null, cups: 1, refills: 0, ...VISITORS[id % VISITORS.length] });

/**
 * Plays a script of changes to the guests at the room's own cadence (a plan every 0.12 s, steps at 60 a
 * second), handing every step anyone but the staff takes to `step`, and the cast after each to `look`.
 */
function play(room, script, step, defaultServe, extra, look = () => {}) {
  const cast = createCast();
  const orders = new Map();
  const last = new Map();
  let t = 0;
  for (const [at, change] of script) {
    while (t < at) {
      cast.plan(room.v, room.layout, "serve", { day: 1, elapsed: t, orders: [...orders.values()], receipts: [] }, [], false, defaultServe, extra);
      for (let k = 0; k < 7; k++) {
        cast.step(1 / 60, room.v);
        t += 1 / 60;
        for (const w of cast.people.values()) {
          if (w.role === "chef" || w.role === "crew") continue;
          if (last.has(w.id)) step(w, last.get(w.id), [w.x, w.y], cast);
          last.set(w.id, [w.x, w.y]);
        }
        look(cast);
      }
    }
    change(orders);
  }
  return cast;
}

/** The furniture a walker may step into: its own seat's (or the one it just got up from), or (a dog, a child, a friend) its guest's. */
function ownPieces(cast, w) {
  const owner = cast.people.get(w.owner);
  return new Set([w, owner].filter(Boolean).flatMap((x) => [...(cast.seatOf(x)?.pieces ?? []), ...(cast.leftOf(x)?.pieces ?? [])]));
}

/** Seats taken at most once, and everyone sitting (or lying) on the seat they hold, or by it. */
function seatProblems(cast) {
  const out = [];
  const held = new Map();
  for (const w of cast.people.values()) {
    if (w.seat < 0) continue;
    if (held.has(w.seat)) out.push(`seat ${cast.seats[w.seat].id} held by ${held.get(w.seat)} and ${w.id}`);
    held.set(w.seat, w.id);
  }
  for (const w of cast.people.values()) {
    if (w.pose === "stand") continue;
    const seat = cast.seatOf(w) ?? cast.seatOf(cast.people.get(w.owner) ?? w);
    const spot = w.role === "dog" ? seat?.dog : seat && [seat.x, seat.y];
    if (!spot || Math.hypot(spot[0] - w.x, spot[1] - w.y) > 0.05) out.push(`${w.id} sits away from a seat at ${fmt([w.x, w.y])}`);
  }
  return out;
}

/** Every problem with where guests, crew and the chef walk and stand in a room, as "what: why at (x, y)" lines. */
function roomProblems(room, { defaultServe, chefWalks = true, extra } = {}) {
  const { v, layout } = room;
  const out = [];
  const add = (what, bad) => bad && out.push(`${room.id} ${what}: ${bad}`);
  add("doorway", doorwayProblem(room));
  const standing = (orders, station = "serve", crew = []) => {
    const cast = createCast();
    cast.plan(v, layout, station, orders && { day: 1, elapsed: 0, orders, receipts: [] }, crew, true, defaultServe, extra);
    return [...cast.people.values()];
  };
  // Waiting: up to two more than the queue has spots, so the line spills over; ready: the rail's six at pickup.
  for (let n = 1; n <= Math.max(6, v.queue.length) + 2; n++)
    for (const w of standing(Array.from({ length: n }, (_, i) => guestOrder(i, "accepted", false)))) if (w.role === "guest") add(`waiting ${w.slot + 1} of ${n}`, spotProblem(room, [w.x, w.y]));
  for (let n = 1; n <= 6; n++)
    for (const w of standing(Array.from({ length: n }, (_, i) => guestOrder(i, "accepted", true)))) if (w.role === "guest") add(`ready ${w.slot + 1} of ${n}`, spotProblem(room, [w.x, w.y]));
  // The chef at each counter with a crew member at every other.
  const stations = Object.keys(layout);
  for (const station of stations) {
    const crew = stations.map((s, i) => ({ id: "c" + i, name: "ada", station: s }));
    for (const w of standing(null, station, crew)) add(`${w.role === "chef" ? "chef at " + station : w.id}`, spotProblem(room, [w.x, w.y], { guest: false }));
  }
  if (chefWalks)
    for (const a of stations)
      for (const b of stations) {
        if (a === b) continue;
        const at = (s) => standing(null, s).find((w) => w.role === "chef");
        const [p, q] = [at(a), at(b)];
        add(`chef walking ${a} to ${b}`, legProblem(room, [p.x, p.y], [q.x, q.y], { guest: false }));
      }
  // Walking: six arrive one after another; cups come ready out of turn, one while its guest is still walking in;
  // some are served, some give up in line, one gives up while walking in; then six ready at once leave in turn.
  const bad = new Set();
  const step = (w, a, b, cast) => {
    const why = legProblem(room, a, b, { allow: ownPieces(cast, w) });
    if (why && !bad.has(w.id)) {
      bad.add(w.id);
      out.push(`${room.id} ${w.id} walking: ${why}`);
    }
  };
  const look = (cast) => {
    for (const why of seatProblems(cast)) if (!bad.has(why)) {
      bad.add(why);
      out.push(`${room.id} ${why}`);
    }
  };
  const set = (i, f) => (orders) => f(orders.get(String(i)));
  const arrive = (i) => (orders) => orders.set(String(i), guestOrder(i, "accepted", false));
  const ready = (i) => set(i, (o) => (o.cup.sealed = true));
  const leave = (i, status) => set(i, (o) => (o.status = status));
  const refill = (i) => set(i, (o) => {
    o.cup.sealed = false;
    o.refills = (o.refills ?? 0) + 1;
  });
  const run = (script) => play(room, script, step, defaultServe, extra, look);
  run([[0, arrive(0)], [0.8, arrive(1)], [1.6, arrive(2)], [2.4, arrive(3)], [3.2, arrive(4)], [4, arrive(5)], [4.4, ready(5)], [9, ready(2)], [12, ready(0)], [15, leave(2, "served")], [15.5, leave(1, "missed")], [18, leave(0, "served")], [18.2, ready(3)], [22, leave(3, "served")], [22.1, leave(4, "missed")], [26, leave(5, "served")], [80, () => {}]]);
  run([[0, (orders) => { for (let i = 0; i < 6; i++) orders.set(String(i), guestOrder(i, "accepted", true)); }], [8, leave(0, "served")], [8.5, leave(3, "served")], [9, leave(1, "served")], [12, leave(2, "missed")], [12.2, leave(4, "served")], [12.4, leave(5, "served")], [70, () => {}]]);
  run([[0, arrive(0)], [0.5, leave(0, "missed")], [0.6, arrive(1)], [1.4, ready(1)], [1.6, arrive(2)], [3, leave(1, "served")], [50, () => {}]]);
  // A crammer stays for refills: sits, fetches each from pickup, goes back to their seat; a guest who sat gets up and leaves.
  run([[0, arrive(6)], [0.5, arrive(2)], [1, arrive(4)], [6, ready(6)], [8, refill(6)], [9, ready(2)], [10, leave(2, "served")], [14, ready(6)], [16, refill(6)], [17, ready(4)], [18, leave(4, "served")], [24, ready(6)], [26, leave(6, "served")], [27, arrive(7)], [28, arrive(3)], [32, ready(7)], [33, leave(7, "served")], [34, ready(3)], [35, leave(3, "served")], [110, () => {}]]);
  // More sitters than seats: the rest take their cups away.
  run([[0, (orders) => { for (const i of [8, 9, 10, 11, 12, 13]) orders.set(String(i), guestOrder(i, "accepted", true)); }], ...[8, 9, 10, 11, 12, 13].map((i, k) => [2 + k * 0.6, leave(i, "served")]), [80, () => {}]]);
  return out;
}

test("every venue: guests come and go only through its doorway, and everyone waits and works on open floor", () => {
  const problems = SHOPS.flatMap((shop) => roomProblems(roomOf(shop.id)));
  assert.deepEqual(problems, [], "\n" + problems.join("\n"));
});

test("every venue's line of counters leaves the doorway and the guests' way clear, and the arranger can't block them", () => {
  for (const shop of SHOPS) {
    const { width, height, blocked, counters } = shop.layout;
    const v = venueFor(shop.id, { cols: width, rows: height, hour: () => 13 });
    const tiles = Object.values(counters).map(([x, y]) => y * width + x);
    assert.equal(new Set(tiles).size, tiles.length, `${shop.id}: one counter a tile`);
    for (const [station, [x, y]] of Object.entries(counters)) {
      assert.ok(x >= 0 && y >= 0 && x < width && y < height, `${shop.id} ${station} is on the floor`);
      assert.ok(!blocked.includes(y * width + x), `${shop.id} ${station} is not on a blocked tile`);
    }
    // Every tile the guests' route passes over (with a sprite's feet either side) is closed to counters.
    const r = guestRoute(v);
    for (let s = 0; s <= r.length; s += 0.02) {
      const [x, y] = routePoint(r, s);
      for (const [tx, ty] of [[x - 0.15, y - 0.15], [x + 0.15, y - 0.15], [x - 0.15, y + 0.15], [x + 0.15, y + 0.15]].map(([a, b]) => [Math.floor(a), Math.floor(b)]))
        if (tx >= 0 && ty >= 0 && tx < width && ty < height) assert.ok(blocked.includes(ty * width + tx), `${shop.id}: tile (${tx}, ${ty}) on the guests' way is blocked`);
    }
    // The arranger refuses the doorway.
    const c = newCampaign("normal");
    c.expansion.activeShop = shop.id;
    c.expansion.shops[shop.id] = emptyShop(shop.id);
    if (v.doorway && v.doorway.wall.startsWith("front")) {
      const along = Math.floor((v.doorway.from + v.doorway.to) / 2);
      const [x, y] = v.doorway.wall === "front-right" ? [width - 1, along] : [along, height - 1];
      assert.equal(moveCounter(c, "brew", x, y), false, `${shop.id}: no counter in the doorway at (${x}, ${y})`);
    }
  }
});

/** The default counters before the shops were laid out in a line: what a save from then still holds. */
const EARLIER_DEFAULTS = {
  corner: { brew: [1, 1], prep: [1, 5], build: [4, 3], serve: [6, 1], stock: [4, 0] },
  campus: { brew: [1, 1], prep: [1, 4], build: [3, 3], serve: [5, 1], stock: [3, 0] },
  garden: { brew: [1, 1], prep: [1, 6], build: [4, 4], serve: [7, 1], stock: [4, 0] },
  night: { brew: [1, 1], prep: [1, 3], build: [3, 2], serve: [4, 1], stock: [3, 0] },
  station: { brew: [1, 1], prep: [1, 4], build: [5, 3], serve: [8, 1], stock: [5, 0] },
  harbor: { brew: [1, 1], prep: [1, 5], build: [4, 3], serve: [7, 1], stock: [4, 0] },
  loft: { brew: [1, 1], prep: [1, 6], build: [4, 4], serve: [6, 1], stock: [4, 0] },
  truck: { brew: [1, 1], prep: [1, 2], build: [3, 2], serve: [4, 2], stock: [3, 0] },
  boardwalk: { brew: [1, 1], prep: [1, 4], build: [4, 3], serve: [6, 1], stock: [4, 0] },
  lodge: { brew: [2, 2], prep: [1, 5], build: [5, 4], serve: [7, 2], stock: [5, 0] },
  commissary: { brew: [1, 1], prep: [1, 6], build: [5, 4], serve: [9, 1], stock: [5, 0] },
  moon: { brew: [2, 1], prep: [1, 4], build: [4, 4], serve: [6, 2], stock: [4, 0] },
};

/** The earlier defaults with brew and prep swapped: a layout someone arranged, so loading keeps it. */
const ARRANGED = Object.fromEntries(
  Object.entries(EARLIER_DEFAULTS).map(([id, l]) => [id, { ...structuredClone(l), brew: [...l.prep], prep: [...l.brew] }]),
);

test("a save that never arranged its counters opens on today's row along the back wall", () => {
  const saved = initialExpansion();
  for (const shop of SHOPS) saved.shops[shop.id] = { ...emptyShop(shop.id), layout: structuredClone(EARLIER_DEFAULTS[shop.id]) };
  const loaded = normalizeExpansion(JSON.parse(JSON.stringify(saved)));
  for (const shop of SHOPS) assert.deepEqual(loaded.shops[shop.id].layout, shop.layout.counters, shop.id);
});

test("a save keeps its own layout, but a counter on the guests' way is moved off it on load, and guests still walk clear", () => {
  const saved = initialExpansion();
  for (const shop of SHOPS) saved.shops[shop.id] = { ...emptyShop(shop.id), layout: structuredClone(ARRANGED[shop.id]) };
  // A counter someone arranged into a doorway, and two on one tile.
  saved.shops.corner.layout.brew = [7, 6];
  saved.shops.campus.layout.prep = [...saved.shops.campus.layout.build];
  const loaded = normalizeExpansion(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.shops.corner.layout.brew, SHOPS.find((s) => s.id === "corner").layout.counters.brew, "the brew counter left the doorway for its own place");
  assert.notDeepEqual(loaded.shops.campus.layout.prep, loaded.shops.campus.layout.build, "two counters on one tile are parted");
  const disturbed = ["corner:brew", "campus:prep", "campus:build"];
  for (const shop of SHOPS) {
    const layout = loaded.shops[shop.id].layout;
    for (const [station, [x, y]] of Object.entries(layout)) {
      const earlier = ARRANGED[shop.id][station];
      if (!shop.layout.blocked.includes(earlier[1] * shop.layout.width + earlier[0]) && !disturbed.includes(shop.id + ":" + station))
        assert.deepEqual([x, y], earlier, `${shop.id} ${station} kept its saved place`);
      assert.ok(!shop.layout.blocked.includes(y * shop.layout.width + x), `${shop.id} ${station} is off the blocked tiles`);
    }
    // Pickup moves with a moved serve counter only where guests can stand and walk to it; crew find a free side.
    const problems = roomProblems(roomOf(shop.id, layout), { defaultServe: shop.layout.counters.serve, chefWalks: false });
    assert.deepEqual(problems, [], "\n" + problems.join("\n"));
  }
});

test("decor set out from the book, or saved on the guests' way, stands clear of the counters, their workers and the guests", () => {
  const pieces = DECOR.filter((d) => d.kind === "decor").slice(0, 6).map((d) => d.id);
  for (const shop of SHOPS) {
    const { width, blocked } = shop.layout;
    const c = newCampaign("normal");
    c.expansion.activeShop = shop.id;
    c.expansion.shops[shop.id] = emptyShop(shop.id);
    c.expansion.decor.push(...pieces);
    for (const id of pieces) assert.equal(command(c, "place-from-book", { id }).ok, true);
    const counters = Object.values(shop.layout.counters);
    const workers = counters.map(([x, y]) => [x, y >= 1 ? y - 1 : 1]);
    const placed = c.expansion.shops[shop.id].decor;
    assert.equal(new Set(placed.map((p) => p.x + "," + p.y)).size, placed.length, `${shop.id}: one piece a tile`);
    for (const p of placed) {
      const at = `${shop.id} ${p.id} at (${p.x}, ${p.y})`;
      assert.ok(!blocked.includes(p.y * width + p.x), at + " is off the guests' way");
      assert.ok(!counters.some(([x, y]) => x === p.x && y === p.y), at + " is off the counters");
      assert.ok(!workers.some(([x, y]) => x === p.x && y === p.y), at + " leaves the workers room");
    }
  }
  // On load: a piece standing in the corner shop's doorway line moves; one hung on the back wall stays.
  const saved = initialExpansion();
  saved.shops.corner.decor = [
    { id: pieces[0], x: 6, y: 4, rotation: 0 },
    { id: pieces[1], x: 3, y: 0, rotation: 0 },
  ];
  const loaded = normalizeExpansion(JSON.parse(JSON.stringify(saved))).shops.corner.decor;
  const corner = SHOPS.find((s) => s.id === "corner").layout;
  assert.ok(!corner.blocked.includes(loaded[0].y * corner.width + loaded[0].x), "the piece on the guests' way moved off it");
  assert.deepEqual([loaded[1].x, loaded[1].y], [3, 0], "the piece on the back wall stayed");
});

test("every venue has seats off the guests' way: not in a doorway, on a counter or a worker's spot, all reachable", () => {
  for (const shop of SHOPS) {
    const room = roomOf(shop.id);
    const { v } = room;
    const seats = v.seats ?? [];
    assert.ok(seats.length >= 2, `${shop.id} has somewhere to sit`);
    assert.equal(new Set(seats.map((s) => s.id)).size, seats.length, `${shop.id}: seat ids are unique`);
    const ways = walkway(v, shop.layout.counters);
    const usable = usableSeats(v, shop.layout.counters, ways);
    const r = guestRoute(v);
    const workers = Object.values(shop.layout.counters).map((at) => workSpot(at));
    for (const seat of seats) {
      const at = `${shop.id} seat ${seat.id} at ${fmt([seat.x, seat.y])}`;
      const p = [seat.x, seat.y];
      const bad = spotProblem(room, p, { allow: new Set(seat.pieces) });
      assert.equal(bad, "", at + ": " + bad);
      let near = Infinity;
      for (let s = 0; s <= r.length; s += 0.02) {
        const q = routePoint(r, s);
        near = Math.min(near, Math.hypot(q[0] - p[0], q[1] - p[1]));
      }
      assert.ok(near >= 0.6, `${at} is ${near.toFixed(2)} from the guests' way`);
      const inside = seat.x > 0 && seat.y > 0 && seat.x < v.cols && seat.y < v.rows;
      if (inside) assert.ok(!shop.layout.blocked.includes(Math.floor(seat.y) * v.cols + Math.floor(seat.x)), at + " is on a blocked tile");
      for (const w of workers) assert.ok(Math.hypot(w[0] - p[0], w[1] - p[1]) >= 0.5, at + " is in a worker's way");
      assert.ok(usable.includes(seat), at + " can be walked to from pickup");
      if (seat.dog) assert.equal(spotProblem(room, seat.dog), "", at + ": its dog's spot");
    }
    // The furniture stays off the guests' way and the counters' tiles too.
    for (const p of [...v.props, ...(v.outside.props ?? [])].filter((p) => p.key.includes("seat:"))) {
      for (let y = Math.floor(p.y); y < Math.ceil(p.y + (p.d ?? 1)); y++)
        for (let x = Math.floor(p.x); x < Math.ceil(p.x + (p.w ?? 1)); x++) {
          if (x < 0 || y < 0 || x >= v.cols || y >= v.rows) continue;
          assert.ok(!shop.layout.blocked.includes(y * v.cols + x), `${shop.id} ${p.key} stands on blocked tile (${x}, ${y})`);
          assert.ok(!Object.values(shop.layout.counters).some(([cx, cy]) => cx === x && cy === y), `${shop.id} ${p.key} stands on a counter's tile`);
        }
    }
  }
});

test("stools set out from the ledger are seats; a save with decor and an earlier layout loads and its guests sit clear", () => {
  const stools = DECOR.filter((d) => d.kind === "decor" && decorKind(d.art.motif) === "low-stool").map((d) => d.id);
  assert.ok(stools.length >= 2);
  const saved = initialExpansion();
  for (const shop of SHOPS) saved.shops[shop.id] = { ...emptyShop(shop.id), layout: structuredClone(EARLIER_DEFAULTS[shop.id]) };
  saved.shops.corner.decor = [
    { id: stools[0], x: 1, y: 3, rotation: 0 },
    { id: stools[1], x: 3, y: 5, rotation: 0 },
  ];
  const loaded = normalizeExpansion(JSON.parse(JSON.stringify(saved)));
  const shop = SHOPS.find((s) => s.id === "corner");
  const placed = placeDecor(loaded.shops.corner.decor, DECOR, shop.layout.width, shop.layout.height, () => 12);
  assert.equal(placed.seats.length, 2, "both stools are seats");
  // The room bakes with them, and guests use them without walking through anything.
  const job = { shop: "corner", cols: shop.layout.width, rows: shop.layout.height, layout: loaded.shops.corner.layout, decor: loaded.shops.corner.decor, hour: 13, season: "spring", weather: "sun", width: 456 };
  assert.ok(runBake(job).background.length > 0);
  const room = roomOf("corner", loaded.shops.corner.layout);
  room.things.push(...placed.props.map((p) => ({ key: p.key, x0: p.x, y0: p.y, x1: p.x + (p.w ?? 1), y1: p.y + (p.d ?? 1) })));
  const problems = roomProblems(room, { defaultServe: shop.layout.counters.serve, chefWalks: false, extra: placed });
  assert.deepEqual(problems, [], "\n" + problems.join("\n"));
  const cast = createCast();
  cast.plan(room.v, room.layout, "serve", { day: 1, elapsed: 0, orders: [], receipts: [] }, [], true, shop.layout.counters.serve, placed);
  assert.ok(placed.seats.every((s) => cast.seats.some((x) => x.id === s.id)), "the stools are among the room's seats");
});

test("a room of sitters, children and dogs at rest asks for no full-rate drawing; their idle looks hold still under Reduce Motion", () => {
  const room = roomOf("corner");
  const orders = [0, 2, 3, 4].map((i) => ({ ...guestOrder(i, "accepted", true) }));
  const cast = createCast();
  // At pickup with their cups, then served.
  cast.plan(room.v, room.layout, "serve", { day: 1, elapsed: 0, orders, receipts: [] }, [], true);
  for (const o of orders) o.status = "served";
  let t = 0;
  let moving = true;
  for (let k = 0; k < 60 * 30 && moving; k++) {
    if (k % 7 === 0) cast.plan(room.v, room.layout, "serve", { day: 1, elapsed: t, orders, receipts: [] }, [], false);
    moving = cast.step(1 / 60, room.v);
    t += 1 / 60;
  }
  const sitting = [...cast.people.values()].filter((w) => w.pose !== "stand");
  assert.ok(sitting.length >= 3, "guests sat down");
  assert.ok([...cast.people.values()].some((w) => w.role === "dog" && w.pose === "lie"), "a dog lies down");
  assert.equal(moving, false, "nobody is walking once everyone has settled");
  for (let k = 0; k < 30; k++) assert.equal(cast.step(1 / 60, room.v), false);
  // Looks change with time (a sip, a wag, swinging feet) unless motion is reduced.
  const looks = (t, reduced) => [...cast.people.values()].map((w) => lookOf(w, cast.frame(w), cast.seatOf(w), cast.people.values(), t, reduced).key).join();
  const times = Array.from({ length: 40 }, (_, i) => i * 0.25);
  assert.ok(new Set(times.map((t) => looks(t, false))).size > 1, "idle movements play");
  assert.equal(new Set(times.map((t) => looks(t, true))).size, 1, "and hold still under Reduce Motion");
});
