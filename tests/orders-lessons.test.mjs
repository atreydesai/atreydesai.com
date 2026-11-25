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
  makeOrder,
  scoopQueue,
  stationsFor,
  sugarPumps,
} from "../src/lib/arcade/orders-engine.js";
import {
  LESSONS,
  STATION_LESSON,
  CARD_STEPS,
  THING_GAP,
  THING_LIFE,
  WALK_SLOW,
  WALK_WAIT,
  allLessons,
  followLessons,
  lessonMemory,
  lessonNow,
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
    queue: scoopQueue(g.order),
    drops: [],
    stampAt: null,
  };
}

function view(extra = {}) {
  return {
    coarse: false,
    tapIndex: 0,
    jarIndex: 0,
    holding: false,
    loaded: true,
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

test("every line fits the arcade's one-line voice", () => {
  for (const lesson of allLessons()) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id}: "${lesson.text}" runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
    // A move waits for the player (it is done, or stands down); a thing
    // holds at full speed until it is continued, or ends by itself.
    if (lesson.move) assert.equal(lesson.life, Infinity, lesson.id);
    else assert.ok(lesson.life === THING_LIFE && (lesson.slow ?? 1) === 1, lesson.id);
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
  assert.equal(v.cup.station, "sugar", "syrup first");
  assert.equal(teach().lesson.slow, WALK_SLOW);
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
  g.placed = true;
  assert.equal(lessonNow(v, none).lesson.id, "ticket");
});

test("nothing else is taught while a drink still has a station to teach", () => {
  const critic = guest(makeOrder(50, CRITIC, seeded(3)), { regular: CRITIC });
  const g = guest(order);
  const cup = cupFor(g);
  const v = view({ guests: [g, critic], cup, jar: 4, tanks: [0, 0, 0, 0] });
  // Only the ticket is known: through the syrup's settle its own line stays
  // up, and the critic, the jar and the dry tanks all wait for the drink.
  cup.busy = true;
  const knowsTicket = (id) => id === "ticket";
  assert.ok(walkPending(cup, knowsTicket));
  assert.equal(lessonNow(v, knowsTicket).lesson.id, "syrup");
  cup.station = "pour";
  assert.equal(lessonNow(v, knowsTicket), null, "between stations, nothing");
  // The last station still to teach is the seal: the shake is no time for the critic either.
  cup.busy = false;
  cup.station = "shake";
  assert.equal(lessonNow(v, (id) => id !== "critic" && id !== "seal"), null);
  // Every station learned: the critic is named.
  cup.busy = false;
  cup.station = "shake";
  const next = lessonNow(v, (id) => id !== "critic");
  assert.equal(next.lesson.id, "critic");
  assert.equal(next.lesson.name, "the critic");
  assert.deepEqual(next.at, { kind: "ticket", index: -1, guest: critic.id });
});

test("things wait while the hands are on the pour, the ladle or the sealer", () => {
  const g = guest(order);
  const other = guest(order, { left: 5 });
  for (const station of ["pour", "scoop", "seal"]) {
    const cup = { ...cupFor(g), station };
    const v = view({ guests: [g, other], cup, jar: 5 });
    assert.equal(lessonNow(v, (id) => !["patience", "tipjar"].includes(id)), null, station);
  }
  const cup = { ...cupFor(g), station: "shake" };
  const v = view({ guests: [g, other], cup, jar: 5 });
  assert.equal(lessonNow(v, (id) => !["patience", "tipjar"].includes(id)).lesson.id, "patience");
});

test("each later thing is named when it first matters", () => {
  const knowsAllBut = (...ids) => (id) => !ids.includes(id);

  // Patience, from the moment a waiting guest starts watching the clock (not the one being made).
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
      const v = view({ guests: [g], tapIndex: TEAS.indexOf(g.order.tea) });
      const show = () => {
        const next = lessonNow(v, coach.learned);
        if (next && next.lesson.move && coach.offer(next.lesson)) {
          shown.push(next.lesson.id);
          coach.step(0.7);
          coach.done(next.lesson.id);
          coach.step(1);
        }
      };
      show();
      v.cup = cupFor(g);
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

/** The game's clock across a test's runs. */
let clock = 0;

/** Steps the coach and the lessons together for `seconds`, as the game's frames do; returns the line's pace each frame. */
function run(coach, v, memory, seconds, dt = 1 / 60) {
  const paces = [];
  for (let t = 0; t < seconds; t += dt) {
    clock += dt;
    paces.push(coach.step(dt) / dt);
    followLessons(coach, v, memory, clock);
  }
  return paces;
}

test("the line slows while a station is taught and is back to speed once it is done", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  const g = guest(order);
  const v = view({ guests: [g], tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 1);
  assert.equal(coach.current?.id, "ticket");
  assert.equal(memory.cue.at.kind, "ticket");
  assert.ok(Math.abs(coach.scale - WALK_SLOW) < 0.02, "the guests wait at half speed");
  // Taken: done, and the next station's line takes over at once.
  coach.done("ticket");
  v.cup = cupFor(g);
  run(coach, v, memory, 0.1);
  assert.equal(coach.current?.id, "syrup");
  // The last pump: done, and the line comes back to speed while the cup moves on.
  coach.done("syrup");
  v.cup.busy = true;
  const paces = run(coach, v, memory, 1);
  assert.ok(paces.at(-1) > 0.95, `back to speed, ${paces.at(-1)}`);
  assert.equal(coach.current, null);
});

test("a station's lesson whose moment passes comes down uncounted, and the next drink teaches it", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  coach.skip("ticket");
  const g = guest(order);
  const v = view({ guests: [g], cup: cupFor(g), tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "syrup");
  // A tap pressed early: the cup jumps to the pour, short on syrup and ice.
  v.cup.station = "pour";
  run(coach, v, memory, 0.1);
  assert.equal(coach.current?.id, "pour");
  assert.equal(coach.learned("syrup"), false);
  // Dumped: nothing left to teach on this drink, and nothing stays slowed.
  v.cup = null;
  const paces = run(coach, v, memory, 0.8);
  assert.equal(coach.current, null);
  assert.ok(paces.at(-1) > 0.95);
  assert.equal(coach.learned("pour"), false);
  // The next drink teaches the syrup again.
  const next = guest(order);
  v.guests = [next];
  v.cup = cupFor(next);
  run(coach, v, memory, 0.1);
  assert.equal(coach.current?.id, "syrup");
});

test("a station left unanswered stands down for the shift, so the line never stays slowed", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  coach.skip("ticket");
  const g = guest(order);
  const v = view({ guests: [g], cup: cupFor(g) });
  const paces = run(coach, v, memory, WALK_WAIT + 1);
  assert.ok(WALK_WAIT <= 7, "about seven seconds at most");
  assert.equal(coach.current, null);
  assert.ok(paces.at(-1) > 0.95);
  assert.equal(coach.learned("syrup"), false, "uncounted");
  // Not offered again this shift, on this drink or the next.
  run(coach, v, memory, 2);
  assert.equal(coach.current, null);
  const next = guest(order);
  v.guests = [next];
  v.cup = cupFor(next);
  run(coach, v, memory, 0.5);
  assert.equal(coach.current, null);
  // Nor does it hold the later things back: with the rest known, the tip
  // jar is named while the syrup is still to go in.
  for (const id of ["ice", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  v.jar = 2;
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "tipjar");
  v.jar = 0;
  coach.dismiss();
  // A new shift tries again.
  memory.held.clear();
  coach.reset();
  run(coach, v, memory, 0.1);
  assert.equal(coach.current?.id, "syrup");
});

test("the pour's line follows the tea once the tap is held, and stays up through the hold", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup"]) coach.skip(id);
  const g = guest(order);
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "pour" }, tapIndex: TEAS.indexOf("matcha") });
  run(coach, v, memory, 0.5);
  assert.deepEqual(memory.cue.at, { kind: "step", index: CARD_STEPS.indexOf("pour"), guest: -1 });
  v.holding = true;
  coach.acted("pour");
  const moved = followLessons(coach, v, memory, clock);
  assert.equal(moved, true, "measured again at its new target");
  assert.equal(memory.cue.at.kind, "line");
  const paces = run(coach, v, memory, WALK_WAIT + 1);
  assert.equal(coach.current?.id, "pour", "a long hold never stands it down");
  assert.ok(paces.at(-1) > 0.95, "and the line is at speed while the tap runs");
});

