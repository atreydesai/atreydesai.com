import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_TIME, STEP, cloneRun, newRun, speedAt, step } from "../src/lib/arcade/runner-engine.js";
import { botInput, createBot } from "../src/lib/arcade/runner-bot.js";
import { LESSONS, MOVE_LEAD, MOVE_STOP, THING_LEAD, lessonAhead, moveAhead, placeCallout } from "../src/lib/arcade/runner-lessons.js";

const VIEW = 600;

/**
 * Runs the bot on a seed, asking for lessons each step as the game does,
 * and "learning" each the moment it is first cued. Like a player who hasn't
 * learned a move yet, the bot waits for the post of a move coming up rather
 * than make it early. Returns every first cue, with the run as it was then.
 */
function firstCues(seed, seconds = 70, { expert = false } = {}) {
  const state = newRun(seed, { expert });
  const bot = createBot();
  const learned = new Set();
  const known = (id) => learned.has(id);
  const cues = [];
  for (let t = 0; t < seconds && state.status !== "over"; t += STEP) {
    const cue = lessonAhead(state, known, { view: VIEW });
    if (cue && !learned.has(cue.lesson.id)) {
      learned.add(cue.lesson.id);
      const x = state.runner.x;
      const to = cue.ghost ? cue.ghost.takeoff : x;
      const between =
        state.chunks.flatMap((c) => c.gaps).filter((g) => g.x1 > x && g.x0 < to).length +
        state.chunks
          .flatMap((c) => c.items)
          .filter((it) => "x0" in it && !it.hit && !it.broken && it.x1 > x + 2 && it.x0 < to && ["ac", "tank", "crate", "clothesline", "billboard", "wire", "skylight", "neon", "steam"].includes(it.type)).length;
      cues.push({ cue, x, v: state.runner.vx, at: t, between, state: cloneRun(state) });
    }
    const keys = botInput(bot, state);
    const pending = moveAhead(state, known);
    if (pending && pending.post > state.runner.x) keys.jump = keys.down = false;
    step(state, keys, STEP);
  }
  return cues;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const runs = new Map();
/** Each seed's first cues, run once and shared by the tests below. */
const cuesOf = (seed, expert = false) => {
  const key = `${seed}${expert ? "x" : ""}`;
  if (!runs.has(key)) runs.set(key, firstCues(seed, 70, { expert }));
  return runs.get(key);
};

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of Object.values(LESSONS)) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
  }
});

test("every lesson pauses play, and waits to be continued or made", () => {
  for (const lesson of Object.values(LESSONS)) {
    assert.equal(lesson.slow, 0, `${lesson.id} slows play instead of pausing it`);
    assert.equal(lesson.life, Infinity, `${lesson.id} ends by itself`);
  }
});

test("a first run teaches jumping before anything else needs a move", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const moves = cuesOf(seed).filter((c) => c.cue.lesson.move && c.cue.lesson.id !== "rush");
    assert.ok(moves.length > 0, `seed ${seed} taught no move`);
    assert.equal(moves[0].cue.lesson.id, "jump", `seed ${seed} first taught ${moves[0].cue.lesson.id}`);
  }
});

test("a move is taught at its post, the moment to make it, not before", () => {
  for (const expert of [false, true]) {
    for (const seed of SEEDS) {
      for (const { cue, x, v } of cuesOf(seed, expert)) {
        if (!cue.ghost) continue;
        const lead = (cue.ghost.takeoff - x) / v;
        assert.ok(lead >= -0.025, `seed ${seed}: ${cue.lesson.id} cued ${(-lead).toFixed(3)} s past its post`);
        assert.ok(lead <= MOVE_STOP + 0.01, `seed ${seed}: ${cue.lesson.id} cued ${lead.toFixed(3)} s before its post`);
        assert.ok(cue.ghost.path.length >= 3, `seed ${seed}: ${cue.lesson.id} has too short a ghost path`);
        assert.ok(cue.clear > cue.ghost.takeoff, `seed ${seed}: ${cue.lesson.id} is cleared before its take-off`);
        // The ghost runs in real time: each point later than the last.
        for (let i = 1; i < cue.ghost.path.length; i++) assert.ok(cue.ghost.path[i].t > cue.ghost.path[i - 1].t, `seed ${seed}: ${cue.lesson.id}'s ghost runs backwards`);
      }
    }
  }
});

