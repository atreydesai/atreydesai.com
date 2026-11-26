import assert from "node:assert/strict";
import test from "node:test";

import {
  CATCH_RULES,
  PLAYFIELD_EDGE,
  PLAYFIELD_TOP,
  bounceHorizontal,
  catchGolden,
  createLives,
  difficultyAt,
  dropPearl,
  isGoldenSpawn,
  planThrow,
  predictLanding,
  reachSeconds,
  throwVelocity,
  volleySize,
} from "../src/lib/boba-engine.js";
import {
  FREEZE_MIN,
  GHOST_SPEED,
  HOLD,
  LESSONS,
  MOVE_LATEST,
  MOVE_START,
  PAUSE_SLACK,
  REST,
  SETTLE,
  SLIP_REACH,
  basketPlaces,
  catchMoved,
  catchPlaces,
  choosePlace,
  coverCost,
  cupPlaces,
  flightPath,
  ghostAt,
  keepOff,
  lessonNow,
  linkPlaces,
  mayOffer,
  mayPause,
  onSpot,
  slipBox,
} from "../src/lib/arcade/catch-lessons.js";
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
/** Shift seconds the basket takes to cross the page. */
const ACROSS = reachSeconds(WIDTH);
/** Shift seconds a hand at a slip's Continue button, beside `cup`, needs to get back under it. */
const backFromSlip = (cup) => reachSeconds(Math.min(WIDTH, Math.abs(cup.landCenter - cup.x) + SLIP_REACH));

/** The next cup down, worked out here on its own (not with the module's helper), to check the lessons against. */
function soonestDown(cups) {
  let down = null;
  for (const cup of cups) if (!cup.passed && (!down || cup.landAt < down.landAt)) down = cup;
  return down;
}

