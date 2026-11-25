import assert from "node:assert/strict";
import test from "node:test";

import {
  CATCH_RULES,
  PLAYFIELD_EDGE,
  bounceHorizontal,
  catchGolden,
  createLives,
  difficultyAt,
  dropPearl,
  isGoldenSpawn,
  planThrow,
  predictLanding,
  volleySize,
} from "../src/lib/boba-engine.js";
import { HOLD, LESSONS, MOVE_LATEST, READ_TIME, REST, SETTLE, SLOW, flightPath, lessonNow, mayOffer, onSpot } from "../src/lib/arcade/catch-lessons.js";
import { createCoach } from "../src/lib/arcade/core/coach.ts";

const normal = CATCH_RULES.normal;
const expert = CATCH_RULES.expert;

/** A small seeded generator, so random throws are repeatable. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 1280 × 800 page, laid out the way CatchGame lays it out.
const WIDTH = 1280;
const HEIGHT = 800;
const SPRITE = { width: 35, height: 50 };
const BASKET_Y = HEIGHT - 54 - 16;
const CATCH_LINE = BASKET_Y + 6;
const GO_SECONDS = 0.62;
const FRAME = 1 / 60;
const REACH_SPEED = 2400;

/** The next cup down, worked out here on its own (not with the module's helper), to check the lessons against. */
function soonestDown(cups) {
  let down = null;
  for (const cup of cups) if (!cup.passed && (!down || cup.landAt < down.landAt)) down = cup;
  return down;
}

/**
 * Plays a shift the way CatchGame does, one frame of real time at a time,
 * with the real coach slowing it: links glow and throw, cups fly, and each
 * frame asks `lessonNow` what to teach and ends lessons as the component
 * does (the catch is made when the basket settles under the cup, learned
 * when that cup is caught, taken down when it goes past the basket or after
 * `HOLD`; a lesson whose cup is overtaken by a later throw stands down; the
 * pearl still drops when the cup leaves the page).
 *
 * A hand on the mouse heads for the next cup down at the fairness rule's
 * speed; throws numbered in `drop` fall through it. A `still` hand never
 * moves; a `novice` one moves only for the cup the catch is being shown
 * on, until it has caught one; a `follower` goes for whatever cup a lesson
 * is about while it is up, and is quick otherwise; a `sweep` one swings
 * across the page and back without stopping. A player who `reads` presses
 * Continue once a lesson has been up that many seconds; `known` starts with
 * every lesson learned. `replay` throws exactly the cups another shift
 * threw (its `throws`), at the same times on the shift's clock, so two
 * hands can be compared cup for cup.
 *
 * Returns every lesson offered, in order (how long it stayed up and
 * readable, whether it was acted on or continued, how many cups would land
 * before its own, and when in real time its cup came down), every cup
 * thrown, the numbers of the cups missed, and how often a lesson was still
 * up on a cup that a later throw had overtaken.
 */
