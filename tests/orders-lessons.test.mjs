import assert from "node:assert/strict";
import test from "node:test";

import { createCoach } from "../src/lib/arcade/core/coach.ts";
import {
  CROSS_AT,
  CRITIC,
  GLANCE_AT,
  ICE_CUBES,
  TANK_CAPACITY,
  TANK_LOW,
  TEAS,
  TOPPINGS,
  ladleAt,
  makeOrder,
  rulesFor,
  scoopQueue,
  scoopResult,
  sealNeedle,
  sealResult,
  stationsFor,
  sugarPumps,
} from "../src/lib/arcade/orders-engine.js";
import {
  LESSONS,
  STATION_LESSON,
  CARD_STEPS,
  THING_GAP,
  WALK_GAP,
  allLessons,
  atMoment,
  followLessons,
  ladleCentreIn,
  lessonMemory,
  lessonNow,
  needleCentreIn,
  ticketBeckon,
  walkPending,
} from "../src/lib/arcade/orders-lessons.js";

/** A seeded random, so the orders below are the same every run. */
function seeded(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ids = 1;
function guest(order, extra = {}) {
  return { id: ids++, placed: true, left: 30, patience: 30, regular: { name: "pip" }, order, ...extra };
}

function cupFor(g) {
  const stations = stationsFor(g.order);
  return {
    guestId: g.id,
    order: g.order,
    stations,
    station: stations[0],
    busy: false,
    tea: null,
    ice: 0,
    sugar: 0,
    shakes: 0,
    queue: scoopQueue(g.order),
    drops: [],
    stampAt: null,
  };
}

function view(extra = {}) {
  return {
    coarse: false,
    expert: false,
    started: false,
    tapIndex: 0,
    jarIndex: 0,
    holding: false,
    loaded: true,
    ladle: 0,
    needle: 0.77,
    cup: null,
    guests: [],
    tanks: TEAS.map(() => TANK_CAPACITY),
    brewEnds: TEAS.map(() => 0),
    samplesLeft: 3,
    special: "taro",
    jar: 0,
    receipt: null,
    ...extra,
  };
}

const none = () => false;
const all = () => true;
const order = { tea: "matcha", sugar: 50, ice: "regular", toppings: [{ kind: "jelly", scoops: 1 }] };
/** Every step of the walk-through, for a device that has finished it. */
const WALK = ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"];

test("every line fits the arcade's one-line voice", () => {
  for (const lesson of allLessons()) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id}: "${lesson.text}" runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
  }
});

test("every lesson stops the shift until it is answered, however long it is read", () => {
  for (const lesson of allLessons()) {
    assert.equal(lesson.slow, 0, `${lesson.id} pauses play rather than slowing it`);
    assert.equal(lesson.life, Infinity, `${lesson.id} never ends by itself`);
  }
});

test("the first drink is walked through station by station, each pointing at what to press", () => {
  const g = guest(order);
  const v = view({ guests: [g], tapIndex: TEAS.indexOf("matcha") });
  const learned = new Set();
  const knows = (id) => learned.has(id);
  const seen = [];
  const teach = () => {
    const next = lessonNow(v, knows);
    if (next) {
      seen.push(`${next.lesson.id}@${next.at.kind}`);
      learned.add(next.lesson.id);
    }
    return next;
  };

  assert.equal(teach().at.guest, g.id, "the ticket the hand takes next");
  v.cup = cupFor(g);
  v.started = true;
  assert.equal(v.cup.station, "sugar", "syrup first");
  assert.equal(teach().lesson.slow, 0);
  v.cup.station = "ice";
  teach();
  v.cup.station = "pour";
  teach();
  // Pouring: the same line follows the tea to the fill line.
  v.holding = true;
  assert.equal(lessonNow(v, none).at.kind, "line");
  v.holding = false;
  v.cup.station = "scoop";
  v.jarIndex = TOPPINGS.indexOf("pudding");
  teach();
  v.jarIndex = TOPPINGS.indexOf("jelly");
  teach();
  v.cup.station = "shake";
  teach();
  v.cup.station = "seal";
  teach();
  v.cup.stampAt = 1;
  assert.equal(lessonNow(v, knows), null, "nothing over the hand-off");

  // The card's lines where it is about what the drink wants; the thing
  // itself where the motion is the lesson.
  assert.deepEqual(seen, [
    "ticket@ticket",
    "syrup@step",
    "ice@step",
    "pour@step",
    "jar@jar",
    "drop@ladle",
    "shake@step",
    "seal@gauge",
  ]);
});

