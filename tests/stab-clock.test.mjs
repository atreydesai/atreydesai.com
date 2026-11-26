import assert from "node:assert/strict";
import test from "node:test";

import { CLOCK_SNAP, steadyOffset } from "../src/lib/arcade/stab-engine.js";
import { AUDIO_RECOVERY_LIMIT, CLOCK_STALL, createAudioGate, recoveryStatus } from "../src/lib/arcade/stab-clock.js";

const FRAME = 1 / 60;

/**
 * A stand-in for the shared AudioContext: suspend() and resume() land
 * after a delay, and until then the state is what it was, as in browsers.
 * Its clock runs only while it is running (or stands still while `stalled`).
 */
function fakeContext({ suspendDelay = 0.04, resumeDelay = 0.03 } = {}) {
  let state = "running";
  let time = 0;
  let stalled = false;
  /** @type {Array<{ at: number, to: string }>} */
  const due = [];
  return {
    get state() {
      return state;
    },
    get time() {
      return time;
    },
    set stalled(value) {
      stalled = value;
    },
    suspend(page) {
      due.push({ at: page + suspendDelay, to: "suspended" });
    },
    resume(page) {
      due.push({ at: page + resumeDelay, to: "running" });
    },
    get suspending() {
      return due.some(({ to }) => to === "suspended");
    },
    /** Runs the context from `page` for `dt` page seconds, landing what is due on the way. */
    run(page, dt) {
      let at = page;
      const end = page + dt;
      due.sort((a, b) => a.at - b.at);
      while (due.length && due[0].at <= end) {
        const next = due.shift();
        if (state === "running" && !stalled) time += Math.max(0, next.at - at);
        at = Math.max(at, next.at);
        state = next.to;
      }
      if (state === "running" && !stalled) time += end - at;
    },
  };
}

/** sfx.ts's suspendAudio and resumeAudio, as they treat the context (a resume only if it isn't running). */
const suspendAudio = (context, page) => {
  if (context.state === "running") context.suspend(page);
};
const resumeAudio = (context, page) => {
  if (context.state !== "running" && context.state !== "closed") context.resume(page);
};
/** audioClock(): the heard time while running, else null (no output latency here). */
const audioClock = (context) => (context.state === "running" ? context.time : null);

/**
 * StrawStab's clock, frame by frame, with the gate: the belt is drawn at
 * song time page + offset (origin 0), held while the clock is held, waiting
 * (drawn where it was) while the audio comes back, and resynced from the
 * audio clock when it does; the clock stopping or standing still under the
 * belt sends it back to waiting. `gated: false` plays the clock as it was
 * before the gate: the first reading after a resume is taken as the audio
 * back, and a frame with no reading keeps the last offset.
 */
function belt(context, { gated = true } = {}) {
  const gate = createAudioGate(() => context.suspending);
  let offset = 0;
  let synced = false;
  let held = false;
  let waiting = false;
  let waitStarted = 0;
  let heldSong = 0;
  let heardSong = 0;
  let lastShown = 0;
  let useAudio = true;
  const songNow = (page) => page + offset;
  const sync = (page) => {
    if (!useAudio) return true;
    const heard = audioClock(context);
    if (!gated) {
      if (heard === null) return true;
    } else if (heard === null || !gate.mayAdvance(heard, context.state, page)) {
      return false;
    }
    offset = steadyOffset(synced ? offset : null, heard - page);
    synced = true;
    heardSong = heard;
    return true;
  };
  sync(0);
  return {
    get held() {
      return held;
    },
    hold(page) {
      held = true;
      if (!waiting) heldSong = songNow(page);
      if (gated) gate.hold();
      suspendAudio(context, page);
    },
    release(page) {
      held = false;
      if (gated) gate.release();
      resumeAudio(context, page);
      waiting = true;
      waitStarted = page;
    },
    /** One frame at page time `page`: the song time the belt is drawn at. */
    frame(page) {
      if (held) return lastShown;
      if (waiting) {
        const state = context.state;
        if (gated && gate.needsResume(state)) resumeAudio(context, page);
        const heard = audioClock(context);
        const back = gated ? gate.mayAdvance(heard, state, page, true) : heard !== null;
        const recovery = gated ? recoveryStatus(back ? heard : null, heldSong, page - waitStarted) : back ? "ready" : "wait";
        if (recovery === "ready") {
          waiting = false;
          synced = false;
        } else if (recovery === "silent") {
          waiting = false;
          useAudio = false;
          offset = heldSong - page;
        } else {
          return lastShown;
        }
      }
      if (!sync(page)) {
        heldSong = heardSong;
        waiting = true;
        waitStarted = page;
        if (gate.needsResume(context.state)) resumeAudio(context, page);
        return lastShown;
      }
      lastShown = songNow(page);
      return lastShown;
    },
    get useAudio() {
      return useAudio;
    },
  };
}