function shift(rules, seed, seconds, { drop = new Set(), hand = "quick", reads = Infinity, known = false, replay = null } = {}) {
  const rand = seeded(seed);
  const field = { catchLine: CATCH_LINE, sprite: SPRITE, viewportWidth: WIDTH, basketWidth: rules.basketWidth };
  const coach = createCoach("catch", { persist: false });
  if (known) for (const id of Object.keys(LESSONS)) coach.skip(id);
  const timedOut = new Set();
  const learned = (id) => coach.learned(id) || timedOut.has(id);
  const waiting = [];
  const cups = [];
  const moment = { now: 0, cups, waiting, pearlDown: false, pearlsComeBack: rules.goldensToRestore > 0 };
  const offers = [];
  const throws = [];
  const queued = [];
  /**
   * When a cup of each sort was first the next one down with time to read
   * a line about it, while nothing was up and play had rested: the moment
   * its lesson should come.
   */
  const firstChance = {};
  const missed = [];
  let overtaken = 0;
  let cue = null;
  let real = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let spawnNumber = 0;
  let volleys = 0;
  let basket = WIDTH / 2;
  let lives = createLives(rules);
  let slowSince = null;
  let longestSlow = 0;
  let quiet = Infinity;
  let settled = 0;
  let catchFor = 0;
  let sweep = 1;
  let nextQueued = 0;
  let nextThrow = 0;

  const offer = (lesson, cup, spawn, about = null, { force = false } = {}) => {
    const current = coach.current;
    const age = coach.age;
    const rested = lesson.id === "miss" ? Infinity : quiet;
    if (!force && (lesson.id === current?.id || !mayOffer(lesson, current, age, rested, coach.leaving))) return;
    if (!coach.offer(lesson)) return;
    const x = lesson.id === "catch" ? flightPath(cup, cup.gravity, field, []).at(-1).x : 0;
    cue = { lesson, cup, spawn, x };
    const down = cup ? soonestDown(cups) : null;
    const before = (other) => other !== cup && !other.passed && other.landAt < cup.landAt && (lesson.id !== "volley" || other.volley === cup.volley);
    offers.push({
      id: lesson.id,
      at: elapsed,
      real,
      until: real,
      readable: real,
      earlier: cup ? cups.filter(before).length : 0,
      next: cup ? down === cup : null,
      about,
      left: cup ? cup.landAt - elapsed : null,
      cup,
      spawn,
      acted: false,
      retarget: force,
      before: current?.id ?? null,
      beforeAge: age,
      pearlDown: lives.left < lives.max,
    });
  };
  const lessonCupDown = (cup) => {
    for (const entry of offers) if (entry.cup === cup && entry.downReal === undefined) entry.downReal = real;
  };
  // As revalidateCue does: a lesson on a cup a later throw lands before stands down.
  const revalidate = () => {
    if (!cue?.cup || coach.current !== cue.lesson || coach.leaving || stillNextHere(cue.cup)) return;
    offers.at(-1).suspended = true;
    const move = cue.lesson.move;
    coach.dismiss();
    cue = null;
    if (!move) return;
    const down = soonestDown(cups);
    if (down && down.landAt - elapsed >= MOVE_LATEST) offer(LESSONS.catch, down, null, null, { force: true });
  };
  const stillNextHere = (cup) => !cup.passed && soonestDown(cups) === cup;

  while (elapsed < seconds && lives.left > 0) {
    const dt = coach.step(FRAME, FRAME);
    real += FRAME;
    elapsed += dt;
    const difficulty = difficultyAt(elapsed, rules);
    let launched = false;

    if (replay) {
      while (nextQueued < replay.queued.length && replay.queued[nextQueued].at <= elapsed) {
        waiting.push({ ...replay.queued[nextQueued++] });
      }
      while (nextThrow < replay.throws.length && replay.throws[nextThrow].at <= elapsed) {
        const thrown = replay.throws[nextThrow++];
        const index = waiting.findIndex((spawn) => spawn.number === thrown.number);
        const spawn = index >= 0 ? waiting.splice(index, 1)[0] : null;
        // Thrown a moment late by this shift's frames: moved on to where it is now.
        const late = elapsed - thrown.at;
        const cup = { ...thrown.cup, passed: false, retaught: false };
        cup.vy += cup.gravity * late;
        cup.x += cup.vx * late;
        cup.y += cup.vy * late;
        cups.push(cup);
        throws.push(thrown);
        launched = true;
        if (spawn && cue?.spawn?.number === spawn.number) {
          cue.spawn = null;
          if (coach.current === cue.lesson && learned("catch")) coach.done(cue.lesson.id);
        }
      }
    } else {
      spawnTimer += dt;
      const inPlay = cups.length + waiting.length;
      if (spawnTimer >= difficulty.spawnInterval) {
        if (inPlay < difficulty.maxActive) {
          spawnTimer -= difficulty.spawnInterval;
          const size = Math.min(volleySize(difficulty, rand), difficulty.maxActive - inPlay);
          const volley = size > 1 ? ++volleys : 0;
          for (let i = 0; i < size; i++) {
            spawnNumber += 1;
            const x = 40 + rand() * (WIDTH - 115);
            const y = 180 + rand() * 420;
            const spawn = {
              x,
              y,
              remaining: difficulty.telegraph + i * 0.12,
              held: 0,
              golden: isGoldenSpawn(spawnNumber),
              number: spawnNumber,
              volley,
              link: { x: x + SPRITE.width / 2, y: y + SPRITE.height / 2, width: 64, height: 18 },
            };
            waiting.push(spawn);
            queued.push({ ...spawn, at: elapsed });
          }
        } else spawnTimer = difficulty.spawnInterval;
      }

      for (let i = 0; i < waiting.length; i++) {
        const spawn = waiting[i];
        spawn.remaining -= dt;
        if (spawn.remaining > 0) continue;
        const others = cups.filter((cup) => cup.landAt > elapsed).map((cup) => ({ time: cup.landAt, center: cup.landCenter }));
        const plan = planThrow(difficulty, spawn, field, others, elapsed, rand);
        if (!plan && spawn.held < 1.2) {
          spawn.held += 0.08;
          spawn.remaining = 0.08;
          continue;
        }
        waiting.splice(i--, 1);
        spawn.thrownReal = real;
        if (plan) {
          const cup = { x: spawn.x, y: spawn.y, vx: plan.vx, vy: plan.vy, gravity: difficulty.gravity, golden: spawn.golden, kind: plan.kind, volley: spawn.volley, landAt: plan.landAt, landCenter: plan.landCenter, number: spawn.number, passed: false, retaught: false };
          cups.push(cup);
          throws.push({ at: elapsed, number: spawn.number, cup: { ...cup } });
          launched = true;
        }
        if (cue?.spawn === spawn) {
          cue.spawn = null;
          if (coach.current === cue.lesson && (!plan || learned("catch"))) coach.done(cue.lesson.id);
        }
      }
    }
    if (launched) {
      revalidate();
      // Checked here on its own: no lesson is left up on a cup that a later throw lands before.
      if (cue?.cup && coach.current === cue.lesson && !coach.leaving && soonestDown(cups) !== cue.cup) overtaken += 1;
    }

    // The hand: toward the next cup down, as fast as the fairness rule allows.
    // (A frame's slack on the landing time, as the cup comes down a hair after its plan.)
    let next = null;
    if (hand === "sweep") {
      if (basket > WIDTH - 100) sweep = -1;
      if (basket < 100) sweep = 1;
      basket += sweep * 1200 * FRAME;
    } else if (hand === "novice" && !coach.learned("catch")) next = cue?.lesson.id === "catch" ? cue.cup : null;
    else if (hand === "follower" && cue?.cup && coach.current === cue.lesson && !coach.leaving) next = cue.cup;
    else if (hand !== "still") {
      for (const cup of cups) if (cup.landAt > elapsed - 0.1 && !drop.has(cup.number) && (!next || cup.landAt < next.landAt)) next = cup;
    }
    if (next) {
      const gap = next.landCenter - basket;
      basket += Math.sign(gap) * Math.min(Math.abs(gap), REACH_SPEED * FRAME);
    }

    const left = basket - rules.basketWidth / 2;
    for (let i = cups.length - 1; i >= 0; i--) {
      const cup = cups[i];
      cup.vy += cup.gravity * dt;
      cup.x += cup.vx * dt;
      cup.y += cup.vy * dt;
      bounceHorizontal(cup, SPRITE.width, WIDTH);
      const bottom = cup.y + SPRITE.height;
      const center = cup.x + SPRITE.width / 2;
      const caught =
        !drop.has(cup.number) && cup.vy > 0 && bottom - cup.vy * dt <= CATCH_LINE && bottom >= CATCH_LINE && center >= left && center <= left + rules.basketWidth;
      if (caught) {
        cups.splice(i, 1);
        lessonCupDown(cup);
        if (coach.current?.id === "catch") {
          if (cue?.cup === cup && !coach.leaving) {
            coach.done("catch");
            offers.at(-1).madeOn = cup.number;
          }
        } else coach.done("catch");
        if (cue?.cup === cup) {
          if (coach.current === cue.lesson && !cue.lesson.move) coach.done(cue.lesson.id);
          cue.cup = null;
        }
        if (cup.golden) lives = catchGolden(lives, rules).lives;
        continue;
      }
      if (!cup.passed && cup.vy > 0 && bottom >= CATCH_LINE) {
        // Past the basket: a lesson about it is over now.
        cup.passed = true;
        lessonCupDown(cup);
        if (cue?.cup === cup) {
          if (coach.current === cue.lesson && !coach.leaving && cue.lesson.move) {
            coach.dismiss();
            cue = null;
            cup.retaught = true;
          } else {
            if (coach.current === cue.lesson && !coach.leaving) coach.done(cue.lesson.id);
            cue.cup = null;
          }
        }
      }
      if (cup.y > HEIGHT + 10) {
        cups.splice(i, 1);
        missed.push(cup.number);
        lives = dropPearl(lives);
        if (lives.left > 0 && !cup.retaught) offer(LESSONS.miss, null, null, cup.number);
      }
    }

    // As checkLessons does.
    quiet = coach.current ? 0 : quiet + FRAME;
    const current = coach.current;
    if (current?.move && !coach.leaving && cue?.lesson === current) {
      settled = cue.cup && onSpot(basket, cue.x, rules.basketWidth) ? settled + FRAME : 0;
      if (!coach.acting && settled >= SETTLE) {
        coach.acted(current.id);
        offers.at(-1).acted = true;
      }
      catchFor += FRAME;
      if (catchFor >= HOLD) {
        offers.at(-1).timedOut = true;
        coach.dismiss();
        cue = null;
        timedOut.add(current.id);
      }
    } else if (elapsed >= GO_SECONDS) {
      settled = 0;
      moment.now = elapsed;
      moment.pearlDown = lives.left < lives.max;
      if (!coach.current && quiet >= REST && learned("catch")) {
        const down = soonestDown(cups);
        if (down && down.landAt - elapsed >= READ_TIME * SLOW + 0.16 * (1 - SLOW) + 0.05) {
          const paired = down.volley > 0 && cups.some((other) => other !== down && other.volley === down.volley && !other.passed);
          for (const sort of [down.golden ? "golden" : "", paired ? "volley" : "", down.kind]) {
            if (sort && firstChance[sort] === undefined) firstChance[sort] = elapsed;
          }
        }
      }
      const lesson = lessonNow(moment, learned);
      if (lesson) {
        const count = offers.length;
        offer(lesson.lesson, lesson.cup, lesson.spawn);
        if (offers.length > count && lesson.lesson.move) catchFor = 0;
      }
      if (!coach.current) cue = null;
    }
    // A player who has read enough presses Continue.
    if (coach.current && !coach.leaving && !coach.acting && coach.age >= reads) {
      offers.at(-1).continued = true;
      coach.done(coach.current.id);
    }

    const last = offers.at(-1);
    if (last && coach.current?.id === last.id) {
      last.until = real;
      if (!coach.fading) last.readable = real;
    }
    if (coach.scale < 0.95) {
      slowSince ??= real;
      longestSlow = Math.max(longestSlow, real - slowSince);
    } else slowSince = null;
  }
  return { offers, coach, firstChance, longestSlow, lives, missed, overtaken, throws, queued };
}