test("a station is taught only where the order visits it, and never once learned", () => {
  const random = seeded(7);
  for (let index = 0; index < 200; index++) {
    const g = guest(makeOrder(index % 120, null, random));
    const cup = cupFor(g);
    const v = view({ guests: [g], cup, tapIndex: TEAS.indexOf(g.order.tea), jarIndex: TOPPINGS.indexOf(cup.queue[0] ?? "pearls") });
    for (const station of cup.stations) {
      cup.station = station;
      const next = lessonNow(v, none);
      assert.ok(next, `${station} for ${JSON.stringify(g.order)}`);
      assert.equal(next.lesson.id, STATION_LESSON[station]);
      assert.equal(lessonNow(v, all), null);
    }
    // No ice or no syrup on the ticket: never pointed at the bin or the bottle.
    if (!ICE_CUBES[g.order.ice]) assert.ok(!cup.stations.includes("ice"));
    if (!sugarPumps(g.order.sugar)) assert.ok(!cup.stations.includes("sugar"));
  }
});

test("each line can be followed literally", () => {
  const g = guest(order);
  const cup = { ...cupFor(g), station: "pour" };
  const matcha = TEAS.indexOf("matcha");

  // The cup starts under its tea's tap: the card's tea line, and Space.
  const v = view({ guests: [g], cup, tapIndex: matcha });
  let next = lessonNow(v, none);
  assert.equal(next.lesson.id, "pour");
  assert.deepEqual(next.lesson.keys, ["Space"]);
  assert.deepEqual(next.at, { kind: "step", index: CARD_STEPS.indexOf("pour"), guest: -1 });
  // Moved under another tap on a keyboard: the arrows back, never Space, pointing at the ordered tap.
  v.tapIndex = 0;
  next = lessonNow(v, none);
  assert.equal(next.lesson.id, "pour");
  assert.deepEqual(next.lesson.keys, ["←", "→"]);
  assert.deepEqual(next.at, { kind: "tap", index: matcha, guest: -1 });
  // Holding the wrong tap: nothing to say that would help.
  v.holding = true;
  assert.equal(lessonNow(v, none), null);

  // Touch: hold the ordered tap itself, which moves the cup under it.
  const touch = view({ guests: [g], cup, tapIndex: 0, coarse: true });
  next = lessonNow(touch, none);
  assert.equal(next.lesson.id, "pour");
  assert.equal(next.lesson.touch, "hold");
  assert.deepEqual(next.at, { kind: "tap", index: matcha, guest: -1 });

  // The drop waits for the right jar, and for the ladle to be loaded.
  const scoop = { ...cupFor(g), station: "scoop" };
  const s = view({ guests: [g], cup: scoop, jarIndex: 0 });
  assert.equal(lessonNow(s, (id) => id === "jar"), null);
  s.jarIndex = TOPPINGS.indexOf("jelly");
  s.loaded = false;
  assert.equal(lessonNow(s, (id) => id === "jar"), null);
  s.loaded = true;
  assert.equal(lessonNow(s, (id) => id === "jar").lesson.id, "drop");

  // Brew's B brews the selected tap, so it shows only when that is the low one.
  const low = view({ tanks: [TANK_CAPACITY, TANK_LOW / 2, TANK_CAPACITY, TANK_CAPACITY], tapIndex: 0 });
  next = lessonNow(low, (id) => id !== "brew");
  assert.deepEqual(next.at, { kind: "brew", index: 1, guest: -1 });
  assert.equal(next.lesson.keys, undefined);
  low.tapIndex = 1;
  assert.deepEqual(lessonNow(low, (id) => id !== "brew").lesson.keys, ["B"]);
  // A tank already brewing has nothing to teach.
  low.brewEnds[1] = 3;
  assert.equal(lessonNow(low, (id) => id !== "brew"), null);
});

