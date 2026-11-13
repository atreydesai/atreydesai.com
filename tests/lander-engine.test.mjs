import assert from "node:assert/strict";
import test from "node:test";

import {
  BURN,
  FEATHER_BONUS,
  FEATHER_VY,
  FOOT_DROP,
  FOOT_SPAN,
  GRAVITY,
  HULL,
  MAX_FUEL,
  PAD_APRON,
  PERIOD,
  SAFE_TILT,
  SAFE_VX,
  SAFE_VY,
  SITE_NAMES,
  TERRAINS,
  THRUST,
  createRng,
  groundAt,
  highestGround,
  judgeTouchdown,
  landingScore,
  makeSite,
  newShip,
  padUnder,
  siteMultiplier,
  startAltitude,
  stepShip,
  terrainFor,
  windAt,
  zoomForClearance,
} from "../src/lib/arcade/lander-engine.js";

const H = 1 / 120;
const IDLE = { left: false, right: false, thrust: false };
const SEEDS = [1, 7, 42, 1234, 99999, 31337];
/** Many runs, for the properties every site must keep. */
const MANY = Array.from({ length: 40 }, (_, i) => 11 + i * 7919);

/** Runs a ship for some seconds, high above everything, with fixed controls. */
function fly(ship, controls, site, seconds) {
  for (let step = 0; step < Math.round(seconds / H); step++) {
    stepShip(ship, controls, site, step * H, H);
  }
}

/** A ship far above the terrain, so nothing it does in a few seconds lands. */
function highShip(site) {
  return { ...newShip(site, 600), x: 300, y: 5000, vx: 0, vy: 0 };
}