/**
 * Plays `seconds` of frames, holding the clock at `holdAt` and releasing it
 * `releaseAfter` later (0: in the same moment, before any frame), and checks
 * on every frame that the belt is never ahead of the audio it is drawn
 * against by more than the offset's snap. Returns how far ahead it got at
 * most, and where it ended against the audio.
 */
function playThrough(context, { holdAt = 1, releaseAfter = 0, seconds = 4, gated = true, stall = null } = {}) {
  const run = belt(context, { gated });
  let page = 0;
  let worst = -Infinity;
  let released = false;
  let lastShown = run.frame(page);
  let lastAudio = context.time;
  while (page < seconds) {
    context.run(page, FRAME);
    page += FRAME;
    if (stall) context.stalled = page >= stall.from && page < stall.to;
    if (!run.held && !released && page >= holdAt) run.hold(page);
    if (run.held && !released && page >= holdAt + releaseAfter) {
      run.release(page);
      released = true;
    }
    const audioBefore = lastAudio;
    const shown = run.frame(page);
    lastAudio = context.time;
    if (run.useAudio) {
      worst = Math.max(worst, shown - context.time);
      // While the audio clock didn't move, neither did the belt (beyond a snap's worth).
      if (lastAudio === audioBefore) assert.ok(shown - lastShown <= CLOCK_SNAP + 1e-9, `the belt moved ${(shown - lastShown).toFixed(3)} s on a still clock at ${page.toFixed(3)}`);
    }
    lastShown = shown;
  }
  return { worst, end: lastShown - context.time, useAudio: run.useAudio, released };
}

test("the gate lets the belt follow a running clock, and holds it while a suspension is landing", () => {
  let pending = false;
  const gate = createAudioGate(() => pending);
  assert.ok(gate.mayAdvance(1, "running", 0));
  gate.hold();
  pending = true;
  assert.ok(!gate.mayAdvance(1.02, "running", 1.01));
  gate.release();
  assert.ok(!gate.needsResume("running"));
  assert.ok(!gate.mayAdvance(2.2, "running", 2.2), "a slow suspension released the belt");
  pending = false;
  assert.ok(gate.needsResume("suspended"));
  assert.ok(!gate.mayAdvance(null, "suspended", 2.25));
  assert.ok(gate.mayAdvance(2.25, "running", 2.3));
  assert.ok(!gate.needsResume("closed"));

  // A resume requested just before a hold can finish underneath it.
  gate.hold();
  assert.ok(!gate.needsSuspend("suspended"));
  assert.ok(gate.needsSuspend("running"));
  pending = true;
  assert.ok(!gate.needsSuspend("running"));
});

test("the gate holds the belt on a clock that stands still while it reports running", () => {
  const gate = createAudioGate(() => false);
  assert.ok(gate.mayAdvance(2, "running", 10));
  // Coarse steps (a large output buffer) are fine.
  assert.ok(gate.mayAdvance(2, "running", 10 + CLOCK_STALL - 0.01));
  assert.ok(gate.mayAdvance(2.2, "running", 10 + CLOCK_STALL));
  // Standing still past CLOCK_STALL is not.
  assert.ok(!gate.mayAdvance(2.2, "running", 10 + 2 * CLOCK_STALL + 0.01));
  assert.ok(gate.mayAdvance(2.21, "running", 10 + 2 * CLOCK_STALL + 0.02));
  assert.ok(CLOCK_STALL >= 0.12 && CLOCK_STALL <= 0.25);
});

test("recovery waits to observe a moving clock", () => {
  const gate = createAudioGate(() => false);
  gate.hold();
  gate.release();
  assert.ok(!gate.mayAdvance(1, "running", 10, true));
  assert.ok(!gate.mayAdvance(1, "running", 10.2, true));
  assert.ok(!gate.mayAdvance(null, "interrupted", 10.25, true));
  assert.ok(!gate.mayAdvance(1.02, "running", 10.3, true));
  assert.ok(gate.mayAdvance(1.04, "running", 10.35, true));
});