test("the ticket waits until it is on the rail", () => {
  const g = guest(order, { placed: false });
  const v = view({ guests: [g] });
  assert.equal(lessonNow(v, none), null);
  assert.equal(ticketBeckon(v, none), -1);
  g.placed = true;
  assert.equal(lessonNow(v, none).lesson.id, "ticket");
  assert.equal(ticketBeckon(v, none), g.id);
});

test("only its stations are taught while a drink is on the bench", () => {
  const critic = guest(makeOrder(50, CRITIC, seeded(3)), { regular: CRITIC });
  const g = guest(order);
  const cup = cupFor(g);
  const v = view({ guests: [g, critic], cup, jar: 4, tanks: [0, 0, 0, 0], started: true });
  // Only the ticket is known: through the syrup's settle its own line stays
  // up, and the critic, the jar and the dry tanks all wait for the drink.
  cup.busy = true;
  const knowsTicket = (id) => id === "ticket";
  assert.ok(walkPending(cup, knowsTicket));
  assert.equal(lessonNow(v, knowsTicket).lesson.id, "syrup");
  cup.station = "pour";
  assert.equal(lessonNow(v, knowsTicket), null, "between stations, nothing");
  // Every station learned: still nothing while the drink is on the bench, at any station.
  cup.busy = false;
  for (const station of ["sugar", "ice", "pour", "scoop", "shake", "seal"]) {
    cup.station = station;
    assert.equal(lessonNow(v, (id) => !["critic", "patience", "tipjar"].includes(id)), null, station);
  }
  // Served, with the bench empty: the critic is named.
  v.cup = null;
  v.guests = [critic];
  const next = lessonNow(v, (id) => id !== "critic");
  assert.equal(next.lesson.id, "critic");
  assert.equal(next.lesson.name, "the critic");
  assert.deepEqual(next.at, { kind: "ticket", index: -1, guest: critic.id });
});

test("until the shift's first ticket is taken, nothing else is said and the ticket stays marked", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  const g = guest(order);
  const critic = guest(makeOrder(50, CRITIC, seeded(5)), { regular: CRITIC, left: 30 * CROSS_AT });
  const v = view({ guests: [g, critic], jar: 4, special: "matcha", tanks: [0, TANK_CAPACITY, TANK_CAPACITY, TANK_CAPACITY] });
  // The most restless guest's ticket: its line, and the mark on it.
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "ticket");
  assert.equal(memory.cue.at.guest, critic.id);
  assert.equal(ticketBeckon(v, coach.learned), critic.id);
  // Continued without taking it: counted, and play comes back; but a
  // critic, a cross guest, a tip, a dry tank and a special all wait, and
  // the ticket stays marked.
  coach.done("ticket");
  run(coach, v, memory, THING_GAP * 4);
  assert.equal(coach.current, null);
  assert.equal(ticketBeckon(v, coach.learned), critic.id);
  // Taken: the mark goes and the walk-through goes on.
  v.started = true;
  v.cup = cupFor(critic);
  assert.equal(ticketBeckon(v, coach.learned), -1);
  run(coach, v, memory, WALK_GAP + 0.5);
  assert.equal(coach.current?.id, STATION_LESSON[v.cup.station]);
  // A device that has learned every step marks nothing.
  assert.equal(ticketBeckon(view({ guests: [g] }), all), -1);
});

test("things wait for an empty bench", () => {
  const g = guest(order);
  const other = guest(order, { left: 5 });
  const knows = (id) => !["patience", "tipjar"].includes(id);
  for (const station of ["sugar", "ice", "pour", "scoop", "shake", "seal"]) {
    const cup = { ...cupFor(g), station };
    const v = view({ guests: [g, other], cup, jar: 5, started: true });
    assert.equal(lessonNow(v, knows), null, station);
  }
  const v = view({ guests: [g, other], jar: 5, started: true });
  assert.equal(lessonNow(v, knows).lesson.id, "patience");
});