test("the move made from its post, as the ghost makes it, gets past what it is for", () => {
  const taught = new Set();
  for (const expert of [false, true]) {
    for (const seed of SEEDS) {
      for (const { cue, state } of cuesOf(seed, expert)) {
        if (!cue.ghost) continue;
        const s = cloneRun(state);
        // Play eases to rest on the post, never past it.
        while (s.runner.x + s.runner.vx * STEP <= cue.ghost.takeoff) step(s, {}, STEP);
        const id = cue.lesson.id;
        const seen = new Set();
        const bad = [];
        for (let t = 0; t < 2.5; t += STEP) {
          const input =
            id === "jump"
              ? { jump: t < STEP * 4 }
              : id === "hold"
                ? { jump: t < HOLD_TIME }
                : id === "glide"
                  ? { jump: t < (cue.ghost.release ?? Infinity) }
                  : id === "slide"
                    ? { down: t < 0.5 }
                    : { down: t < STEP };
          for (const e of step(s, input, STEP)) {
            seen.add(e.type);
            if (["fall", "hit", "lethal", "wall"].includes(e.type)) bad.push(e.type);
          }
          if (s.runner.x > cue.clear + 20 && s.runner.grounded) break;
        }
        const where = `${expert ? "expert " : ""}seed ${seed}: ${id}`;
        assert.deepEqual(bad, [], `${where} from its post ran into trouble`);
        assert.ok(s.runner.x > cue.clear, `${where} never got past`);
        if (id === "glide") assert.ok(seen.has("glide"), `${where} never glided`);
        if (id === "slam") assert.ok(seen.has("smash"), `${where} never broke the crates`);
        taught.add(id);
      }
    }
  }
  for (const id of ["jump", "hold", "slide", "slam", "glide"]) assert.ok(taught.has(id), `${id} was never taught`);
});

test("a thing is named as it becomes relevant, not as it comes into view", () => {
  for (const seed of SEEDS) {
    for (const { cue, x, v } of cuesOf(seed)) {
      if (cue.ghost || cue.onRunner) continue;
      const off = ((cue.near ?? cue.x) - x) / v;
      // Pigeons just before they take off; barrels and drones by how fast they close; anything else at THING_LEAD.
      const most = cue.lesson.id === "pigeons" ? 0.86 : cue.item ? 0.95 : THING_LEAD + 0.01;
      assert.ok(off <= most, `seed ${seed}: ${cue.lesson.id} named ${off.toFixed(2)} s off`);
      assert.ok(off >= 0.14, `seed ${seed}: ${cue.lesson.id} named only ${off.toFixed(2)} s off`);
    }
  }
});

test("the opening introduces pearls and a customer", () => {
  const ids = new Set(cuesOf(3).map((c) => c.cue.lesson.id));
  assert.ok(ids.has("pearls"), "pearls were never introduced");
  assert.ok(ids.has("customer"), "the customer was never introduced");
});

test("a learned lesson is never cued again", () => {
  const state = newRun(4);
  const bot = createBot();
  const all = new Set(Object.keys(LESSONS));
  for (let t = 0; t < 30; t += STEP) {
    assert.equal(lessonAhead(state, (id) => all.has(id), { view: VIEW }), null);
    step(state, botInput(bot, state), STEP);
  }
});

test("the power-up isn't named with a hazard close, since it can't smash one", () => {
  for (const seed of SEEDS) {
    const state = newRun(seed);
    const bot = createBot();
    for (let t = 0; t < 90 && state.status !== "over"; t += STEP) {
      const cue = lessonAhead(state, (id) => id !== "rush" && id !== "hazard", { view: VIEW });
      if (cue?.lesson.id === "rush") {
        const r = state.runner;
        const near = state.chunks.flatMap((c) => [
          ...c.gaps.filter((g) => g.assist === "rail").map((g) => g.x0),
          ...c.items.filter((it) => ["wire", "skylight", "neon"].includes(it.type) && !it.hit).map((it) => it.x0),
        ]);
        for (const x0 of near) assert.ok(x0 <= r.x || x0 > r.x + r.vx * MOVE_LEAD, `seed ${seed}: rush named with a hazard ${((x0 - r.x) / r.vx).toFixed(2)} s ahead`);
      }
      step(state, botInput(bot, state), STEP);
    }
  }
});