test("a thing never takes over from a station, but a station takes over from a thing", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  // The receipt is named, at full speed.
  const v = view({ receipt: { sentBack: false, combo: 0 } });
  run(coach, v, memory, 0.2);
  assert.equal(coach.current?.id, "serve");
  assert.equal(coach.current.slow ?? 1, 1, "named at full speed");
  // The next ticket is taken while the line is still up (the receipt stays):
  // the ice, a station still to teach, takes over at once.
  const g = guest(order);
  v.guests = [g];
  v.cup = { ...cupFor(g), station: "ice" };
  run(coach, v, memory, 0.1);
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
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  // The receipt cleared at once (the next ticket taken straight away): down, uncounted.
  const v = view({ receipt: { sentBack: false, combo: 0 } });
  run(coach, v, memory, 0.3);
  assert.equal(coach.current?.id, "serve");
  v.receipt = null;
  run(coach, v, memory, 0.1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("serve"), false, "the next hand-off says it again");
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


test("things come one at a time, with a little quiet between them", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  // The first hand-off: the receipt, coins in the jar, and a special on the rail, all at once.
  const v = view({ receipt: { sentBack: false, combo: 0 }, jar: 3, guests: [guest({ ...order, tea: "taro" })], special: "taro" });
  const shown = [];
  let quietFor = 0;
  let last = null;
  for (let t = 0; t < 3 * (THING_LIFE + THING_GAP) + 2; t += 1 / 60) {
    clock += 1 / 60;
    coach.step(1 / 60);
    followLessons(coach, v, memory, clock);
    const id = coach.current?.id ?? null;
    if (id && id !== last) {
      shown.push({ id, quiet: quietFor });
      quietFor = 0;
    }
    if (!id) quietFor += 1 / 60;
    last = id;
  }
  assert.deepEqual(
    shown.map((item) => item.id),
    ["serve", "tipjar", "special"],
  );
  for (const item of shown.slice(1)) assert.ok(item.quiet >= THING_GAP - 0.05, `${item.id} after ${item.quiet.toFixed(2)} s of quiet`);
});