const first = (offers, id) => offers.find((entry) => entry.id === id);

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of Object.values(LESSONS)) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
  }
});

test("a first shift lights the glow, then teaches the catch on the first cup, slowly", () => {
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const name = `${rules.expert ? "expert" : "normal"} seed ${seed}`;
      const { offers } = shift(rules, seed, 20);
      assert.equal(offers[0]?.id, "glow", `${name} opened on ${offers[0]?.id}`);
      assert.ok(offers[0].at >= GO_SECONDS, `${name}: a lesson came up under "go"`);
      assert.equal(offers[0].spawn.number, 1, `${name}: the glow wasn't on the first link to light`);
      // The link stays lit, in slow motion, long enough to see it throw.
      assert.ok(offers[0].spawn.thrownReal - offers[0].real > 0.6, `${name}: the link threw ${(offers[0].spawn.thrownReal - offers[0].real).toFixed(2)} s after its line`);

      const catchOffer = offers[1];
      assert.equal(catchOffer?.id, "catch", `${name} taught ${catchOffer?.id} second`);
      // The glow's line was read before the catch took over…
      assert.equal(catchOffer.before, "glow");
      assert.ok(catchOffer.beforeAge >= LESSONS.glow.minLife, `${name}: the glow was cut off after ${catchOffer.beforeAge.toFixed(2)} s`);
      // …and the cup it teaches on is one of the first throw's, still well up.
      assert.ok(catchOffer.cup.number <= 3, `${name}: taught on throw ${catchOffer.cup.number}`);
      assert.ok(catchOffer.left >= 1, `${name}: only ${catchOffer.left.toFixed(2)} s of flight left to get under it`);
      // It stays readable (not yet fading) for its minimum even for a hand
      // already there, play comes back to speed once the hand has settled
      // under the cup, and it is made on that very cup.
      assert.ok(catchOffer.readable - catchOffer.real >= LESSONS.catch.minLife - FRAME, `${name}: readable for ${(catchOffer.readable - catchOffer.real).toFixed(2)} s`);
      assert.ok(catchOffer.acted, `${name}: the catch was never made`);
      assert.equal(catchOffer.madeOn, catchOffer.cup.number);
    }
  }
});