/**
 * Plays a shift the way CatchGame does, one frame of real time at a time,
 * with the real coach stopping it: links glow and throw, cups fly, and each
 * frame asks `lessonNow` what to teach and ends lessons as the component
 * does (the catch's freeze ends with the basket's move, the catch is
 * learned when that cup is caught, taken down when it goes past the basket
 * or after `HOLD`; a lesson whose cup is overtaken by a later throw stands
 * down; the pearl still drops when the cup leaves the page, and its line
 * only stops play while that is fair).
 *
 * A hand on the mouse heads for the next cup down at the fairness rule's
 * speed, frozen or not (the basket follows the pointer all the while);
 * throws numbered in `drop` fall through it. A `still` hand never moves; a
 * `novice` one moves only for the cup the catch is being shown on, until it
 * has caught one; a `follower` goes for whatever cup a lesson is about while
 * it is up, and is quick otherwise; a `reacher` takes the mouse as far as
 * the slip's Continue button could be while a line about a thing is up (the
 * far end of a slip beside its cup, away from where the cup lands, or the
 * far side of the page) and presses it there; a `sweep` one
 * swings across the page and back without stopping. A player who `reads`
 * presses Continue once a lesson has been up that many seconds; `known`
 * starts with every lesson learned. `replay` throws exactly the cups another
 * shift threw (its `throws`), at the same times on the shift's clock, so two
 * hands can be compared cup for cup.
 *
 * Returns every lesson offered, in order (how long it stayed up and
 * readable, how long play stood still for it, whether it was acted on or
 * continued, how many cups would land before its own, and when in real time
 * its cup came down), every cup thrown, the numbers of the cups missed, and
 * how often a lesson was still up on a cup that a later throw had overtaken.
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
  const moment = { now: 0, cups, waiting, pearlDown: false, pearlsComeBack: rules.goldensToRestore > 0, width: WIDTH };
  const offers = [];
  const throws = [];
  const queued = [];
  /**
   * When a cup of each sort was first the next one down with time to stop
   * play for a line about it, while nothing was up and play had rested: the
   * moment its lesson should come.
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
  let quiet = Infinity;
  let settled = 0;
  let catchFor = 0;
  let freezeFrom = basket;
  let sweep = 1;
  let nextQueued = 0;
  let nextThrow = 0;
  /** Where a reacher is taking the mouse for the slip's button, while it is. */
  let edge = null;

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
      leftStopped: null,
      needStopped: null,
      cup,
      spawn,
      acted: false,
      actedAge: null,
      stopped: 0,
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
      for (const spawn of waiting) spawn.remaining -= dt;
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
          const cup = { x: spawn.x, y: spawn.y, vx: plan.vx, vy: plan.vy, gravity: difficulty.gravity, golden: spawn.golden, kind: plan.kind, volley: spawn.volley, landAt: plan.landAt, landCenter: plan.landCenter, number: spawn.number, thrownAt: elapsed, passed: false, retaught: false };
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
    const explaining = coach.current && !coach.leaving && !coach.acting ? coach.current : null;
    const reaching = hand === "reacher" && explaining !== null && !explaining.move;
    let next = null;
    if (reaching) {
      // Off to the slip's button: as far along a slip beside its cup as it
      // goes, away from the landing, or the far side of the page.
      if (edge === null) {
        const down = soonestDown(cups);
        const about = cue?.cup && cue.lesson === explaining ? cue.cup : null;
        const half = rules.basketWidth / 2;
        if (about) {
          const away = about.landCenter > about.x ? -1 : 1;
          edge = Math.min(WIDTH - half, Math.max(half, about.x + away * SLIP_REACH));
        } else {
          const from = down ? down.landCenter : basket;
          edge = from < WIDTH / 2 ? WIDTH - half : half;
        }
      }
      basket += Math.sign(edge - basket) * Math.min(Math.abs(edge - basket), REACH_SPEED * FRAME);
    } else {
      edge = null;
      if (hand === "sweep") {
        if (basket > WIDTH - 100) sweep = -1;
        if (basket < 100) sweep = 1;
        basket += sweep * 1200 * FRAME;
      } else if (hand === "novice" && !coach.learned("catch")) next = cue?.lesson.id === "catch" ? cue.cup : null;
      else if (hand === "follower" && cue?.cup && coach.current === cue.lesson && !coach.leaving) next = cue.cup;
      else if (hand !== "still") {
        for (const cup of cups) if (cup.landAt > elapsed - 0.1 && !drop.has(cup.number) && (!next || cup.landAt < next.landAt)) next = cup;
      }
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
        // As teachNow does: said at once, if play may stop now.
        if (lives.left > 0 && !cup.retaught && !learned("miss") && mayPause({ now: elapsed, cups, width: WIDTH })) offer(LESSONS.miss, null, null, cup.number);
      }
    }

    // As checkLessons does.
    quiet = coach.current ? 0 : quiet + FRAME;
    const current = coach.current;
    if (current?.move && !coach.leaving && cue?.lesson === current) {
      settled = cue.cup && onSpot(basket, cue.x, rules.basketWidth) ? settled + FRAME : 0;
      if (!coach.acting) {
        if (coach.age < FREEZE_MIN) freezeFrom = basket;
        if (catchMoved(coach.age, freezeFrom, basket, settled)) {
          coach.acted(current.id);
          offers.at(-1).acted = true;
          offers.at(-1).actedAge = coach.age;
        }
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
        if (down && down.landAt - elapsed >= backFromSlip(down) + PAUSE_SLACK) {
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
        if (offers.length > count && lesson.lesson.move) {
          catchFor = 0;
          freezeFrom = basket;
        }
      }
      if (!coach.current) cue = null;
    }
    // A player who has read enough presses Continue (a reacher once it is at the button).
    if (coach.current && !coach.leaving && !coach.acting && coach.age >= reads && (!reaching || basket === edge)) {
      offers.at(-1).continued = true;
      coach.done(coach.current.id);
    }

    const last = offers.at(-1);
    if (last && coach.current?.id === last.id) {
      last.until = real;
      if (!coach.fading) last.readable = real;
      if (coach.scale === 0) {
        last.stopped += FRAME;
        if (last.cup && last.leftStopped === null) {
          last.leftStopped = last.cup.landAt - elapsed;
          last.needStopped = backFromSlip(last.cup);
        }
      }
    }
  }
  return { offers, coach, firstChance, lives, missed, overtaken, throws, queued };
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