test("Continue at once, while the suspension is still landing: the belt never runs on in silence", () => {
  // The review's case first, as the clock was: the resume is skipped while
  // the context still says running, the suspension then lands, and the belt
  // runs on by the page clock with nothing heard.
  const before = playThrough(fakeContext({ suspendDelay: 0.04 }), { releaseAfter: 0.001, gated: false });
  assert.ok(before.worst > 1, `the old clock ran ${before.worst.toFixed(2)} s ahead`);
  // With the gate, at any delay a suspension or resume takes to land, and
  // however soon Continue comes, the belt is never ahead of the audio by
  // more than the offset's snap, and it ends back on it, with the music.
  for (const suspendDelay of [0, 0.005, 0.04]) {
    for (const resumeDelay of [0.005, 0.06, 0.3, 1.2]) {
      for (const releaseAfter of [0, 0.001, 0.02, FRAME * 2, 0.3, 2]) {
        const label = `suspend ${suspendDelay} s, resume ${resumeDelay} s, Continue after ${releaseAfter} s`;
        const result = playThrough(fakeContext({ suspendDelay, resumeDelay }), { releaseAfter, seconds: 5 });
        assert.ok(result.released, label);
        assert.ok(result.worst <= CLOCK_SNAP + 1e-9, `${label}: ${result.worst.toFixed(3)} s ahead`);
        assert.ok(result.useAudio, `${label}: gave up on the audio`);
        assert.ok(Math.abs(result.end) <= CLOCK_SNAP + 1e-9, `${label}: ended ${result.end.toFixed(3)} s off`);
      }
    }
  }
});

test("a clock that stops or stands still under the running belt holds the belt until it moves again", () => {
  // Standing still for half a second while the context says running.
  const still = playThrough(fakeContext(), { holdAt: Infinity, stall: { from: 1, to: 1.5 }, seconds: 3 });
  assert.ok(still.worst <= CLOCK_SNAP + 1e-9, `${still.worst.toFixed(3)} s ahead`);
  assert.ok(still.useAudio && Math.abs(still.end) <= CLOCK_SNAP + 1e-9);
  // Suspended under the belt by something else: the belt waits and asks for the audio back.
  const context = fakeContext({ resumeDelay: 0.05 });
  const run = belt(context);
  let page = 0;
  let worst = -Infinity;
  for (; page < 3; ) {
    context.run(page, FRAME);
    page += FRAME;
    if (Math.abs(page - 1) < FRAME / 2) context.suspend(page);
    const shown = run.frame(page);
    worst = Math.max(worst, shown - context.time);
  }
  assert.ok(worst <= CLOCK_SNAP + 1e-9, `${worst.toFixed(3)} s ahead`);
  assert.equal(context.state, "running");
});


test("unavailable audio switches to the page clock from the held beat", () => {
  const context = fakeContext({ resumeDelay: Infinity });
  const run = belt(context);
  run.frame(0);
  run.hold(0);
  run.release(0);
  context.run(0, 0.1);
  assert.equal(run.frame(AUDIO_RECOVERY_LIMIT - 0.01), 0);
  assert.ok(run.useAudio);
  assert.equal(run.frame(AUDIO_RECOVERY_LIMIT + 0.01), 0);
  assert.ok(!run.useAudio);
  assert.ok(run.frame(AUDIO_RECOVERY_LIMIT + 0.1) > 0);
});

test("a suspension that lands late keeps the held beat when the audio has run ahead", () => {
  const context = fakeContext({ suspendDelay: 1.2 });
  const run = belt(context);
  run.frame(0);
  run.hold(0);
  run.release(0);
  context.run(0, 1.1);
  assert.equal(run.frame(1.1), 0);
  assert.ok(run.useAudio);
  context.run(1.1, 0.11);
  assert.equal(run.frame(1.21), 0);
  context.run(1.21, 0.1);
  assert.equal(run.frame(1.31), 0);
  assert.ok(run.useAudio);
  context.run(1.31, 0.02);
  assert.equal(run.frame(1.33), 0);
  assert.ok(!run.useAudio);
  assert.ok(Math.abs(run.frame(1.43) - 0.1) < 1e-9);
});