test("a move is never cued past a gap, or anything else, the runner must get past first", () => {
  for (const seed of SEEDS) {
    for (const { cue, between } of cuesOf(seed)) {
      // The slam is taught in the air over the very crates it breaks.
      if (!cue.ghost || cue.lesson.id === "slam") continue;
      assert.equal(between, 0, `seed ${seed}: ${cue.lesson.id} cued across a gap`);
    }
  }
});

// --- Where the callout goes ---------------------------------------------------

/** A desktop and a phone, laid out as the game lays them out. */
const SCREENS = {
  desktop: { w: 1440, h: 900, top: 80, bottom: 812, lead: 0.28, wide: true, slip: { w: 304, h: 86 }, avoid: [{ x: 252, y: 820, w: 300, h: 64 }] },
  laptop: { w: 1024, h: 700, top: 80, bottom: 612, lead: 0.28, wide: true, slip: { w: 304, h: 86 }, avoid: [{ x: 136, y: 620, w: 300, h: 64 }] },
  phone: {
    w: 390,
    h: 844,
    top: 88,
    bottom: 660,
    lead: 0.2,
    wide: false,
    slip: { w: 304, h: 104 },
    avoid: [
      { x: 117, y: 712, w: 132, h: 112 },
      { x: 20, y: 756, w: 80, h: 68 },
      { x: 266, y: 736, w: 104, h: 88 },
      { x: 282, y: 668, w: 88, h: 56 },
    ],
  },
};

/** The game's camera on a run: the scale that keeps the course ahead in view, the ground a little under the runner. */
function cameraFor(state, screen) {
  const r = state.runner;
  const baseS = Math.min(screen.w / (screen.wide ? 560 : 300), (screen.bottom - screen.top) / 230);
  const speed = speedAt(r.x, state.expert) * (state.rush > 0 ? 1.2 : 1);
  const S = Math.min(baseS, (screen.w * (1 - screen.lead)) / (speed * 1.1 + 24));
  const camLeft = r.x - (screen.lead * screen.w) / S;
  const focusY = screen.top + (screen.bottom - screen.top) * 0.6;
  let ground = r.y;
  if (!r.grounded) {
    for (const c of state.chunks) for (const roof of c.roofs) if (r.x >= roof.x0 - 40 && r.x <= roof.x1 + 40) ground = Math.min(ground, roof.top);
  }
  const camY = ground + 12;
  return { sx: (x) => (x - camLeft) * S, sy: (y) => focusY - (y - camY) * S, S, runner: { x: r.x, y: r.y } };
}

test("the callout never covers the runner or its thing, nor (with room) the way ahead", () => {
  const covered = { way: 0, all: 0 };
  for (const [name, screen] of Object.entries(SCREENS)) {
    for (const seed of SEEDS) {
      for (const { cue, state } of cuesOf(seed)) {
        const cam = cameraFor(state, screen);
        const view = { w: screen.w, h: screen.h, top: screen.top + 8 };
        const placed = placeCallout(cue, state, cam, screen.slip, view, screen.avoid);
        const { box } = placed;
        const hits = placed.keep.filter((k) => {
          const m = k.margin ?? 6;
          return box.x < k.x + k.w + m && box.x + box.w > k.x - m && box.y < k.y + k.h + m && box.y + box.h > k.y - m;
        });
        const where = `${name} seed ${seed}: ${cue.lesson.id} (${placed.spot.side})`;
        for (const k of hits) assert.ok(k.what !== "runner" && k.what !== "thing", `${where} covers the ${k.what}`);
        assert.ok(box.x >= 16 && box.x + box.w <= screen.w - 12 && box.y >= view.top && box.y + box.h <= screen.h - 12, `${where} runs off the screen`);
        covered.all += 1;
        if (hits.some((k) => k.what === "way")) covered.way += 1;
        if (name !== "phone") assert.ok(!hits.some((k) => k.what === "way"), `${where} covers the way ahead`);
      }
    }
  }
  // On a phone the slip is most of the screen's width: rarely, it has to sit on some of the way.
  assert.ok(covered.way <= covered.all * 0.1, `${covered.way} of ${covered.all} callouts cover the way ahead`);
});