test("each later thing is named when it first matters", () => {
  const knowsAllBut = (...ids) => (id) => !ids.includes(id);

  // Patience, from the moment a waiting guest starts watching the clock.
  const g = guest(order, { left: 30 * GLANCE_AT + 0.5 });
  const v = view({ guests: [g] });
  assert.equal(lessonNow(v, knowsAllBut("patience")), null);
  g.left = 30 * GLANCE_AT;
  assert.deepEqual(lessonNow(v, knowsAllBut("patience")).at, { kind: "patience", index: -1, guest: g.id });
  v.cup = { ...cupFor(g), station: "shake" };
  assert.equal(lessonNow(v, knowsAllBut("patience")), null, "their own drink is on the bench");
  v.cup = null;

  // A sample once someone is cross, if there are any left.
  assert.equal(lessonNow(v, knowsAllBut("sample")), null);
  g.left = 30 * CROSS_AT;
  assert.deepEqual(lessonNow(v, knowsAllBut("sample")).at, { kind: "sample", index: -1, guest: -1 });
  v.samplesLeft = 0;
  assert.equal(lessonNow(v, knowsAllBut("sample")), null);

  // The special, on a ticket that orders it.
  const taro = guest({ ...order, tea: "taro" });
  const s = view({ guests: [taro], special: "taro" });
  assert.deepEqual(lessonNow(s, knowsAllBut("special")).at, { kind: "ticket", index: -1, guest: taro.id });
  s.special = "milk";
  assert.equal(lessonNow(s, knowsAllBut("special")), null);

  // The tip jar, once a coin is in it.
  const j = view();
  assert.equal(lessonNow(j, knowsAllBut("tipjar")), null);
  j.jar = 1;
  assert.equal(lessonNow(j, knowsAllBut("tipjar")).at.kind, "tipjar");

  // The receipt at the first hand-off, and its combo line the first time it climbs.
  const r = view({ receipt: { sentBack: false, combo: 0 } });
  assert.equal(lessonNow(r, knowsAllBut("serve")).at.kind, "receipt");
  assert.equal(lessonNow(r, knowsAllBut("combo")), null);
  r.receipt.combo = 2;
  assert.equal(lessonNow(r, knowsAllBut("combo")).at.kind, "streak");
  r.receipt.sentBack = true;
  assert.equal(lessonNow(r, knowsAllBut("serve", "combo")), null);
});

test("with the shared coach, a first shift teaches each station once and a second teaches none", () => {
  const coach = createCoach("orders", { persist: false });
  const random = seeded(11);
  /** Plays `drinks` drinks start to finish, doing each move the moment it is shown; returns what was shown. */
  const shift = (drinks) => {
    const shown = [];
    for (let drink = 0; drink < drinks; drink++) {
      const g = guest(makeOrder(40, null, random));
      const v = view({ guests: [g], tapIndex: TEAS.indexOf(g.order.tea), started: drink > 0 });
      const show = () => {
        const next = lessonNow(v, coach.learned);
        if (next && next.lesson.move && coach.offer(next.lesson)) {
          shown.push(next.lesson.id);
          coach.step(0.7);
          coach.acted(next.lesson.id);
          coach.done(next.lesson.id);
          coach.step(1);
        }
      };
      show();
      v.cup = cupFor(g);
      v.started = true;
      for (const station of v.cup.stations) {
        v.cup.station = station;
        if (station === "scoop") v.jarIndex = TOPPINGS.indexOf(v.cup.queue[0]);
        show();
      }
    }
    return shown;
  };
  const first = shift(6);
  // Ticket, then the stations in the order a drink meets them, each once.
  assert.equal(first[0], "ticket");
  assert.equal(new Set(first).size, first.length, "each taught once");
  for (const id of ["ice", "syrup", "pour", "shake", "seal"]) assert.ok(coach.learned(id), id);
  // A new shift on the same device: nothing is walked through again.
  coach.reset();
  assert.deepEqual(shift(6), []);
});

/** The game's clock across a test's runs: it stops while a lesson stops play, as the counter's does. */
let clock = 0;

/** Steps the coach and the lessons together for `seconds` of real time, as the game's frames do; returns play's pace each frame. */
function run(coach, v, memory, seconds, dt = 1 / 60) {
  const paces = [];
  for (let t = 0; t < seconds; t += dt) {
    const played = coach.step(dt);
    clock += played;
    paces.push(played / dt);
    followLessons(coach, v, memory, clock);
  }
  return paces;
}