test("a catch made is learned; a cup let fall takes its lesson down and the next cup down teaches it again", () => {
  const made = shift(normal, 3, 12);
  assert.equal(made.offers.filter((entry) => entry.id === "catch").length, 1);
  assert.ok(made.coach.learned("catch"));

  for (const seed of [1, 2, 3, 4, 5]) {
    // A new hand that only moves for the cup it is shown, and lets that first one fall.
    const fell = shift(normal, seed, 30, { drop: new Set([1]), hand: "novice" });
    const [glow, taught] = fell.offers;
    assert.equal(glow.id, "glow");
    assert.equal(taught.id, "catch");
    assert.equal(taught.cup.number, 1);
    // It came down as cup 1 went past the basket, and the catch is shown
    // again on the next cup down that can still be reached.
    const again = fell.offers.slice(2).find((entry) => entry.id === "catch");
    assert.ok(again, `seed ${seed}: the catch was never shown again`);
    assert.ok(again.cup.number > 1 && again.left >= MOVE_LATEST && again.earlier === 0);
    assert.ok(again.madeOn === again.cup.number && fell.coach.learned("catch"), `seed ${seed}: the catch was never made`);
    // Cup 1's lost pearl gets no line of its own: the catch was the lesson there.
    assert.equal(fell.offers.find((entry) => entry.id === "miss" && entry.about === 1), undefined);
  }
});

