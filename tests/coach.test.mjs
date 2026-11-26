import assert from "node:assert/strict";
import test from "node:test";

import { createCoach } from "../src/lib/arcade/core/coach.ts";

const JUMP = { id: "jump", text: "hop the crate", keys: ["Space"], slow: 0.2, life: Infinity };

function run(coach, seconds, dt = 1 / 60) {
  let game = 0;
  for (let t = 0; t < seconds; t += dt) game += coach.step(dt);
  return game;
}

test("a lesson eases play into slow motion and back out once it is done", () => {
  const coach = createCoach("runner", { persist: false });
  assert.equal(coach.offer(JUMP), true);
  run(coach, 1);
  assert.ok(Math.abs(coach.scale - 0.2) < 0.01, `slowed to ${coach.scale}`);
  coach.done("jump");
  assert.equal(coach.leaving, true);
  run(coach, 1.5);
  assert.equal(coach.scale, 1);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("jump"), true);
  assert.equal(coach.offer(JUMP), false, "a learned lesson is not shown again");
});

test("a slow device still slows: the scale applies to the game's own capped step", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer(JUMP);
  for (let i = 0; i < 20; i++) coach.step(0.2, 0.05);
  const game = coach.step(0.2, 0.05);
  assert.ok(game < 0.02, `a 5 fps frame ran ${game} game seconds`);
});

test("game time runs slower than real time while a lesson holds", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer(JUMP);
  const game = run(coach, 2);
  assert.ok(game < 0.7, `two real seconds ran ${game.toFixed(2)} game seconds`);
});

test("one lesson at a time, and a lesson done before it shows is skipped", () => {
  const coach = createCoach("runner", { persist: false });
  coach.done("slide");
  assert.equal(coach.learned("slide"), true);
  coach.offer(JUMP);
  assert.equal(coach.offer({ id: "glide", text: "glide" }), false);
  assert.equal(coach.current.id, "jump");
});

test("a move nobody makes ends after its life uncounted, to be taught again", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "slam", text: "Slam it.", move: true, life: 2, slow: 0.3 });
  run(coach, 3);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("slam"), false);
  assert.equal(coach.scale > 0.9, true, "play is back at speed");
});

test("a move being attempted isn't ended by its life; the game judges it", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "slam", text: "Slam it.", move: true, life: 1, slow: 0.3 });
  coach.acted("slam");
  run(coach, 2);
  assert.equal(coach.current?.id, "slam");
  assert.equal(coach.learned("slam"), false);
});

test("a lesson nobody does still ends after its life, and counts as seen", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "pearls", text: "pearls fill the sugar", life: 2 });
  run(coach, 3);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("pearls"), true);
});

test("a lesson asked for twice shows until it has been done twice", () => {
  const coach = createCoach("runner", { persist: false });
  const twice = { ...JUMP, times: 2 };
  coach.offer(twice);
  coach.done("jump");
  run(coach, 2);
  assert.equal(coach.offer(twice), true);
  coach.done("jump");
  run(coach, 2);
  assert.equal(coach.offer(twice), false);
});

test("a done lesson stays up long enough to read", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ ...JUMP, minLife: 1 });
  coach.done("jump");
  run(coach, 0.5);
  assert.equal(coach.current?.id, "jump");
  run(coach, 0.9);
  assert.equal(coach.current, null);
});

test("a move takes over from a lesson that only names a thing, but not from a move", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "pearls", text: "Pearls fill the sugar meter.", minLife: 1 });
  run(coach, 1.2);
  assert.equal(coach.offer({ ...JUMP, move: true }), true);
  assert.equal(coach.current.id, "jump");
  assert.equal(coach.learned("pearls"), true, "a thing read long enough counts as seen");
  assert.equal(coach.offer({ id: "slide", text: "Slide under it.", move: true }), false);
});

test("a thing cut off before it could be read is shown again later", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "customer", text: "Run past the customer.", minLife: 1.5 });
  run(coach, 1 / 60);
  coach.offer({ ...JUMP, move: true });
  assert.equal(coach.learned("customer"), false);
});

test("a move made eases play back to speed, but only counts once it worked", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ ...JUMP, move: true });
  run(coach, 1);
  coach.acted("jump");
  run(coach, 1.5);
  assert.equal(coach.scale, 1, "play is back at speed while the jump plays out");
  assert.equal(coach.current?.id, "jump", "the lesson is still up");
  assert.equal(coach.learned("jump"), false);
  coach.dismiss();
  assert.equal(coach.offer({ ...JUMP, move: true }), true, "a jump that failed is taught again");
  coach.acted("jump");
  coach.done("jump");
  assert.equal(coach.learned("jump"), true);
});

test("a finished lesson fades before it goes, and a fresh run starts at full speed", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ ...JUMP, minLife: 0.2 });
  run(coach, 1);
  coach.done("jump");
  run(coach, 0.1);
  assert.equal(coach.current?.id, "jump", "still fading");
  run(coach, 0.4);
  assert.equal(coach.current, null);
  coach.offer({ ...JUMP, id: "slide" });
  run(coach, 1);
  coach.reset();
  assert.equal(coach.scale, 1);
  assert.equal(coach.current, null);
});

test("a move takes over from a lesson on its way out; a thing waits for it to fade", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ ...JUMP, minLife: 2 });
  coach.done("jump");
  assert.equal(coach.offer({ id: "pearls", text: "Pearls fill the sugar meter." }), false);
  assert.equal(coach.offer({ id: "slide", text: "Slide under it.", move: true }), true);
  assert.equal(coach.leaving, false);
});

test("priorities: a hazard about to be met takes over from the power-up, not from a move", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "rush", text: "It smashes things.", move: true, priority: 1.5 });
  assert.equal(coach.offer({ id: "hazard", text: "Hazard stripes end the run.", priority: 1.8 }), true);
  assert.equal(coach.offer({ ...JUMP, move: true }), true);
  assert.equal(coach.offer({ id: "hazard2", text: "Hazard stripes end the run.", priority: 1.8 }), false);
});

test("a finished lesson stays readable for its minimum, then fades", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "pearls", text: "Pearls fill the sugar meter.", minLife: 1 });
  coach.done("pearls");
  run(coach, 0.5);
  assert.equal(coach.fading, false);
  run(coach, 0.6);
  assert.equal(coach.fading, true);
  run(coach, 0.3);
  assert.equal(coach.current, null);
});

test("a lesson with slow 0 pauses play within a beat, and play comes back once it is done", () => {
  const coach = createCoach("runner", { persist: false });
  coach.offer({ id: "stop", text: "Stop.", slow: 0, life: Infinity });
  let t = 0;
  while (!coach.paused && t < 1) {
    coach.step(1 / 60);
    t += 1 / 60;
  }
  assert.ok(coach.paused, "never paused");
  assert.ok(t <= 0.35, `took ${t.toFixed(2)} s to stop`);
  assert.equal(coach.step(1 / 60, 1 / 60), 0, "game time still ran while paused");
  coach.done("stop");
  assert.equal(coach.paused, false);
  for (let i = 0; i < 90; i++) coach.step(1 / 60);
  assert.equal(coach.scale, 1);
});