test("play stops while a step is taught, as long as it takes, and comes back with its move", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  const g = guest(order);
  const v = view({ guests: [g], tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 1);
  assert.equal(coach.current?.id, "ticket");
  assert.equal(memory.cue.at.kind, "ticket");
  assert.ok(coach.paused, "the shift stops for it");
  // However long it is read, it waits, and no time passes in the shift.
  const before = clock;
  run(coach, v, memory, 90);
  assert.equal(coach.current?.id, "ticket");
  assert.ok(clock - before < 0.01, `${(clock - before).toFixed(3)} s of play passed`);
  // Taken (the press is the move): play comes back at once.
  coach.acted("ticket");
  coach.done("ticket");
  v.cup = cupFor(g);
  v.started = true;
  let paces = run(coach, v, memory, 0.8);
  assert.ok(paces.at(-1) > 0.95, `back to speed, ${paces.at(-1)}`);
  // The first pump: the line stays up while play runs, until the marks are full.
  run(coach, v, memory, WALK_GAP + 0.2);
  assert.equal(coach.current?.id, "syrup");
  assert.ok(coach.paused);
  coach.acted("syrup");
  v.cup.sugar = 1;
  paces = run(coach, v, memory, 1);
  assert.equal(coach.current?.id, "syrup");
  assert.ok(paces.at(-1) > 0.95);
  coach.done("syrup");
  v.cup.busy = true;
  run(coach, v, memory, 1);
  assert.equal(coach.current, null);
});

test("steps come one at a time, a short quiet of play apart", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  const g = guest(order);
  const v = view({ guests: [g], tapIndex: TEAS.indexOf("matcha") });
  /** Plays on until a lesson is up; returns the play seconds with none on screen. */
  const quietUntilNext = () => {
    let quiet = 0;
    for (let frame = 0; frame < 600 && (!coach.current || coach.leaving); frame++) {
      const was = clock;
      coach.step(1 / 60);
      clock += 1 / 60;
      followLessons(coach, v, memory, clock);
      if (!coach.current) quiet += clock - was;
    }
    return quiet;
  };
  quietUntilNext();
  assert.equal(coach.current?.id, "ticket");
  coach.done("ticket");
  v.cup = cupFor(g);
  v.started = true;
  assert.ok(quietUntilNext() >= WALK_GAP - 0.05);
  assert.equal(coach.current?.id, "syrup");
  coach.done("syrup");
  v.cup.station = "ice";
  assert.ok(quietUntilNext() >= WALK_GAP - 0.05);
  assert.equal(coach.current?.id, "ice");
});

test("a station the player has begun before its line shows isn't taught on that drink", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  coach.skip("ticket");
  const g = guest(order);
  const v = view({ guests: [g], cup: cupFor(g), started: true });
  // A pump in during the quiet after the ticket.
  memory.calm = clock + WALK_GAP;
  v.cup.sugar = 1;
  run(coach, v, memory, WALK_GAP * 3);
  assert.equal(coach.current, null);
  // The syrup worked: known. The ice is new: taught.
  coach.done("syrup");
  assert.ok(coach.learned("syrup"));
  v.cup.station = "ice";
  run(coach, v, memory, 0.2);
  assert.equal(coach.current?.id, "ice");
  // A shake made before its line: not taught either.
  coach.done("ice");
  run(coach, v, memory, 1);
  for (const id of ["pour", "jar", "drop"]) coach.skip(id);
  v.cup.station = "shake";
  v.cup.shakes = 2;
  run(coach, v, memory, WALK_GAP * 3);
  assert.equal(coach.current, null);
});

test("no new line while tea is running, except the one for a dry tap", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "syrup", "ice"]) coach.skip(id);
  const g = guest(order);
  const matcha = TEAS.indexOf("matcha");
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "pour" }, started: true, tapIndex: matcha, holding: true });
  run(coach, v, memory, 1);
  assert.equal(coach.current, null, "pouring already: the pour isn't stopped to teach it");
  v.tanks[matcha] = 0;
  run(coach, v, memory, 0.2);
  assert.equal(coach.current?.id, "dry");
  assert.match(coach.current.text, /^Let go/);
});

