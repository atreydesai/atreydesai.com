import assert from "node:assert/strict";
import test from "node:test";

import {
  BURN,
  FEATHER_BONUS,
  FEATHER_VY,
  FOOT_DROP,
  GRAVITY,
  MAX_FUEL,
  PERIOD,
  SAFE_TILT,
  SAFE_VX,
  SAFE_VY,
  SITE_NAMES,
  createRng,
  groundAt,
  judgeTouchdown,
  landingScore,
  makeSite,
  newShip,
  padUnder,
  startAltitude,
  stepShip,
  windAt,
  zoomForClearance,
} from "../src/lib/arcade/lander-engine.js";

const H = 1 / 120;
const IDLE = { left: false, right: false, thrust: false };
const SEEDS = [1, 7, 42, 1234, 99999, 31337];

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

// --- Sites --------------------------------------------------------------------

test("a seed always builds the same site, and seeds differ", () => {
  assert.deepEqual(makeSite(3, 42), makeSite(3, 42));
  assert.notDeepEqual(makeSite(3, 42).points, makeSite(3, 43).points);
  const random = createRng(5);
  const again = createRng(5);
  for (let i = 0; i < 20; i++) {
    const value = random();
    assert.equal(value, again());
    assert.ok(value >= 0 && value < 1);
  }
});

test("sites are named in order and wrap around the list", () => {
  assert.equal(makeSite(1, 1).name, "sea of tapioca");
  assert.equal(makeSite(8, 1).name, "crater of second sips");
  assert.equal(makeSite(9, 1).name, SITE_NAMES[0]);
});

test("every site has four flat, separate pads with the right multipliers", () => {
  for (const seed of SEEDS) {
    for (let n = 1; n <= 10; n++) {
      const site = makeSite(n, seed);
      assert.equal(site.pads.length, 4);
      const multipliers = site.pads.map((pad) => pad.multiplier).sort((a, b) => a - b);
      assert.deepEqual(multipliers, n <= 3 ? [2, 2, 3, 5] : [2, 3, 5, 5]);
      for (const pad of site.pads) {
        for (let k = 0; k <= 10; k++) {
          const x = pad.cx - pad.width / 2 + (pad.width * k) / 10;
          assert.ok(Math.abs(groundAt(site, x) - pad.y) < 1e-9, `pad flat at ${x}`);
        }
        assert.equal(padUnder(site, pad.cx - 11, pad.cx + 11), pad);
      }
      const spans = site.pads
        .map((pad) => [pad.cx - pad.width / 2, pad.cx + pad.width / 2])
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] > spans[i - 1][1]);
      assert.ok(spans[0][0] > 0 && spans[3][1] < PERIOD);
      const xs = site.points.map((p) => p[0]);
      assert.deepEqual([...xs].sort((a, b) => a - b), xs);
    }
  }
});

test("pads narrow and tanks shrink as sites go on, down to their floors", () => {
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

test("the ground wraps without a seam", () => {
  for (const seed of SEEDS) {
    const site = makeSite(2, seed);
    assert.equal(groundAt(site, 0), groundAt(site, PERIOD));
    assert.ok(Math.abs(groundAt(site, -1e-6) - groundAt(site, 0)) < 1e-3);
    assert.ok(Math.abs(groundAt(site, PERIOD - 1e-6) - groundAt(site, 0)) < 1e-3);
    assert.ok(Math.abs(groundAt(site, -250) - groundAt(site, PERIOD - 250)) < 1e-9);
    assert.ok(Math.abs(groundAt(site, 3 * PERIOD + 17) - groundAt(site, 17)) < 1e-9);
  }
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

test("landings pay the pad times the tea left, plus a feather bonus", () => {
  const pad = { cx: 0, y: 50, width: 60, multiplier: 3 };
  assert.deepEqual(landingScore(pad, 200.4, -10), { points: 3 * 250, feather: false });
  assert.deepEqual(landingScore(pad, 200.6, -FEATHER_VY), {
    points: 3 * 251 + 3 * FEATHER_BONUS,
    feather: true,
  });
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

test("a slow, upright descent onto a pad lands and scores", () => {
  const site = makeSite(1, 7);
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
    pad.multiplier * (50 + Math.round(site.fuel)) + pad.multiplier * FEATHER_BONUS,
  );
  assert.equal(ship.state, "landed");
  assert.equal(ship.y, pad.y + FOOT_DROP);
  assert.deepEqual([ship.vx, ship.vy, ship.angle], [0, 0, 0]);
});

test("a fast drop onto rough ground crashes", () => {
  const site = makeSite(2, 7);
  // Halfway between two pads is well away from either.
  const sorted = [...site.pads].sort((a, b) => a.cx - b.cx);
  const x = (sorted[0].cx + sorted[1].cx) / 2;
  const ship = { ...newShip(site, 600), x, y: groundAt(site, x) + 40, vx: 0, vy: -50 };
  let result = null;
  for (let step = 0; step < 600 && !result; step++) result = stepShip(ship, IDLE, site, step * H, H);
  assert.ok(result);
  assert.equal(result.kind, "crash");
  assert.ok(result.reason === "fast" || result.reason === "off");
  assert.equal(ship.state, "crashed");
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