/** Every terrain at a spread of site numbers, across many runs. */
function* everySite(seeds = MANY, sites = [1, 2, 4, 7, 11, 16]) {
  for (const terrain of TERRAINS) {
    for (const seed of seeds) {
      for (const n of sites) yield makeSite(n, seed, terrain);
    }
  }
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * A simple autopilot, flying with the same three keys a player has. It
 * glides toward the coaster above the ground ahead, settles over it, comes
 * down braking late, and stands upright just before its low foot lands.
 * Thrust is pulsed against the engine's own throttle lag. It goes the short
 * way round the moon, or with `way` set, that way (+1 east, -1 west).
 */
function autopilot(site, pad, viewHeight, startX, way = 0) {
  const ship = newShip(site, viewHeight);
  if (startX !== undefined) ship.x = startX;
  let target = pad.cx - ship.x - Math.round((pad.cx - ship.x) / PERIOD) * PERIOD;
  if (way && Math.sign(target) !== way) target += way * PERIOD;
  target += ship.x;
  let clear = 0;
  let descending = false;
  for (let step = 0; step < 120 * 120; step++) {
    const time = step * H;
    const dx = target - ship.x;
    if (step % 12 === 0) {
      const reach = Math.sign(dx) * Math.min(Math.abs(dx) + 30, 220);
      clear = highestGround(site, ship.x - Math.sign(dx) * 30, ship.x + reach) + FOOT_DROP + 26;
    }
    const height = ship.y - FOOT_DROP - pad.y;
    const vxWant = Math.sign(dx) * Math.min(75, Math.sqrt(16 * Math.abs(dx)), 1.2 * Math.abs(dx));
    if (!descending && Math.abs(dx) < 2.5 && Math.abs(ship.vx) < 1.5) descending = true;
    let vyWant;
    let holding = false;
    if (descending) {
      // Hold still if the wind has pushed the ship off the coaster.
      holding = Math.abs(dx) > 4 && height > 10;
      vyWant = holding ? 0 : height < 8 ? -9 : -Math.min(45, Math.sqrt(12 * (height - 8)) + 9);
    } else {
      const want = Math.max(clear, pad.y + FOOT_DROP + 10 + 0.35 * Math.abs(dx));
      vyWant = want > ship.y ? Math.min(14, (want - ship.y) * 0.8) : -Math.min(45, Math.sqrt(12 * (ship.y - want)));
    }
    const ax = (vxWant - ship.vx) * 1.2 - windAt(site, time);
    const ay = Math.max(0, (vyWant - ship.vy) * 2 + GRAVITY);

    // High up it may lean far over to brake; low down it leans into the
    // wind, then stands up before the lower foot lands.
    const roomy = ship.y - groundAt(site, ship.x) > 70;
    const soon = height / Math.max(3, -ship.vy);
    const low = ship.y - pad.y - FOOT_DROP * Math.cos(ship.angle) - FOOT_SPAN * Math.abs(Math.sin(ship.angle));
    const standUp = Math.max(0, Math.abs(ship.angle) - 0.17) / 2.2 + 0.1;
    let limit = roomy ? 1.3 : 1;
    if (descending && !holding) {
      if (soon < 0.55 || low / Math.max(2, -ship.vy) < standUp + 0.15) limit = 0.17;
      else limit = soon < 1 ? 0.45 : Math.min(limit, 0.75);
    }
    const angleWant = clamp(Math.atan2(ax, Math.max(ay, 2)), -limit, limit);
    const sin = Math.sin(ship.angle);
    const sideways = Math.abs(sin) > 0.05 && Math.sign(sin) === Math.sign(ax) ? ax / sin : 0;
    const along = ax * sin + ay * Math.cos(ship.angle);
    const throttleWant = clamp(Math.max(along, roomy || limit < 0.2 ? 0 : sideways) / THRUST, 0, 1);
    const lead = ship.angle + ship.spin * 0.1;
    const controls = {
      left: lead > angleWant + 0.015,
      right: lead < angleWant - 0.015,
      thrust: ship.throttle < throttleWant,
    };
    const result = stepShip(ship, controls, site, time, H);
    if (result) return { result, ship };
  }
  return { result: null, ship };
}

// --- The route ----------------------------------------------------------------

test("a run starts on the mare and never repeats a terrain twice in a row", () => {
  for (let seed = 0; seed < 300; seed++) {
    assert.equal(terrainFor(1, seed), "mare");
    // The first six sites visit every kind of ground once.
    assert.deepEqual(
      Array.from({ length: 6 }, (_, i) => terrainFor(i + 1, seed)).sort(),
      [...TERRAINS].sort(),
    );
    for (let n = 1; n < 40; n++) assert.notEqual(terrainFor(n, seed), terrainFor(n + 1, seed), `seed ${seed} site ${n}`);
  }
  for (const seed of SEEDS) {
    for (let n = 1; n <= 14; n++) {
      const site = makeSite(n, seed);
      assert.equal(site.terrain, terrainFor(n, seed));
      if (n > 1) assert.notEqual(site.terrain, makeSite(n - 1, seed).terrain);
    }
  }
  // Runs differ from each other.
  const routes = new Set(SEEDS.map((seed) => Array.from({ length: 6 }, (_, i) => terrainFor(i + 1, seed)).join()));
  assert.ok(routes.size > 1);
});

test("a seed always builds the same site, and seeds differ", () => {
  assert.deepEqual(makeSite(3, 42), makeSite(3, 42));
  assert.notDeepEqual(makeSite(3, 42).points, makeSite(3, 43).points);
  assert.notDeepEqual(makeSite(3, 42, "mesas").points, makeSite(4, 42, "mesas").points);
  assert.notEqual(makeSite(3, 42).seed, makeSite(4, 42).seed);
  const random = createRng(5);
  const again = createRng(5);
  for (let i = 0; i < 20; i++) {
    const value = random();
    assert.equal(value, again());
    assert.ok(value >= 0 && value < 1);
  }
});

test("sites are named for their terrain, taking the next name on a revisit", () => {
  for (const seed of SEEDS) assert.equal(makeSite(1, seed).name, "sea of tapioca");
  for (const terrain of TERRAINS) {
    assert.equal(makeSite(2, 9, terrain).terrain, terrain);
    assert.ok(SITE_NAMES[terrain].includes(makeSite(2, 9, terrain).name));
  }
  for (const seed of SEEDS) {
    /** @type {Record<string, number>} */
    const visits = {};
    for (let n = 1; n <= 20; n++) {
      const site = makeSite(n, seed);
      const names = SITE_NAMES[site.terrain];
      const visit = visits[site.terrain] ?? 0;
      assert.equal(site.name, names[visit % names.length]);
      visits[site.terrain] = visit + 1;
    }
  }
});

// --- Every site's ground --------------------------------------------------

test("every site has four flat, separate coasters inside the period", () => {
  for (const site of everySite()) {
    assert.equal(site.pads.length, 4);
    const multipliers = site.pads.map((pad) => pad.multiplier).sort((a, b) => a - b);
    assert.deepEqual(multipliers, site.n <= 3 ? [2, 2, 3, 5] : [2, 3, 5, 5]);
    for (const pad of site.pads) {
      for (let k = 0; k <= 10; k++) {
        const x = pad.cx - pad.width / 2 + (pad.width * k) / 10;
        assert.ok(Math.abs(groundAt(site, x) - pad.y) < 1e-9, `${site.terrain} pad flat at ${x}`);
      }
      assert.equal(padUnder(site, pad.cx - 11, pad.cx + 11), pad);
    }
    const spans = site.pads
      .map((pad) => [pad.cx - pad.width / 2, pad.cx + pad.width / 2])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] > spans[i - 1][1]);
    assert.ok(spans[0][0] > 0 && spans[3][1] < PERIOD);
  }
});