test("the drop and the stamp stop play at the very moment to make them", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "syrup", "ice", "pour", "jar", "shake"]) coach.skip(id);
  const g = guest(order);
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "scoop" }, started: true, jarIndex: TOPPINGS.indexOf("jelly"), ladle: 0.8 });
  // Out at the side: nothing yet, and the counter is told what the line waits on.
  run(coach, v, memory, 0.5);
  assert.equal(coach.current, null);
  assert.equal(memory.waiting, "ladle");
  // Right over the cup: the line, with play stopped there, where a drop lands clean.
  v.ladle = 0;
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "drop");
  assert.ok(coach.paused);
  assert.equal(scoopResult(v.ladle), "clean");
  assert.equal(memory.waiting, null);
  coach.acted("drop");
  coach.done("drop");
  run(coach, v, memory, 1);

  // The seal: the needle cold, then in the band.
  v.cup.station = "seal";
  v.needle = 0.2;
  run(coach, v, memory, WALK_GAP + 0.5);
  assert.equal(coach.current, null);
  assert.equal(memory.waiting, "needle");
  v.needle = 0.77;
  run(coach, v, memory, 0.2);
  assert.equal(coach.current?.id, "seal");
  assert.equal(sealResult(v.needle), "sealed");
  assert.ok(atMoment(v, "seal") && !atMoment({ ...v, needle: 0.5 }, "seal"));
});

test("the counter can stop its clock right on the ladle's and the needle's moments", () => {
  for (const swing of [2.4, 3, 3.6, 4.7]) {
    for (let time = 0; time < 6; time += 0.137) {
      const until = ladleCentreIn(time, swing);
      assert.ok(until > 0 && until <= Math.PI / swing + 1e-9, `${until}`);
      assert.ok(Math.abs(ladleAt(time + until, swing, Math.PI / 2)) < 1e-9);
      // Nowhere before it is the ladle over the cup's middle.
      for (let k = 1; k < 10; k++) assert.ok(Math.abs(ladleAt(time + (until * k) / 10, swing, Math.PI / 2)) > 1e-6);
    }
    // Stopped right on a crossing, the next one is the one after.
    const first = ladleCentreIn(0, swing);
    assert.ok(Math.abs(ladleCentreIn(first, swing) - Math.PI / swing) < 1e-9);
  }
  for (const expert of [false, true]) {
    const { sealBand: band, sealPeriod: period } = rulesFor(expert);
    const middle = (band[0] + band[1]) / 2;
    for (let time = 0; time < 5; time += 0.093) {
      const until = needleCentreIn(time, expert);
      assert.ok(until > 0 && until <= period, `${until}`);
      assert.ok(Math.abs(sealNeedle(time + until, expert) - middle) < 1e-9);
      assert.equal(sealResult(sealNeedle(time + until, expert), expert), "sealed");
      assert.ok(needleCentreIn(time + until, expert) > 1e-6);
    }
  }
});

test("a station's lesson whose moment passes comes down uncounted, and the next drink teaches it", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  coach.skip("ticket");
  const g = guest(order);
  const v = view({ guests: [g], cup: cupFor(g), started: true, tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "syrup");
  // A tap pressed early: the cup jumps to the pour, short on syrup and ice.
  v.cup.station = "pour";
  run(coach, v, memory, 0.1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("syrup"), false);
  run(coach, v, memory, WALK_GAP + 0.5);
  assert.equal(coach.current?.id, "pour");
  // Dumped: nothing left to teach on this drink, and play comes back.
  v.cup = null;
  const paces = run(coach, v, memory, 0.8);
  assert.equal(coach.current, null);
  assert.ok(paces.at(-1) > 0.95);
  assert.equal(coach.learned("pour"), false);
  // The next drink teaches the syrup again.
  const next = guest(order);
  v.guests = [next];
  v.cup = cupFor(next);
  run(coach, v, memory, WALK_GAP + 0.5);
  assert.equal(coach.current?.id, "syrup");
});

test("Continue on a step counts it as known, and play comes back", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  coach.skip("ticket");
  const g = guest(order);
  const v = view({ guests: [g], cup: cupFor(g), started: true });
  run(coach, v, memory, 30);
  assert.equal(coach.current?.id, "syrup", "it never stands down by itself");
  assert.equal(coach.scale, 0);
  coach.done("syrup");
  assert.ok(coach.learned("syrup"));
  const paces = run(coach, v, memory, 1);
  assert.ok(paces.at(-1) > 0.95);
  run(coach, v, memory, WALK_GAP + 1);
  assert.equal(coach.current, null, "not taught again");
});