/** What each lesson about a cup must be about. */
const FITS = {
  catch: () => true,
  golden: (entry) => entry.cup.golden,
  comeback: (entry) => entry.cup.golden && entry.pearlDown,
  volley: (entry) => entry.cup.volley > 0,
  lob: (entry) => entry.cup.kind === "lob",
  flick: (entry) => entry.cup.kind === "flick",
};

test("every lesson about a cup is about the next cup down, and stands down if a later throw lands first", () => {
  let suspended = 0;
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 174, 232]) {
      for (const options of [{ drop: new Set([1]), hand: "novice" }, { drop: new Set([1, 2]), hand: "novice" }, { hand: "still" }, { hand: "follower" }, {}]) {
        const name = `${rules.expert ? "expert" : "normal"} seed ${seed} ${options.hand ?? "quick"}`;
        const run = shift(rules, seed, rules.expert ? 60 : 120, options);
        for (const entry of run.offers) {
          if (!entry.cup) continue;
          // At the moment it is offered: the right lesson for that cup, and that cup the next one down.
          assert.ok(FITS[entry.id](entry), `${name}: ${entry.id} offered on cup ${entry.cup.number}, which isn't one`);
          assert.ok(entry.next && entry.earlier === 0, `${name}: ${entry.id} offered on cup ${entry.cup.number} with ${entry.earlier} to land before it`);
          if (entry.suspended) suspended += 1;
        }
        // Rechecked after every throw: never still up on a cup that another now lands before.
        assert.equal(run.overtaken, 0, `${name}: a lesson stayed up on an overtaken cup`);
      }
    }
  }
  assert.ok(suspended > 0, "no lesson was ever overtaken, so standing down is untested");
});