test("every coaster can be reached straight down: nothing beside it stands above it", () => {
  // The hull's half-width, plus a margin, either side of the coaster.
  const half = Math.max(...HULL.map(([x]) => Math.abs(x)));
  const reach = half + 7;
  const lip = 0.5;
  assert.ok(reach <= PAD_APRON);
  for (const site of everySite()) {
    for (const pad of site.pads) {
      for (let x = pad.cx - pad.width / 2 - reach; x <= pad.cx + pad.width / 2 + reach; x += 0.5) {
        const ground = groundAt(site, x);
        assert.ok(
          ground <= pad.y + lip,
          `${site.terrain} n${site.n} seed${site.seed}: ground ${ground.toFixed(1)} beside ×${pad.multiplier} at ${pad.y.toFixed(1)}`,
        );
      }
    }
  }
});

test("every start clears the highest ground with room to spare", () => {
  const lowest = startAltitude(0);
  for (const site of everySite()) {
    const highest = Math.max(...site.points.map(([, y]) => y));
    assert.ok(highest + FOOT_DROP + 30 <= lowest, `${site.terrain}: ground at ${highest.toFixed(1)}`);
    assert.ok(Math.min(...site.points.map(([, y]) => y)) > 0);
  }
});

test("the ground is one unbroken outline, wrapping without a seam", () => {
  for (const site of everySite(MANY.slice(0, 12))) {
    const xs = site.points.map(([x]) => x);
    assert.deepEqual([...xs].sort((a, b) => a - b), xs);
    assert.ok(xs[0] >= 0 && xs[xs.length - 1] < PERIOD);
    assert.ok(site.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
    assert.equal(groundAt(site, 0), groundAt(site, PERIOD));
    assert.ok(Math.abs(groundAt(site, -1e-6) - groundAt(site, 0)) < 1e-3);
    assert.ok(Math.abs(groundAt(site, PERIOD - 1e-6) - groundAt(site, 0)) < 1e-3);
    assert.ok(Math.abs(groundAt(site, -250) - groundAt(site, PERIOD - 250)) < 1e-9);
    assert.ok(Math.abs(groundAt(site, 3 * PERIOD + 17) - groundAt(site, 17)) < 1e-9);
    // Continuous everywhere, cliffs included: no jump between neighbours.
    for (let x = -3; x <= PERIOD + 3; x += 0.37) {
      assert.ok(Math.abs(groundAt(site, x + 1e-6) - groundAt(site, x)) < 1e-3, `${site.terrain} at ${x}`);
    }
  }
});

test("each terrain keeps its own shape", () => {
  /** Steepest rise over a span of `run` units. */
  const steepest = (site, run) => {
    let most = 0;
    for (let x = 0; x < PERIOD; x += 1) most = Math.max(most, Math.abs(groundAt(site, x + run) - groundAt(site, x)) / run);
    return most;
  };
  const relief = (site) => {
    const ys = site.points.map(([, y]) => y);
    return Math.max(...ys) - Math.min(...ys);
  };
  for (const seed of MANY.slice(0, 16)) {
    for (const n of [1, 5, 9]) {
      const mare = makeSite(n, seed, "mare");
      assert.ok(relief(mare) < 80 && steepest(mare, 10) < 0.9, "the mare is low and gentle");

      const highlands = makeSite(n, seed, "highlands");
      assert.ok(relief(highlands) > 90 && steepest(highlands, 10) > 1.2, "the highlands are tall and steep");
      assert.ok(highlands.features.filter((f) => f.kind === "peak").length >= 4);

      // A ×5 sits on a crater's flat floor, well below the field around it.
      const craters = makeSite(n, seed, "craters");
      const bowls = craters.features.filter((f) => f.kind === "crater");
      assert.ok(bowls.length >= 3);
      const floored = bowls.find((f) => f.floor > 0);
      const deep = craters.pads.find((pad) => pad.cx === floored.cx);
      assert.equal(deep.multiplier, 5);
      assert.ok(groundAt(craters, deep.cx + floored.r) - deep.y > 35);
      assert.ok(groundAt(craters, deep.cx - floored.r) - deep.y > 35);

      // A ×5 on the floor of the trench, the rest up on its banks.
      const rille = makeSite(n, seed, "rille");
      const [trench] = rille.features;
      const bottom = rille.pads.find((pad) => pad.cx === trench.cx);
      assert.equal(bottom.multiplier, 5);
      for (const pad of rille.pads) if (pad !== bottom) assert.ok(pad.y - bottom.y > 60);
      for (const side of [-1, 1]) {
        const lip = trench.floorHalf + trench.walls[side < 0 ? 0 : 1];
        assert.ok(groundAt(rille, bottom.cx + side * lip) - bottom.y > 60);
      }

      // Coasters on mesa tops and on the low ground below them, cliffs sheer.
      const mesas = makeSite(n, seed, "mesas");
      const tops = mesas.features.filter((f) => f.kind === "mesa");
      const onTop = mesas.pads.filter((pad) => tops.some((t) => Math.abs(pad.y - t.top) < 1e-9 && pad.y > 90));
      assert.ok(onTop.length >= 2 && onTop.length <= 3);
      assert.ok(mesas.pads.some((pad) => pad.y < 70 && pad.multiplier === 5));
      assert.ok(steepest(mesas, 3) > 8);

      const dunes = makeSite(n, seed, "dunes");
      assert.ok(relief(dunes) < 90 && steepest(dunes, 10) < 1.6, "dunes are low and smooth");
      const [{ count }] = dunes.features;
      assert.ok(count >= 7 && count <= 10);
    }
  }
});

test("coasters narrow and tanks shrink as sites go on, down to their floors", () => {
  const widest = (site, multiplier) =>
    Math.max(...site.pads.filter((pad) => pad.multiplier === multiplier).map((pad) => pad.width));
  const early = makeSite(1, 7);
  const later = makeSite(5, 7);
  assert.ok(widest(later, 2) < widest(early, 2));
  assert.ok(widest(later, 5) < widest(early, 5));
  assert.equal(widest(early, 2), 74);
  assert.equal(widest(makeSite(20, 7), 2), 74 * 0.6);
  assert.equal(widest(makeSite(20, 7), 5), 29);

  assert.equal(makeSite(1, 7).fuel, MAX_FUEL);
  assert.equal(makeSite(2, 7).fuel, 570);
  assert.ok(makeSite(6, 7).fuel < makeSite(5, 7).fuel);
  assert.equal(makeSite(20, 7).fuel, 270);
});

test("site 1 is calm and later sites blow, capped at 6.5", () => {
  for (const seed of SEEDS) {
    const calm = makeSite(1, seed);
    assert.equal(calm.wind, 0);
    assert.equal(windAt(calm, 3), 0);
    for (let n = 2; n <= 20; n++) {
      const wind = Math.abs(makeSite(n, seed).wind);
      assert.ok(wind > 0 && wind <= 6.5);
    }
    assert.equal(Math.abs(makeSite(20, seed).wind), 6.5);
  }
  const windy = makeSite(4, 7);
  assert.ok(Math.abs(windAt(windy, 2.2)) !== Math.abs(windy.wind));
});

test("ships start high in the view, within limits", () => {
  assert.equal(startAltitude(500), 382);
  assert.equal(startAltitude(2000), 560);
  assert.equal(startAltitude(200), 220);
  const site = makeSite(3, 1);
  const ship = newShip(site, 600);
  assert.equal(ship.vx, 35);
  assert.equal(ship.fuel, site.fuel);
  assert.equal(ship.state, "flying");
});

// --- Points ---------------------------------------------------------------------

test("later sites pay more: a quarter more each site, up to ×3", () => {
  assert.equal(siteMultiplier(1), 1);
  assert.equal(siteMultiplier(2), 1.25);
  assert.equal(siteMultiplier(3), 1.5);
  assert.equal(siteMultiplier(5), 2);
  assert.equal(siteMultiplier(9), 3);
  assert.equal(siteMultiplier(10), 3);
  assert.equal(siteMultiplier(40), 3);
  for (let n = 1; n < 30; n++) assert.ok(siteMultiplier(n + 1) >= siteMultiplier(n));
});

test("landings pay the coaster times the tea left, plus a feather bonus, times the site", () => {
  const pad = { cx: 0, y: 50, width: 60, multiplier: 3 };
  assert.deepEqual(landingScore(pad, 200.4, -10), { points: 3 * 250, feather: false });
  assert.deepEqual(landingScore(pad, 200.6, -FEATHER_VY), {
    points: 3 * 251 + 3 * FEATHER_BONUS,
    feather: true,
  });
  // The site's multiplier comes last, over the whole, rounded.
  assert.deepEqual(landingScore(pad, 200.4, -10, 1.25), { points: Math.round(3 * 250 * 1.25), feather: false });
  assert.deepEqual(landingScore(pad, 200.6, -3, 1.75), {
    points: Math.round((3 * 251 + 3 * FEATHER_BONUS) * 1.75),
    feather: true,
  });
  assert.equal(landingScore({ ...pad, multiplier: 5 }, 101, -10, 1.25).points, 944);
  assert.equal(landingScore(pad, 200.4, -10, siteMultiplier(9)).points, 3 * 250 * 3);
});

// --- Touchdowns -------------------------------------------------------------------

test("touchdowns are judged in order of severity", () => {
  const pad = { cx: 0, y: 50, width: 60, multiplier: 2 };
  const ok = { vx: 0, vy: -3, angle: 0 };
  assert.equal(judgeTouchdown(ok, pad, false), null);
  assert.equal(judgeTouchdown({ ...ok, vy: -SAFE_VY * 1.8 - 1 }, pad, false), "fast");
  assert.equal(judgeTouchdown({ ...ok, vx: SAFE_VX * 2.2 + 1 }, pad, false), "fast");
  assert.equal(judgeTouchdown(ok, null, false), "off");
  assert.equal(judgeTouchdown(ok, pad, true), "tilt");
  assert.equal(judgeTouchdown({ ...ok, angle: -SAFE_TILT - 0.01 }, pad, false), "tilt");
  assert.equal(judgeTouchdown({ ...ok, vy: -SAFE_VY - 1 }, pad, false), "hard");
  assert.equal(judgeTouchdown({ ...ok, vx: -SAFE_VX - 1 }, pad, false), "drift");

  // Each reason outranks the ones after it.
  assert.equal(judgeTouchdown({ vx: 0, vy: -40, angle: 1 }, null, true), "fast");
  assert.equal(judgeTouchdown({ vx: 15, vy: -20, angle: 1 }, null, true), "off");
  assert.equal(judgeTouchdown({ vx: 15, vy: -20, angle: 1 }, pad, false), "tilt");
  assert.equal(judgeTouchdown({ vx: 15, vy: -20, angle: 0 }, pad, false), "hard");
});

// --- Flight -------------------------------------------------------------------------

test("an idle ship falls under gravity alone", () => {
  const site = makeSite(1, 7);
  const ship = highShip(site);
  fly(ship, IDLE, site, 1);
  assert.ok(Math.abs(ship.vy + GRAVITY) < 1e-9);
  assert.ok(Math.abs(ship.y - (5000 - GRAVITY / 2)) < 0.1);
  assert.equal(ship.vx, 0);
  assert.equal(ship.fuel, site.fuel);
  assert.equal(ship.plumeReach, 999);
});

test("thrust burns tea at BURN per second and cuts out when the cup is dry", () => {
  const site = makeSite(1, 7);
  const ship = highShip(site);
  const burn = { left: false, right: false, thrust: true };
  fly(ship, burn, site, 2);
  assert.ok(ship.vy > -GRAVITY * 2, "thrust slows the fall");
  const before = ship.fuel;
  fly(ship, burn, site, 1);
  assert.ok(Math.abs(before - ship.fuel - BURN) < 0.01);

  ship.fuel = 1;
  fly(ship, burn, site, 1);
  assert.equal(ship.fuel, 0);
  assert.ok(ship.throttle < 0.01);
  assert.equal(ship.plumeReach, 999);
  const vy = ship.vy;
  stepShip(ship, burn, site, 0, H);
  assert.ok(Math.abs(ship.vy - (vy - GRAVITY * H)) < 0.01);
});

test("turn keys tilt the ship and its thrust pushes the way it leans", () => {
  const site = makeSite(1, 7);
  const right = highShip(site);
  fly(right, { left: false, right: true, thrust: false }, site, 0.3);
  assert.ok(right.angle > 0);
  fly(right, { left: false, right: false, thrust: true }, site, 0.5);
  assert.ok(right.vx > 0);

  const left = highShip(site);
  fly(left, { left: true, right: false, thrust: false }, site, 0.3);
  assert.ok(left.angle < 0);
  // Spinning on keeps the angle inside (-π, π].
  fly(left, { left: true, right: false, thrust: false }, site, 4);
  assert.ok(left.angle > -Math.PI && left.angle <= Math.PI);
});

test("a slow, upright descent onto a coaster lands and scores, times the site", () => {
  for (const n of [1, 5]) {
    const site = makeSite(n, 7);
    const pad = site.pads[0];
    const ship = { ...newShip(site, 600), x: pad.cx, y: pad.y + FOOT_DROP + 1, vx: 0, vy: -2 };
    let result = null;
    for (let step = 0; step < 600 && !result; step++) result = stepShip(ship, IDLE, site, step * H, H);
    assert.ok(result);
    assert.equal(result.kind, "land");
    assert.equal(result.pad, pad);
    assert.equal(result.feather, true);
    assert.equal(
      result.points,
      Math.round((pad.multiplier * (50 + Math.round(site.fuel)) + pad.multiplier * FEATHER_BONUS) * siteMultiplier(n)),
    );
    assert.equal(ship.state, "landed");
    assert.equal(ship.y, pad.y + FOOT_DROP);
    assert.deepEqual([ship.vx, ship.vy, ship.angle], [0, 0, 0]);
  }
});

test("a fast drop onto rough ground crashes", () => {
  for (const terrain of TERRAINS) {
    const site = makeSite(2, 7, terrain);
    // Halfway between two coasters is well away from either.
    const sorted = [...site.pads].sort((a, b) => a.cx - b.cx);
    const x = (sorted[0].cx + sorted[1].cx) / 2;
    const ship = { ...newShip(site, 600), x, y: groundAt(site, x) + 40, vx: 0, vy: -50 };
    let result = null;
    for (let step = 0; step < 600 && !result; step++) result = stepShip(ship, IDLE, site, step * H, H);
    assert.ok(result);
    assert.equal(result.kind, "crash");
    assert.ok(result.reason === "fast" || result.reason === "off");
    assert.equal(ship.state, "crashed");
  }
});

test("an autopilot lands on every coaster of every terrain from the start, on the site's tea", () => {
  // Short and tall views start the ship at different heights. A coaster
  // nearly half a moon behind is easier reached going on with the drift.
  for (const view of [200, 450]) {
    for (const site of everySite(SEEDS, [1, 2, 4, 6])) {
      for (const pad of site.pads) {
        let { result } = autopilot(site, pad, view);
        if (result?.kind !== "land") ({ result } = autopilot(site, pad, view, undefined, 1));
        assert.ok(result, `${site.terrain} n${site.n} ×${pad.multiplier}: still flying`);
        assert.equal(
          result.kind === "land" ? result.pad : result.reason,
          pad,
          `${site.terrain} n${site.n} seed ${site.seed} ×${pad.multiplier} at ${pad.cx.toFixed(0)}, view ${view}`,
        );
      }
    }
  }
});

test("on the leanest tanks and strongest winds, every coaster can still be landed from its own quarter", () => {
  // From site 7 the tank is too small to cross the whole moon against the
  // entry drift, so the ship starts upwind of each coaster instead.
  for (const view of [200, 450]) {
    for (const site of everySite(SEEDS, [7, 9, 12])) {
      for (const pad of site.pads) {
        const { result, ship } = autopilot(site, pad, view, pad.cx - 150);
        assert.ok(result, `${site.terrain} n${site.n} ×${pad.multiplier}: still flying`);
        assert.equal(
          result.kind === "land" ? result.pad : result.reason,
          pad,
          `${site.terrain} n${site.n} seed ${site.seed} ×${pad.multiplier} at ${pad.cx.toFixed(0)}, view ${view}`,
        );
        assert.ok(ship.fuel > 0);
      }
    }
  }
});

test("a landed or crashed ship no longer moves", () => {
  const site = makeSite(1, 7);
  for (const state of ["landed", "crashed"]) {
    const ship = { ...highShip(site), state };
    const before = { ...ship };
    assert.equal(stepShip(ship, { left: true, right: false, thrust: true }, site, 0, H), null);
    assert.deepEqual(ship, before);
  }
});

test("the camera zooms in smoothly as the ground comes up", () => {
  assert.equal(zoomForClearance(175), 0);
  assert.equal(zoomForClearance(500), 0);
  assert.equal(zoomForClearance(46), 1);
  assert.equal(zoomForClearance(0), 1);
  let last = 0;
  for (let c = 200; c >= 20; c -= 5) {
    const zoom = zoomForClearance(c);
    assert.ok(zoom >= last);
    last = zoom;
  }
});