test("the receipt's line follows the last station at once", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake"]) coach.skip(id);
  const g = guest(order);
  const v = view({ guests: [g], cup: { ...cupFor(g), station: "seal" } });
  run(coach, v, memory, 0.5);
  assert.equal(coach.current?.id, "seal");
  coach.done("seal");
  v.cup.stampAt = clock;
  run(coach, v, memory, 0.7);
  // Served: the cup is gone and the receipt is up.
  v.cup = null;
  v.guests = [];
  v.receipt = { sentBack: false, combo: 0 };
  run(coach, v, memory, 0.6);
  assert.equal(coach.current?.id, "serve");
});

test("a thing holds until it is continued, and continuing counts it", () => {
  const coach = createCoach("orders", { persist: false });
  const memory = lessonMemory();
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
  const v = view({ jar: 3 });
  run(coach, v, memory, THING_LIFE - 1);
  assert.equal(coach.current?.id, "tipjar", "still up, at full speed");
  assert.equal(coach.scale, 1);
  // Continue (Enter, or the slip's button) is coach.done.
  coach.done("tipjar");
  assert.ok(coach.learned("tipjar"));
  run(coach, v, memory, 1);
  assert.equal(coach.current, null);
});

test("a thing comes down as the hands reach the pour, the ladle or the sealer", () => {
  for (const station of ["pour", "scoop", "seal"]) {
    const coach = createCoach("orders", { persist: false });
    const memory = lessonMemory();
    for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
    const g = guest(order);
    const v = view({ guests: [g], cup: { ...cupFor(g), station: "shake" }, jar: 3, jarIndex: TOPPINGS.indexOf("jelly") });
    run(coach, v, memory, 0.5);
    assert.equal(coach.current?.id, "tipjar", "named at the shake");
    // Too soon to have been read: down, uncounted, so it comes again.
    v.cup.station = station;
    run(coach, v, memory, 0.1);
    assert.equal(coach.current, null, station);
    assert.equal(coach.learned("tipjar"), false);
    // Named once a shift: not again in this one.
    v.cup.station = "shake";
    run(coach, v, memory, THING_GAP + 1);
    assert.equal(coach.current, null);
    // Next shift, read first, then the pour: it counts, and fades.
    const shift = lessonMemory();
    run(coach, v, shift, LESSONS.tipjar.minLife + 0.5);
    assert.equal(coach.current?.id, "tipjar");
    v.cup.station = station;
    run(coach, v, shift, 0.1);
    assert.ok(coach.learned("tipjar"), station);
  }
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
  for (const id of ["ticket", "ice", "syrup", "pour", "jar", "drop", "shake", "seal"]) coach.skip(id);
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
