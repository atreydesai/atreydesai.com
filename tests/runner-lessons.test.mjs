import assert from "node:assert/strict";
import test from "node:test";

import { STEP, newRun, step } from "../src/lib/arcade/runner-engine.js";
import { botInput, createBot } from "../src/lib/arcade/runner-bot.js";
import { LESSONS, MOVE_LEAD, lessonAhead } from "../src/lib/arcade/runner-lessons.js";

const VIEW = 600;

/**
 * Runs the bot on a seed, asking for lessons each frame as the game does,
 * and "learning" each the moment it is first cued. Returns every first cue.
 */
function firstCues(seed, seconds = 70) {
  const state = newRun(seed);
  const bot = createBot();
  const learned = new Set();
  const cues = [];
  for (let t = 0; t < seconds && state.status !== "over"; t += STEP) {
    const cue = lessonAhead(state, (id) => learned.has(id), { view: VIEW });
    if (cue && !learned.has(cue.lesson.id)) {
      learned.add(cue.lesson.id);
      const x = state.runner.x;
      const to = cue.ghost ? cue.ghost.takeoff : x;
      const between =
        state.chunks.flatMap((c) => c.gaps).filter((g) => g.x1 > x && g.x0 < to).length +
        state.chunks
          .flatMap((c) => c.items)
          .filter((it) => "x0" in it && !it.hit && !it.broken && it.x1 > x + 2 && it.x0 < to && ["ac", "tank", "crate", "clothesline", "billboard", "wire", "skylight", "neon", "steam"].includes(it.type)).length;
      cues.push({ cue, x, v: state.runner.vx, at: t, between });
    }
    step(state, botInput(bot, state), STEP);
  }
  return cues;
}

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of Object.values(LESSONS)) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
  }
});

test("a first run teaches jumping before anything else needs a move", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const cues = firstCues(seed, 40);
    const moves = cues.filter((c) => c.cue.lesson.move && c.cue.lesson.id !== "rush");
    assert.ok(moves.length > 0, `seed ${seed} taught no move`);
    assert.equal(moves[0].cue.lesson.id, "jump", `seed ${seed} first taught ${moves[0].cue.lesson.id}`);
  }
});

test("a move is taught while there is still time to make it", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const { cue, x, v } of firstCues(seed)) {
      if (!cue.ghost) continue;
      const lead = (cue.ghost.takeoff - x) / v;
      assert.ok(lead > 0.2, `seed ${seed}: ${cue.lesson.id} cued ${lead.toFixed(2)} s before its take-off`);
      assert.ok(lead <= MOVE_LEAD + 0.05, `seed ${seed}: ${cue.lesson.id} cued ${lead.toFixed(2)} s early`);
      assert.ok(cue.ghost.path.length >= 3, `seed ${seed}: ${cue.lesson.id} has too short a ghost path`);
      assert.ok(cue.clear > cue.ghost.takeoff, `seed ${seed}: ${cue.lesson.id} is cleared before its take-off`);
    }
  }
});

test("the opening introduces pearls and a customer", () => {
  const ids = new Set(firstCues(3, 30).map((c) => c.cue.lesson.id));
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

test("a hazard about to be met is named before the power-up", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const state = newRun(seed);
    const bot = createBot();
    for (let t = 0; t < 90 && state.status !== "over"; t += STEP) {
      const cue = lessonAhead(state, (id) => id !== "rush" && id !== "hazard", { view: VIEW });
      if (cue?.lesson.id === "rush") {
        const r = state.runner;
        const ahead = lessonAhead(state, (id) => id !== "hazard", { view: VIEW });
        if (ahead?.lesson.id === "hazard") assert.ok((ahead.near ?? ahead.x) >= r.x + r.vx * MOVE_LEAD, `seed ${seed}: rush named with a hazard ${((ahead.clear - r.x) / r.vx).toFixed(2)} s ahead`);
      }
      step(state, botInput(bot, state), STEP);
    }
  }
});

test("a move is never cued past a gap, or anything else, the runner must get past first", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const { cue, between } of firstCues(seed)) {
      if (!cue.ghost || cue.lesson.id === "jump" || cue.lesson.id === "hold" || cue.lesson.id === "glide") continue;
      assert.equal(between, 0, `seed ${seed}: ${cue.lesson.id} cued across a gap`);
    }
  }
});