test("the pour's line follows the tea once the tap is held, and stays up through the hold", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup"]) coach.skip(id);
  const g = guest(order);
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "pour" }, started: true, tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 0.5);
  assert.deepEqual(memory.cue.at, { kind: "step", index: CARD_STEPS.indexOf("pour"), guest: -1 });
  assert.ok(coach.paused);
  v.holding = true;
  coach.acted("pour");
  const moved = followLessons(coach, v, memory, clock);
  assert.equal(moved, true, "measured again at its new target");
  assert.equal(memory.cue.at.kind, "line");
  const paces = run(coach, v, memory, 10);
  assert.equal(coach.current?.id, "pour", "a long hold never stands it down");
  assert.ok(paces.at(-1) > 0.95, "and the line is at speed while the tap runs");
});

test("a thing gives way to a drink being started", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  // The receipt is named, and the shift stops for it.
  const v = view({ receipt: { sentBack: false, combo: 0 }, started: true });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "serve");
  assert.ok(coach.paused);
  // The next ticket is taken before it could be read: down, uncounted, and
  // the ice, a station still to teach, follows after a short quiet.
  const g = guest(order);
  v.guests = [g];
  v.cup = { ...cupFor(g), station: "ice" };
  run(coach, v, memory, 0.1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("serve"), false);
  run(coach, v, memory, WALK_GAP + 0.5);
  assert.equal(coach.current?.id, "ice");
  // And a thing never interrupts it: the tip jar fills, the line stays on the ice.
  v.jar = 4;
  run(coach, v, memory, 1);
  assert.equal(coach.current?.id, "ice");
  assert.equal(coach.learned("tipjar"), false);
});

test("a thing comes down when what it points at goes", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of WALK) coach.skip(id);
  // The receipt cleared at once: down, uncounted.
  const v = view({ receipt: { sentBack: false, combo: 0 } });
  run(coach, v, memory, 0.3);
  assert.equal(coach.current?.id, "serve");
  v.receipt = null;
  run(coach, v, memory, 0.1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("serve"), false, "the next shift says it again");
  // The critic's line follows their own ticket as the rail shifts, and fades once read if they are served.
  const other = guest(order);
  const critic = guest(order, { regular: CRITIC });
  v.guests = [other, critic];
  run(coach, v, memory, THING_GAP + 0.5);
  assert.equal(coach.current?.id, "critic");
  assert.equal(memory.cue.at.guest, critic.id);
  v.guests = [critic];
  run(coach, v, memory, 0.1);
  assert.equal(memory.cue.at.guest, critic.id, "still theirs once the guest before them has gone");
  run(coach, v, memory, LESSONS.critic.minLife);
  v.guests = [];
  run(coach, v, memory, 0.1);
  assert.ok(coach.learned("critic"), "up long enough to read: it counts");
  assert.ok(coach.leaving);
});

test("things come one at a time, with a little quiet of play between them", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of WALK) coach.skip(id);
  // The first hand-off: the receipt, coins in the jar, and a special on the rail, all at once.
  const v = view({ receipt: { sentBack: false, combo: 0 }, jar: 3, guests: [guest({ ...order, tea: "taro" })], special: "taro" });
  const shown = [];
  let quietFor = 0;
  let last = null;
  for (let t = 0; t < 30; t += 1 / 60) {
    const played = coach.step(1 / 60);
    clock += played;
    followLessons(coach, v, memory, clock);
    const id = coach.current?.id ?? null;
    if (id && id !== last) {
      shown.push({ id, quiet: quietFor });
      quietFor = 0;
    }
    if (!id) quietFor += played;
    // Read for a couple of seconds, then continued.
    if (id && !coach.leaving && coach.age > 2) coach.done(id);
    last = id;
  }
  assert.deepEqual(
    shown.map((item) => item.id),
    ["serve", "tipjar", "special"],
  );
  for (const item of shown.slice(1)) assert.ok(item.quiet >= THING_GAP - 0.05, `${item.id} after ${item.quiet.toFixed(2)} s of quiet`);
});