test("each new thing is named on the next cup down, slowly, with a second of real time before that cup comes down", () => {
  for (const [rules, seconds] of [[normal, 200], [expert, 90]]) {
    for (const seed of [1, 2, 3, 4]) {
      const name = `${rules.expert ? "expert" : "normal"} seed ${seed}`;
      const { offers, firstChance } = shift(rules, seed, seconds);
      for (const id of ["golden", "volley", "lob", "flick"]) {
        const entry = first(offers, id);
        assert.ok(entry, `${name}: ${id} was never taught`);
        assert.equal(LESSONS[id].slow, SLOW);
        assert.ok(FITS[id](entry) && entry.next, `${name}: ${id} offered on the wrong cup`);
        // Measured, not worked out: real time from the line to its cup coming down.
        if (!entry.suspended) {
          assert.ok(entry.downReal - entry.real >= READ_TIME - FRAME, `${name}: ${id} up ${(entry.downReal - entry.real).toFixed(2)} s before its cup came down`);
        }
        // Taught the first time such a cup was next down with nothing else up
        // (or something more pressing about the same cup took the stage then).
        const then = offers.find((other) => other.at >= firstChance[id] - 1e-9);
        assert.ok(then && then.at - firstChance[id] < 0.05, `${name}: ${id} first had its chance at ${firstChance[id].toFixed(1)} s, taught at ${entry.at.toFixed(1)} s`);
      }
      // No pearl was down all shift, so the pearl-back line never showed.
      assert.equal(first(offers, "comeback"), undefined);
    }
  }
});

test("the pearl-back line shows on a golden cup only while a pearl is down, and never on expert", () => {
  for (const seed of [1, 2, 3]) {
    // The third cup falls: a pearl is down well before the golden cups come.
    const { offers } = shift(normal, seed, 60, { drop: new Set([3]) });
    const golden = first(offers, "golden");
    const comeback = first(offers, "comeback");
    assert.ok(golden && comeback, `seed ${seed}: ${golden ? "comeback" : "golden"} never taught`);
    assert.ok(comeback.real > golden.real, "points first, then the pearl back");
    assert.ok(comeback.cup.golden && comeback.pearlDown);
  }
  for (const seed of [1, 2, 3]) {
    const { offers } = shift(expert, seed, 90, { drop: new Set([3]) });
    assert.ok(first(offers, "golden"), `expert seed ${seed}: golden never taught`);
    assert.equal(first(offers, "comeback"), undefined, `expert seed ${seed}: promised a pearl back`);
  }
});