test("a first shift stops on the glowing link, then freezes the moment its cup is thrown, until the basket moves", () => {
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const reads of [Infinity, 0.8]) {
        const name = `${rules.expert ? "expert" : "normal"} seed ${seed}${reads < Infinity ? " reading" : ""}`;
        const { offers } = shift(rules, seed, 30, { reads });
        const glow = offers[0];
        assert.equal(glow?.id, "glow", `${name} opened on ${glow?.id}`);
        assert.ok(glow.at >= GO_SECONDS, `${name}: a lesson came up under "go"`);
        assert.equal(glow.spawn.number, 1, `${name}: the glow wasn't on the first link to light`);
        // Play stands still under the glow, the link still lit, until it is
        // continued (or has held as long as any line may).
        assert.ok(glow.stopped > 0, `${name}: play never stopped for the glow`);
        const held = reads < Infinity ? reads : HOLD;
        assert.ok(glow.spawn.thrownReal - glow.real >= held - FRAME, `${name}: the link threw ${(glow.spawn.thrownReal - glow.real).toFixed(2)} s after its line`);

        const taught = offers[1];
        assert.equal(taught?.id, "catch", `${name} taught ${taught?.id} second`);
        // On one of the first throw's cups, frozen the very frame it left its
        // link (not a moment before: there was no cup to move to), with its
        // whole flight still ahead.
        assert.ok(taught.cup.number <= 3, `${name}: taught on throw ${taught.cup.number}`);
        assert.ok(taught.at - taught.cup.thrownAt <= FRAME + 1e-9, `${name}: frozen ${(taught.at - taught.cup.thrownAt).toFixed(3)} s after its throw`);
        assert.ok(taught.left >= 1, `${name}: only ${taught.left.toFixed(2)} s of flight left to get under it`);
        // Frozen until the hand moves (it starts at once), never before the
        // freeze has held a moment; readable for its minimum, and made on
        // that very cup.
        assert.ok(taught.stopped > 0, `${name}: play never froze for the catch`);
        assert.ok(taught.acted && taught.actedAge >= FREEZE_MIN && taught.actedAge < FREEZE_MIN + 2 * FRAME, `${name}: the move was taken ${taught.actedAge?.toFixed(2)} s in`);
        assert.ok(taught.stopped <= FREEZE_MIN + 2 * FRAME, `${name}: play stood still ${taught.stopped.toFixed(2)} s for a hand already moving`);
        assert.ok(taught.readable - taught.real >= LESSONS.catch.minLife - FRAME, `${name}: readable for ${(taught.readable - taught.real).toFixed(2)} s`);
        assert.equal(taught.madeOn, taught.cup.number);
      }
    }
  }
});