test("the receipt's line follows the last station after a short quiet", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake"]) coach.skip(id);
  const g = guest(order);
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "seal" }, started: true });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "seal");
  coach.acted("seal");
  coach.done("seal");
  v.cup.stampAt = clock;
  run(coach, v, memory, 0.7);
  // Served: the cup is gone and the receipt is up.
  v.cup = null;
  v.guests = [];
  v.receipt = { sentBack: false, combo: 0 };
  run(coach, v, memory, 0.2);
  assert.equal(coach.current, null, "not on the heels of the seal");
  run(coach, v, memory, WALK_GAP);
  assert.equal(coach.current?.id, "serve");
});

test("a thing holds until it is continued, and continuing counts it", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of WALK) coach.skip(id);
  const v = view({ jar: 3 });
  run(coach, v, memory, 30);
  assert.equal(coach.current?.id, "tipjar", "still up, with play stopped");
  assert.equal(coach.scale, 0);
  // Continue (Enter, the slip's button, or any press in play) is coach.done.
  coach.done("tipjar");
  assert.ok(coach.learned("tipjar"));
  run(coach, v, memory, 1);
  assert.equal(coach.current, null);
});

test("a thing comes down when a drink is started", () => {
  const coach = createCoach("orders", { persist: false });
  for (const id of WALK) coach.skip(id);
  const g = guest(order);
  const memory = lessonMemory();
  const v = view({ jar: 3, started: true });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "tipjar");
  // Too soon to have been read: down, uncounted, so it comes again.
  v.guests = [g];
  v.cup = cupFor(g);
  run(coach, v, memory, 0.1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("tipjar"), false);
  // Named once a shift: not again in this one.
  v.cup = null;
  run(coach, v, memory, THING_GAP + 1);
  assert.equal(coach.current, null);
  // Next shift, read first, then a drink: it counts, and fades.
  const shift = lessonMemory();
  run(coach, v, shift, LESSONS.tipjar.minLife + 0.5);
  assert.equal(coach.current?.id, "tipjar");
  v.cup = cupFor(g);
  run(coach, v, shift, 0.1);
  assert.ok(coach.learned("tipjar"));
});

test("a tap run dry mid-pour says how to go on: let go, brew, then pour the rest", () => {
  const g = guest(order);
  const matcha = TEAS.indexOf("matcha");
  const tanks = TEAS.map(() => TANK_CAPACITY);
  tanks[matcha] = 0;
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "pour", tea: "matcha" }, tapIndex: matcha, tanks, holding: true });
  let next = lessonNow(v, none);
  assert.equal(next.lesson.id, "dry");
  assert.match(next.lesson.text, /^Let go/);
  assert.deepEqual(next.at, { kind: "brew", index: matcha, guest: -1 });
  // Let go: B brews it (the cup is under that tap).
  v.holding = false;
  next = lessonNow(v, none);
  assert.deepEqual(next.lesson.keys, ["B"]);
  // Brewing: nothing to do but wait (never "hold the tap" at a brewing tank).
  v.brewEnds[matcha] = 4;
  assert.equal(lessonNow(v, none), null);
  // Brewed: the pour goes on.
  v.brewEnds[matcha] = 0;
  v.tanks[matcha] = TANK_CAPACITY;
  assert.equal(lessonNow(v, none).lesson.id, "pour");
  // Someone who knows brewing isn't told.
  v.tanks[matcha] = 0;
  assert.equal(lessonNow(v, (id) => id === "brew"), null);
});

test("a thing is named once a shift, read to the end or not", () => {
  const coach = createCoach("orders", { persist: false });
  let memory = lessonMemory();
  for (const id of WALK) coach.skip(id);
  const v = view({ receipt: { sentBack: false, combo: 0 } });
  run(coach, v, memory, 0.3);
  assert.equal(coach.current?.id, "serve");
  // The next ticket taken at once: the receipt goes, uncounted...
  v.receipt = null;
  run(coach, v, memory, 0.1);
  assert.equal(coach.learned("serve"), false);
  // ...and the next hand-off this shift doesn't say it again.
  v.receipt = { sentBack: false, combo: 0 };
  run(coach, v, memory, THING_GAP + 1);
  assert.equal(coach.current, null);
  // The next shift does.
  memory = lessonMemory();
  run(coach, v, memory, 0.3);
  assert.equal(coach.current?.id, "serve");
});