test("an explanation holds play slow until it is read, its cup comes down, or it runs out; never longer", () => {
  let continued = 0;
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4]) {
      // A quick hand that never presses Continue: each line ends with its
      // cup, or after its hold.
      const quick = shift(rules, seed, 120);
      assert.ok(quick.longestSlow < HOLD + 1, `seed ${seed}: slow for ${quick.longestSlow.toFixed(1)} s with a quick hand`);
      for (const entry of quick.offers) {
        const up = entry.until - entry.real;
        assert.ok(up <= (entry.cup ? Math.min(HOLD, entry.left / SLOW) : HOLD) + 1, `seed ${seed}: ${entry.id} held play for ${up.toFixed(1)} s`);
      }
      // A player who reads a line and presses Continue gets the speed back at once.
      const reader = shift(rules, seed, 120, { reads: 1.5 });
      continued += reader.offers.filter((entry) => entry.continued).length;
      assert.ok(reader.longestSlow < 1.5 * 2 + 1, `seed ${seed}: slow for ${reader.longestSlow.toFixed(1)} s after Continue`);
      // A hand that never moves: each catch lesson comes down when its cup
      // goes past, and a later cup teaches it again; the shift still ends.
      const idle = shift(rules, seed, 120, { hand: "still" });
      const catches = idle.offers.filter((entry) => entry.id === "catch");
      assert.ok(catches.length >= 1);
      for (const entry of catches) {
        const up = entry.until - entry.real;
        assert.ok(up <= Math.min(HOLD, entry.left / SLOW + 1) + FRAME * 2, `seed ${seed}: the catch held play for ${up.toFixed(1)} s`);
      }
      assert.ok(idle.lives.left === 0 || idle.coach.learned("catch"), `seed ${seed}: an idle shift never ended`);
    }
  }
  assert.ok(continued > 10, "Continue never ended an explanation");
});

test("slowing to explain never costs a pearl: the same throws, followed lesson by lesson, lose no cup the plain shift kept", () => {
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 174, 232]) {
      const name = `${rules.expert ? "expert" : "normal"} seed ${seed}`;
      // The shift with nothing left to teach, then the very same throws again.
      const plain = shift(rules, seed, 90, { known: true });
      assert.equal(plain.offers.length, 0);
      assert.deepEqual(shift(rules, seed, 90, { known: true, replay: plain }).missed, plain.missed, `${name}: the replay isn't the same shift`);
      for (const options of [{}, { hand: "follower" }, { hand: "follower", reads: 1.5 }]) {
        const taught = shift(rules, seed, 90, { ...options, replay: plain });
        assert.ok(taught.offers.length > 0);
        // Cup for cup: the same throws, in the same order.
        assert.deepEqual(
          taught.throws.map((thrown) => thrown.number),
          plain.throws.slice(0, taught.throws.length).map((thrown) => thrown.number),
        );
        const extra = taught.missed.filter((number) => !plain.missed.includes(number));
        assert.deepEqual(extra, [], `${name} ${options.hand ?? "quick"}${options.reads ? " reading" : ""}: lost cups ${extra.join(", ")} that the plain shift caught`);
      }
    }
  }
});

test("a move waits for the line already up to be read; a thing waits for a rest", () => {
  const glow = LESSONS.glow;
  assert.equal(mayOffer(LESSONS.catch, null, 0), true);
  assert.equal(mayOffer(LESSONS.catch, glow, glow.minLife - 0.1), false);
  assert.equal(mayOffer(LESSONS.catch, glow, glow.minLife), true);
  assert.equal(mayOffer(LESSONS.glow, glow, 0), true);
  // A thing never cuts in, and waits for a rest of full-speed play after the last line.
  assert.equal(mayOffer(LESSONS.golden, glow, 10), false);
  assert.equal(mayOffer(LESSONS.golden, null, 0, REST - 0.1), false);
  assert.equal(mayOffer(LESSONS.golden, null, 0, REST), true);
  assert.equal(mayOffer(LESSONS.golden, null, 0), true);
  // The basket is at the spot once the cup will land well inside it.
  assert.equal(onSpot(500, 520, 78), true);
  assert.equal(onSpot(500, 530, 78), false);
  // Nothing to teach before a cup or a glow, and nothing once all is known.
  const quiet = { now: 0, cups: [], waiting: [], pearlDown: false, pearlsComeBack: true };
  assert.equal(lessonNow(quiet, () => false), null);
  const cup = { x: 0, y: 0, golden: true, kind: "lob", volley: 0, landAt: 3, landCenter: 300 };
  const busy = { ...quiet, cups: [cup], waiting: [{ link: { x: 1, y: 1, width: 20, height: 10 } }], pearlDown: true };
  assert.equal(lessonNow(busy, () => true), null);
  assert.equal(lessonNow(busy, () => false)?.lesson.id, "catch");
  // Too close to landing to get there: the catch waits for the next cup.
  assert.equal(lessonNow({ ...busy, now: 3 - MOVE_LATEST + 0.01 }, (id) => id !== "catch"), null);
});