test("the catch's freeze waits for a real move: a twitch or a sweep through doesn't count, and the ghost runs the move", () => {
  // Nothing counts before the freeze has held a moment.
  assert.equal(catchMoved(FREEZE_MIN - 0.01, 100, 400, 1), false);
  // A twitch doesn't; a move does, either way; a basket already waiting under the cup does.
  assert.equal(catchMoved(FREEZE_MIN, 100, 100 + MOVE_START - 1, 0), false);
  assert.equal(catchMoved(FREEZE_MIN, 100, 100 + MOVE_START, 0), true);
  assert.equal(catchMoved(FREEZE_MIN, 100, 100 - MOVE_START, 0), true);
  assert.equal(catchMoved(FREEZE_MIN, 100, 100, SETTLE), true);
  assert.equal(catchMoved(FREEZE_MIN, 100, 100, SETTLE - 0.01), false);
  // The ghost waits on the basket, runs to the landing at a hand's speed, waits there, and goes again.
  assert.equal(ghostAt(200, 800, 0), 200);
  let peak = 0;
  let previous = ghostAt(200, 800, 0);
  let arrived = null;
  for (let t = FRAME; t < 3; t += FRAME) {
    const x = ghostAt(200, 800, t);
    // (Back on the basket to go again, it is hidden under it.)
    if (x >= previous) peak = Math.max(peak, (x - previous) / FRAME);
    if (arrived === null && x === 800) arrived = t;
    previous = x;
  }
  assert.ok(arrived !== null && arrived < 2, "the ghost never reached the landing");
  assert.ok(peak <= GHOST_SPEED * 1.6, `the ghost ran at ${peak.toFixed(0)} px/s`);
  assert.ok(ghostAt(200, 800, 40) >= 200 && ghostAt(200, 800, 40) <= 800);
  // Under Reduce Motion it waits at the landing.
  for (const t of [0, 0.4, 1.3]) assert.equal(ghostAt(200, 800, t, true), 800);
  // A hand that never moves leaves the catch frozen until it times out, never longer.
  const idle = shift(normal, 2, 30, { hand: "still" });
  const taught = idle.offers.find((entry) => entry.id === "catch");
  assert.ok(taught && taught.timedOut && !taught.acted);
  assert.ok(taught.stopped <= HOLD + 2 * FRAME && taught.stopped >= HOLD - 0.5, `frozen ${taught.stopped.toFixed(2)} s`);
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

test("each new thing is named on the next cup down, the first time play may stop for it, with time to get back under it", () => {
  for (const [rules, seconds, least] of [[normal, 200, 8], [expert, 150, 6]]) {
    const taughtIn = { golden: 0, volley: 0, lob: 0, flick: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const name = `${rules.expert ? "expert" : "normal"} seed ${seed}`;
      const { offers, firstChance } = shift(rules, seed, seconds);
      for (const id of ["golden", "volley", "lob", "flick"]) {
        const entry = first(offers, id);
        assert.equal(LESSONS[id].slow, 0);
        // Never before such a cup was next down with time to stop for it…
        if (firstChance[id] === undefined) {
          assert.equal(entry, undefined, `${name}: ${id} taught with no chance to`);
          continue;
        }
        assert.ok(entry, `${name}: ${id} had its chance at ${firstChance[id].toFixed(1)} s and was never taught`);
        taughtIn[id] += 1;
        assert.ok(FITS[id](entry) && entry.next, `${name}: ${id} offered on the wrong cup`);
        // …and then at once (or something more pressing about the same cup took the stage then).
        const then = offers.find((other) => other.at >= firstChance[id] - 1e-9);
        assert.ok(then && then.at - firstChance[id] < 0.05, `${name}: ${id} first had its chance at ${firstChance[id].toFixed(1)} s, taught at ${entry.at.toFixed(1)} s`);
        // Measured, not worked out: play stood still for it, with that cup
        // still far enough off landing for a hand at the slip's button to get
        // back under it once play goes on.
        if (!entry.suspended) {
          assert.ok(entry.stopped > 0, `${name}: play never stopped for ${id}`);
          assert.ok(entry.leftStopped >= entry.needStopped, `${name}: ${id} stopped play with ${entry.leftStopped.toFixed(2)} s left on its cup`);
        }
      }
      // No pearl was down all shift, so the pearl-back line never showed.
      assert.equal(first(offers, "comeback"), undefined);
    }
    // Every new thing does get its line, on almost every shift.
    for (const [id, count] of Object.entries(taughtIn)) {
      assert.ok(count >= least, `${rules.expert ? "expert" : "normal"}: ${id} taught on only ${count} of 8 shifts`);
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

test("an explanation stops play until it is continued, or for at most its hold; a move until it is made", () => {
  let continued = 0;
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4]) {
      // A quick hand that never presses Continue: each line holds play
      // still for its hold, then goes; the catch only until the hand moves.
      const quick = shift(rules, seed, 120);
      for (const entry of quick.offers) {
        const limit = entry.id === "catch" ? FREEZE_MIN : HOLD;
        assert.ok(entry.stopped <= limit + 2 * FRAME, `seed ${seed}: ${entry.id} stopped play for ${entry.stopped.toFixed(2)} s`);
      }
      // A player who reads a line and presses Continue gets play back at once.
      const reader = shift(rules, seed, 120, { reads: 1.5 });
      continued += reader.offers.filter((entry) => entry.continued).length;
      for (const entry of reader.offers) {
        assert.ok(entry.stopped <= 1.5 + 2 * FRAME, `seed ${seed}: ${entry.id} stopped play ${entry.stopped.toFixed(2)} s for a reader`);
      }
      // A hand that never moves: the catch holds play frozen for its hold,
      // then waits for a later run; the shift still ends.
      const idle = shift(rules, seed, 120, { hand: "still" });
      const catches = idle.offers.filter((entry) => entry.id === "catch");
      assert.ok(catches.length >= 1);
      for (const entry of catches) assert.ok(entry.stopped <= HOLD + 2 * FRAME, `seed ${seed}: the catch froze play for ${entry.stopped.toFixed(1)} s`);
      assert.ok(idle.lives.left === 0 || idle.coach.learned("catch"), `seed ${seed}: an idle shift never ended`);
    }
  }
  assert.ok(continued > 10, "Continue never ended an explanation");
});

test("stopping to explain never costs a pearl: the same throws, followed lesson by lesson, lose no cup the plain shift kept", () => {
  let missLines = 0;
  for (const rules of [normal, expert]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 174, 232]) {
      const name = `${rules.expert ? "expert" : "normal"} seed ${seed}`;
      // The shift with nothing left to teach, then the very same throws again.
      const plain = shift(rules, seed, 90, { known: true });
      assert.equal(plain.offers.length, 0);
      assert.deepEqual(shift(rules, seed, 90, { known: true, replay: plain }).missed, plain.missed, `${name}: the replay isn't the same shift`);
      // Quick hands, hands that follow each lesson, and hands that take the
      // mouse to the far side of the page for Continue and come back.
      for (const options of [{}, { reads: 1 }, { hand: "follower" }, { hand: "follower", reads: 1.5 }, { hand: "reacher", reads: 0.5 }, { hand: "reacher", reads: 2 }]) {
        const taught = shift(rules, seed, 90, { ...options, replay: plain });
        assert.ok(taught.offers.length > 0);
        // Cup for cup: the same throws, in the same order.
        assert.deepEqual(
          taught.throws.map((thrown) => thrown.number),
          plain.throws.slice(0, taught.throws.length).map((thrown) => thrown.number),
        );
        const extra = taught.missed.filter((number) => !plain.missed.includes(number));
        assert.deepEqual(extra, [], `${name} ${options.hand ?? "quick"}${options.reads ? ` reading ${options.reads}` : ""}: lost cups ${extra.join(", ")} that the plain shift caught`);
      }
      // A cup let fall: the lost pearl's line stops play too, and a hand
      // that goes across the page for its Continue loses nothing more.
      const dropped = { drop: new Set([3, 4]) };
      const plainDrop = shift(rules, seed, 90, { ...dropped, known: true });
      const reacher = shift(rules, seed, 90, { ...dropped, hand: "reacher", reads: 1, replay: plainDrop });
      const extra = reacher.missed.filter((number) => !plainDrop.missed.includes(number));
      assert.deepEqual(extra, [], `${name} reacher with cups let fall: lost cups ${extra.join(", ")} that the plain shift caught`);
      missLines += reacher.offers.filter((entry) => entry.id === "miss" && entry.continued).length;
    }
  }
  assert.ok(missLines > 0, "no lost pearl's line was ever continued from across the page");
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
  const quiet = { now: 0, cups: [], waiting: [], pearlDown: false, pearlsComeBack: true, width: WIDTH };
  assert.equal(lessonNow(quiet, () => false), null);
  const cup = { x: 0, y: 0, golden: true, kind: "lob", volley: 0, landAt: 3, landCenter: 300 };
  const busy = { ...quiet, cups: [cup], waiting: [{ link: { x: 1, y: 1, width: 20, height: 10 }, remaining: 0.3 }], pearlDown: true };
  assert.equal(lessonNow(busy, () => true), null);
  assert.equal(lessonNow(busy, () => false)?.lesson.id, "catch");
  // Too close to landing to get there: the catch waits for the next cup.
  assert.equal(lessonNow({ ...busy, now: 3 - MOVE_LATEST + 0.01 }, (id) => id !== "catch"), null);
  // Every lesson stops play outright.
  for (const lesson of Object.values(LESSONS)) assert.equal(lesson.slow, 0, `${lesson.id} slows play instead of stopping it`);
  // Play stops for anything but a line about the next cup down only while
  // that cup could be reached from anywhere once play goes on…
  const edge = 3 - ACROSS - PAUSE_SLACK;
  assert.equal(mayPause({ ...busy, now: edge }), true);
  assert.equal(mayPause({ ...busy, now: edge + 0.01 }), false);
  assert.equal(mayPause(quiet), true);
  assert.equal(lessonNow({ ...busy, now: edge }, (id) => id === "catch")?.lesson.id, "glow");
  assert.equal(lessonNow({ ...busy, now: edge + 0.01 }, (id) => id === "catch")?.lesson.id, "golden");
  // …and for a line about it, while it could be reached from the slip beside it.
  const near = 3 - backFromSlip(cup) - PAUSE_SLACK;
  assert.ok(near > edge);
  assert.equal(mayPause({ ...busy, now: near }, cup), true);
  assert.equal(mayPause({ ...busy, now: near + 0.01 }, cup), false);
  assert.equal(lessonNow({ ...busy, now: near }, (id) => id === "catch" || id === "glow")?.lesson.id, "golden");
  assert.equal(lessonNow({ ...busy, now: near + 0.01 }, (id) => id === "catch" || id === "glow"), null);
  // A link about to throw isn't pointed at: it would throw as play stops.
  assert.equal(lessonNow({ ...quiet, waiting: [{ link: { x: 1, y: 1, width: 20, height: 10 }, remaining: 0.05 }] }, () => false), null);
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

/**
 * Random scenes on pages of several sizes: a cup thrown from somewhere on
 * the page, the basket somewhere on its row, and the slip at the sizes the
 * Coach draws (one row, or Continue wrapped under the line). Hands each to
 * `check` with what the component would build from it.
 */
function scenes(count, check) {
  const rand = seeded(21);
  for (const [width, height] of [[1280, 800], [1024, 700], [1920, 1080], [1440, 640]]) {
    const view = { width, height, top: PLAYFIELD_TOP + 8 };
    const basketY = height - 54 - 16;
    const catchLine = basketY + 6;
    const field = { catchLine, sprite: SPRITE, viewportWidth: width };
    for (let i = 0; i < count; i++) {
      const rules = i % 2 ? expert : normal;
      const w = rules.basketWidth;
      const box = (left) => ({ x0: left, y0: basketY, x1: left + w, y1: basketY + 54 });
      const throwCup = () => {
        const difficulty = difficultyAt(rand() * 300, rules);
        const spawn = { x: PLAYFIELD_EDGE + rand() * (width - 2 * PLAYFIELD_EDGE - SPRITE.width), y: 180 + rand() * Math.max(1, basketY - 330 - SPRITE.height) };
        const { vx, vy } = throwVelocity(difficulty, { spawnBottom: spawn.y + SPRITE.height, catchLine }, rand);
        return { ...spawn, vx, vy, gravity: difficulty.gravity };
      };
      /** A cup `along` (0..1) of the way through its flight, and the marks the slip keeps off. */
      const marksOf = (cup, along) => {
        const full = flightPath(cup, cup.gravity, field, []);
        const t = full.at(-1).t * along;
        const now = { ...cup, x: cup.x + cup.vx * t, y: cup.y + cup.vy * t + 0.5 * cup.gravity * t * t, vy: cup.vy + cup.gravity * t };
        bounceHorizontal(now, SPRITE.width, width);
        const arc = flightPath(now, cup.gravity, field, []);
        const land = Math.min(width - w, Math.max(0, arc.at(-1).x - w / 2));
        return { cup: now, marks: { box: { x0: now.x, y0: now.y, x1: now.x + SPRITE.width, y1: now.y + SPRITE.height }, arc, landing: box(land) } };
      };
      const size = i % 3 === 0 ? { w: 290, h: 52 } : { w: Math.min(304, width - 32), h: 84 };
      check({ view, size, w, box, throwCup, marksOf, rand });
    }
  }
}

/** Whether a slip at `box` covers anything it must never cover (everything but a cup's way down). */
const coversHard = (box, keep) => coverCost(box, keep.filter((thing) => thing.weight > 1)) > 0;

test("the catch's slip never covers the basket, its way to the landing, the cup or the landing, and keeps off the cup's way down", () => {
  let total = 0;
  let clear = 0;
  scenes(300, ({ view, size, w, box, throwCup, marksOf, rand }) => {
    const { cup, marks } = marksOf(throwCup(), 0);
    const basket = box(rand() * (view.width - w));
    const keep = keepOff({ basket, toward: marks.landing, cups: [marks], sprite: SPRITE });
    const place = choosePlace(catchPlaces(basket, marks.landing, size, view), keep, size, view);
    const slip = slipBox(place, size, view);
    assert.equal(slip.where, place.side, "the Coach would move the slip off its side");
    assert.ok(!coversHard(slip, keep), `the slip covers the basket, its way, the cup or the landing on a ${view.width}×${view.height} page`);
    total += 1;
    if (coverCost(slip, keep) === 0) clear += 1;
    // Beside the ghost basket on its far side, wherever that is clear: never between the baskets.
    const from = (basket.x0 + basket.x1) / 2;
    const to = (marks.landing.x0 + marks.landing.x1) / 2;
    if (slip.y1 > basket.y0) assert.ok(slip.x1 <= Math.min(from, to) - w / 2 || slip.x0 >= Math.max(from, to) + w / 2, "the slip sits on the basket's row between the baskets");
    void cup;
  });
  assert.equal(clear, total, `the slip crossed the cup's way down in ${total - clear} of ${total} throws`);
});

test("a slip about a cup in the air never covers the cup, the basket, its way or the landing, and keeps off the cup's way down", () => {
  let total = 0;
  let clear = 0;
  scenes(300, ({ view, size, w, box, throwCup, marksOf, rand }) => {
    const { cup, marks } = marksOf(throwCup(), rand() * 0.6);
    const basket = box(rand() * (view.width - w));
    const keep = keepOff({ basket, toward: marks.landing, cups: [marks], sprite: SPRITE });
    const center = { x: cup.x + SPRITE.width / 2, y: cup.y + SPRITE.height / 2 };
    const place = choosePlace(cupPlaces(center, cup.vx, 30, view), keep, size, view);
    const slip = slipBox(place, size, view);
    assert.equal(slip.where, place.side);
    assert.ok(!coversHard(slip, keep), `the slip covers the cup, the basket, its way or the landing on a ${view.width}×${view.height} page`);
    total += 1;
    if (coverCost(slip, keep) === 0) clear += 1;
  });
  assert.equal(clear, total, `the slip crossed the cup's way down in ${total - clear} of ${total} scenes`);
});

test("a slip about the basket or a link keeps off the basket, the link, and where the next cup comes down", () => {
  let total = 0;
  let clear = 0;
  scenes(200, ({ view, size, w, box, throwCup, marksOf, rand }) => {
    const basket = box(rand() * (view.width - w));
    const cups = Array.from({ length: Math.floor(rand() * 4) }, () => marksOf(throwCup(), rand() * 0.8));
    const next = cups.length ? cups.reduce((a, b) => (a.marks.arc.at(-1).t <= b.marks.arc.at(-1).t ? a : b)) : null;
    const marks = cups.map((entry) => entry.marks);
    // The basket's own line, beside it and away from where it has to go next.
    const keep = keepOff({ basket, toward: next?.marks.landing ?? null, cups: marks, sprite: SPRITE });
    const toward = next ? (next.marks.landing.x0 + next.marks.landing.x1) / 2 : null;
    const place = choosePlace(basketPlaces(basket, toward, view), keep, size, view);
    const slip = slipBox(place, size, view);
    assert.equal(slip.where, place.side);
    assert.ok(!coversHard(slip, keep), "a line about the basket covers the basket, its way, a cup or a landing");
    total += 1;
    if (coverCost(slip, keep) === 0) clear += 1;
    // A link's line, beside the link.
    const link = { x: 60 + rand() * (view.width - 120), y: view.top + 40 + rand() * (view.height - view.top - 260), width: 30 + rand() * 160, height: 18 };
    const linkBox = { x0: link.x - link.width / 2, y0: link.y - link.height / 2, x1: link.x + link.width / 2, y1: link.y + link.height / 2 };
    const linkKeep = keepOff({ basket, cups: marks, things: [linkBox], sprite: SPRITE });
    const ring = Math.round(Math.min(56, Math.max(18, Math.max(link.width / 2, link.height))));
    const linkPlace = choosePlace(linkPlaces(link, ring, Math.round(link.width / 2), view), linkKeep, size, view);
    const linkSlip = slipBox(linkPlace, size, view);
    assert.ok(coverCost(linkSlip, [{ ...linkBox, weight: 1 }]) === 0, "a link's line covers the link");
  });
  // (With up to three cups in the air, very rarely no place is clear of all their ways down.)
  assert.ok(clear / total >= 0.99, `a line about the basket crossed a cup's way down in ${total - clear} of ${total} scenes`);
});

test("the slip lands where the Coach would put it: beside its anchor, or on the other side when it won't fit", () => {
  const view = { width: 1280, height: 800, top: PLAYFIELD_TOP + 8 };
  const size = { w: 300, h: 60 };
  // Unmarked, it sits 20px off the anchor, centred on it.
  assert.deepEqual(slipBox({ x: 600, y: 400, side: "right" }, size, view), { x0: 620, y0: 370, x1: 920, y1: 430, where: "right" });
  assert.deepEqual(slipBox({ x: 600, y: 400, side: "above" }, size, view), { x0: 450, y0: 320, x1: 750, y1: 380, where: "above" });
  // Round a ring, it clears the ring.
  assert.equal(slipBox({ x: 600, y: 400, side: "left", ring: 30 }, size, view).x1, 600 - 34.5 - 14);
  // Too near the edge for its side: the other side, as the Coach does.
  assert.equal(slipBox({ x: 1100, y: 400, side: "right" }, size, view).where, "left");
  // A choice never takes a side the Coach would flip.
  const place = choosePlace([{ x: 1100, y: 400, side: "right" }, { x: 1100, y: 400, side: "left" }], [], size, view);
  assert.equal(place.side, "left");
});
