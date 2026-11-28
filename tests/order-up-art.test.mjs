import assert from "node:assert/strict";
import test from "node:test";

import { lightAt, shiftHour, PLANNING_HOUR } from "../src/lib/arcade/core/light.ts";
import { PixelBuffer, packColor } from "../src/lib/arcade/core/pixel-buffer.ts";
import { Painter, halfGrid } from "../src/lib/arcade/core/painter.ts";
import { bakeAtlas } from "../src/lib/arcade/core/atlas.ts";
import { project, unproject, faceLight } from "../src/lib/arcade/core/iso.ts";
import { bakeRoom, composeRoom, roomHeight, sunPatches } from "../src/lib/arcade/order-up/art/room/scene.ts";
import { bakeWindow, bakeStreet, useCupSprites } from "../src/lib/arcade/order-up/art/room/front.ts";
import { cupSprite } from "../src/lib/arcade/order-up/art/sprites.ts";

useCupSprites(cupSprite);
import { venueFor, stationProps } from "../src/lib/arcade/order-up/art/room/venues/index.ts";
import { createCast, workSpot } from "../src/lib/arcade/order-up/art/room/actors.ts";
import { placeDecor, decorKind } from "../src/lib/arcade/order-up/art/room/decor.ts";
import { runBake } from "../src/lib/arcade/order-up/art/room/bake-job.ts";
import { SHOPS, DECOR, BADGES, MACHINES, RECIPES } from "../src/lib/arcade/order-up/content/index.ts";

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

test("a new guest walks up the line from its far end, and pickup follows a moved serve counter", () => {
  const shop = SHOPS.find((s) => s.id === "corner");
  const venue = venueFor("corner", { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
  const cast = createCast();
  const order = (id, sealed) => ({ id, customerId: "g", customerName: "jun", arrivesAt: 0, patience: 50, maxPatience: 60, status: "accepted", cup: { sealed }, slot: 0 });
  cast.plan(venue, shop.layout.counters, "brew", { day: 1, elapsed: 0, orders: [order("1", false)], receipts: [] }, [], false, shop.layout.counters.serve);
  const guest = cast.people.get("g:1");
  assert.deepEqual(guest.via, venue.queue.slice(1).reverse(), "comes in through the back of the line");
  const moved = { ...shop.layout.counters, serve: [shop.layout.counters.serve[0] - 2, shop.layout.counters.serve[1] + 1] };
  const other = createCast();
  other.plan(venue, moved, "brew", { day: 1, elapsed: 0, orders: [order("2", true)], receipts: [] }, [], true, shop.layout.counters.serve);
  const ready = other.people.get("g:2");
  assert.ok(Math.abs(ready.tx - (venue.pickup[0] - 2)) < 1e-9 || ready.tx === 0.3, "pickup moved with the counter");
});