test("the chalk is the cup's planned arc, and the cup really flies along it", () => {
  const rand = seeded(9);
  const field = { catchLine: CATCH_LINE, sprite: SPRITE, viewportWidth: WIDTH };
  const points = [];
  let bounced = 0;
  for (let i = 0; i < 300; i++) {
    const gravity = difficultyAt(rand() * 400, normal).gravity;
    const cup = { x: 40 + rand() * 1100, y: 180 + rand() * 420, vx: (rand() - 0.5) * 900, vy: -150 - rand() * 400 };
    flightPath(cup, gravity, field, points);
    // It ends on the landing the engine planned, where the ghost basket waits.
    const planned = predictLanding(cup, gravity, CATCH_LINE, SPRITE, WIDTH);
    const end = points.at(-1);
    assert.equal(end.y, CATCH_LINE);
    assert.equal(end.x, planned.center);
    assert.equal(end.t, planned.time);
    for (let k = 1; k < points.length; k++) {
      assert.ok(points[k].t > points[k - 1].t && points[k].d >= points[k - 1].d);
      assert.ok(points[k].x >= PLAYFIELD_EDGE + SPRITE.width / 2 - 1e-9 && points[k].x <= WIDTH - PLAYFIELD_EDGE - SPRITE.width / 2 + 1e-9);
    }
    // Fly the cup the way the game does, a frame at a time: it stays on the
    // chalk, give or take what a frame's step and a wall's clamp move it.
    const body = { ...cup };
    let k = 0;
    let walls = 0;
    for (let t = FRAME; body.y + SPRITE.height < CATCH_LINE; t += FRAME) {
      body.vy += gravity * FRAME;
      body.x += body.vx * FRAME;
      body.y += body.vy * FRAME;
      const heading = Math.sign(body.vx);
      bounceHorizontal(body, SPRITE.width, WIDTH);
      if (Math.sign(body.vx) !== heading) walls += 1;
      if (t > end.t) break;
      while (points[k + 1].t < t) k += 1;
      const a = points[k];
      const b = points[k + 1];
      const f = (t - a.t) / (b.t - a.t);
      const dx = Math.abs(a.x + (b.x - a.x) * f - (body.x + SPRITE.width / 2));
      const dy = Math.abs(a.y + (b.y - a.y) * f - (body.y + SPRITE.height));
      // (Near a wall the chalk's straight dashes cut the bounce's corner.)
      const nearWall = Math.min(body.x - PLAYFIELD_EDGE, WIDTH - PLAYFIELD_EDGE - SPRITE.width - body.x) < 16;
      assert.ok(dx <= 2 + (walls + (nearWall ? 1 : 0)) * 16, `${dx.toFixed(1)} px off the chalk sideways`);
      assert.ok(dy <= 1 + 0.5 * gravity * FRAME * t, `${dy.toFixed(1)} px off the chalk`);
    }
    if (walls) bounced += 1;
  }
  assert.ok(bounced > 20, "too few throws met a wall to prove the bounce");
  // The array is reused: a shorter flight leaves it shorter, with no stale points.
  const before = points.length;
  flightPath({ x: 600, y: 600, vx: 0, vy: 0 }, 500, field, points);
  assert.ok(points.length < before && points.at(-1).y === CATCH_LINE);
});
