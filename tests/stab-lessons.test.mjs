import assert from "node:assert/strict";
import test from "node:test";

import { createCoach } from "../src/lib/arcade/core/coach.ts";
import { createRng } from "../src/lib/arcade/core/rng.ts";
import {
  EXPERT,
  NORMAL,
  PRACTICE_CUPS,
  STAB_COOLDOWN,
  barAtTime,
  barPosition,
  barStart,
  createPractice,
  cupBeats,
  endPractice,
  isGoldenCup,
  isMissed,
  planPracticeCup,
  practiceAt,
  judgeStab,
  nearestCup,
  practiceLearned,
  practiceOn,
  practiceResult,
  tierForBar,
} from "../src/lib/arcade/stab-engine.js";
import {
  CUP_LEAD,
  HOLD,
  ghostPlunge,
  LESSONS,
  PRACTICE_LEAD,
  REST,
  lessonForMiss,
  lessonForSong,
  lessonForStab,
  lessonNow,
  mayOffer,
  nextWaiting,
} from "../src/lib/arcade/stab-lessons.js";

const TEMPOS = [124, 138, 150, 164];
const FRAME = 1 / 60;
/** Song seconds a cup is in view before its beat, on a desktop belt. */
const LEAD = 1.8;
/** As StrawStab: nothing is taught before "go" is gone. */
const GO_SECONDS = 0.62;
/** The coach's fade once a line is done. */
const FADE = 0.3;
const rank = (lesson) => lesson.priority ?? (lesson.move ? 2 : 1);

/** Hands: seconds off each cup's beat, by the cup's number; null lets it go, "bonk" stabs the belt half a beat before it. */
const HANDS = {
  dead: () => 0,
  graze: () => 0.12,
  sloppy: (number) => [0, 0, 0.07, 0, -0.07, 0, 0.13, 0, null, 0, "bonk", 0, 0.03, -0.13][number % 14],
  expertSloppy: (number) => [0, 0, 0.04, 0, -0.045, 0, 0.08, 0, null, 0, "bonk", 0, 0.02, -0.08][number % 14],
  // Off now and then but never past a graze: it keeps its pearls and plays on.
  wobbly: (number) => [0, 0, 0.07, 0, -0.07, 0, 0.13, 0, 0.03, -0.13][number % 10],
  expertWobbly: (number) => [0, 0, 0.04, 0, -0.045, 0, 0.08, 0, 0.02, -0.08][number % 10],
  // Hits the bare belt now and then, but lets no cup go.
  expertBonky: (number) => [0, 0, 0.04, 0, -0.045, 0, 0.08, 0, "bonk", 0, 0.02, -0.08][number % 12],
};

/**
 * Plays a run the way StrawStab does, a frame at a time on song time (which
 * is real time here: nothing slows), with the real coach: cups planned a
 * belt's length ahead, the hand's stabs, misses called after the window and
 * grace, the practice applied by its song-time boundary to stabs, misses
 * and the bare belt (a good practice stab kept for later runs at once), a
 * song's first downbeat taught, and each frame the coach stepped and asked
 * what is coming. The run ends when the pearls are gone, as the game does,
 * and nothing is taught after. A player who `reads` presses Continue once a
 * line has been up that long. `coach` carries what an earlier run on the
 * device learned. Returns every lesson offered (with what the belt was doing
 * then), what was up on every frame, the run's cups and pearls, and when it
 * ended for want of pearls (null if it didn't).
 */
function play(mode, hand, { seconds = 120, seed = 7, coach = createCoach("stab", { persist: false }), reads = Infinity } = {}) {
  const random = createRng(seed);
  const practice = createPractice(!coach.learned(LESSONS.stab.id));
  const cups = [];
  const stabs = [];
  const offers = [];
  const frames = [];
  let plannedBars = 0;
  let count = 0;
  let shown = -0.2;
  let lastStab = -Infinity;
  let quiet = Infinity;
  let cue = null;
  let currentBar = -1;
  let songs = 1;
  let tier = tierForBar(TEMPOS, 0, mode);
  let lost = 0;
  let practiceLost = 0;
  let scored = 0;
  let died = null;
  coach.reset();
  /**
   * A pearl gone; the last ends the run, as endGame does, taking any line
   * down (counted if it had been up long enough to read).
   */
  const lose = () => {
    lost += 1;
    if (lost < mode.lives) return false;
    died = shown;
    const current = coach.current;
    if (current && !current.move && !coach.leaving && coach.age >= (current.minLife ?? 0.9)) coach.done(current.id);
    coach.dismiss();
    cue = null;
    return true;
  };

  const nextCup = () => nextWaiting(cups);
  // The earliest cup still waiting, found here by its beat rather than by
  // the game's own order, to check the lessons against.
  const earliest = () => cups.reduce((best, cup) => (!cup.resolved && (!best || cup.time < best.time) ? cup : best), null);
  const offer = (lesson, cup) => {
    const record = { id: lesson.id, at: shown, quiet, cup, earliest: earliest(), over: coach.current, overAge: coach.age, practicing: practiceOn(practice) };
    if (!mayOffer(lesson, coach.current, coach.age, quiet) || !coach.offer(lesson)) return;
    offers.push(record);
    cue = { lesson, cup };
  };
  const teach = (lesson) => {
    if (lesson && shown >= GO_SECONDS) offer(lesson, null);
  };
  const finishPractice = () => {
    if (coach.current?.id === LESSONS.stab.id && !coach.leaving) {
      if (practiceLearned(practice)) coach.done(LESSONS.stab.id);
      else coach.dismiss();
    } else if (practiceLearned(practice)) coach.done(LESSONS.stab.id);
  };
  const stab = (at) => {
    if (at - lastStab < STAB_COOLDOWN) return;
    lastStab = at;
    const index = nearestCup(cups, at, mode);
    if (index < 0) {
      if (practiceAt(practice, at)) return void practiceResult(practice, "bonk");
      if (lose()) return;
      return teach(lessonForStab({ result: "bonk", error: 0, practicing: false, expert: mode.expert }, coach.learned));
    }
    const cup = cups[index];
    const error = at - cup.time;
    const rating = judgeStab(error, mode, cup.tier) ?? "graze";
    cup.resolved = true;
    if (practiceAt(practice, cup.time)) {
      cup.practice = true;
      if (rating !== "graze") coach.skip(LESSONS.stab.id);
      if (practiceResult(practice, rating)) finishPractice();
      return;
    }
    scored += 1;
    teach(lessonForStab({ result: rating, error, practicing: false, expert: mode.expert }, coach.learned));
  };

  while (shown < seconds && died === null) {
    shown += FRAME;
    // Plan a belt's length ahead, and the hand's stabs with it.
    while (barStart(TEMPOS, plannedBars) < shown + LEAD + 0.6) {
      const bar = plannedBars++;
      const beatLength = 60 / barPosition(TEMPOS, bar).bpm;
      for (const beat of cupBeats(TEMPOS, bar, random, mode)) {
        count += 1;
        const time = barStart(TEMPOS, bar) + beat * beatLength;
        cups.push({ time, bar, beat, tier: tierForBar(TEMPOS, bar, mode), number: count, golden: isGoldenCup(count), resolved: false });
        planPracticeCup(practice, count, time, mode);
        const aim = hand(count);
        if (aim === "bonk") stabs.push(time - beatLength / 2 - 0.02, time);
        else if (aim !== null) stabs.push(time + aim);
      }
      stabs.sort((a, b) => a - b);
    }
    while (stabs.length && stabs[0] <= shown && died === null) stab(stabs.shift());
    for (const cup of cups) {
      if (died !== null || !isMissed(cup, shown, mode)) continue;
      cup.resolved = true;
      if (practiceAt(practice, cup.time)) {
        cup.practice = true;
        practiceLost += 1;
        if (practiceResult(practice, "miss")) finishPractice();
        continue;
      }
      if (!lose()) teach(lessonForMiss(false, coach.learned));
    }
    if (died !== null) break;
    // A new song's first downbeat.
    const bar = barAtTime(TEMPOS, shown);
    if (bar !== currentBar) {
      const position = barPosition(TEMPOS, bar);
      const songsNow = position.loop * TEMPOS.length + position.song + 1;
      const newSong = currentBar >= 0 && songsNow !== songs;
      const nextTier = tierForBar(TEMPOS, bar, mode);
      const tierRose = nextTier > tier;
      currentBar = bar;
      songs = songsNow;
      tier = nextTier;
      if (newSong) teach(lessonForSong({ tierRose, practicing: practiceOn(practice) }, coach.learned));
    }
    // The lessons' frame.
    coach.step(FRAME);
    quiet = coach.current ? 0 : quiet + FRAME;
    if (cue?.cup?.resolved) {
      if (coach.current === cue.lesson && !coach.leaving) coach.done(cue.lesson.id);
      cue.cup = null;
    }
    if (shown >= GO_SECONDS) {
      const found = lessonNow({ now: shown, next: nextCup(), practicing: practiceOn(practice) }, coach.learned);
      if (found && found.lesson.id !== coach.current?.id) offer(found.lesson, found.cup);
    }
    if (!coach.current) cue = null;
    // Continue, once the line has been read.
    if (coach.current && !coach.leaving && coach.age >= reads) {
      if (coach.current.id === LESSONS.stab.id && practiceOn(practice)) endPractice(practice);
      coach.done(coach.current.id);
    }
    frames.push({ at: shown, id: coach.current?.id ?? null, leaving: coach.leaving, age: coach.age, practicing: practiceOn(practice) });
  }
  return { offers, frames, cups, lost, practiceLost, scored, practice, coach, died };
}

const ids = (run) => run.offers.map((offer) => offer.id);

// --- The lines ------------------------------------------------------------------

test("every line is one short full sentence, eight words at most, with no '!' or '·'", () => {
  for (const lesson of Object.values(LESSONS)) {
    assert.ok(lesson.text.split(/\s+/).length <= 8, lesson.text);
    assert.match(lesson.text, /^[A-Z].*\.$/, lesson.text);
    assert.ok(!/[!·]/.test(lesson.text), lesson.text);
    // Nothing slows the beat, and every line is bounded on real time but the practice's, which its cups end.
    assert.ok(lesson.slow === undefined || lesson.slow === 1, lesson.id);
    if (lesson.id !== LESSONS.stab.id) assert.ok(lesson.life <= HOLD, lesson.id);
  }
  assert.equal(LESSONS.stab.text, "Stab when the cup reaches the notch.");
  assert.deepEqual(LESSONS.stab.keys, ["Space"]);
  assert.equal(LESSONS.stab.touch, "tap");
});

// --- The practice ------------------------------------------------------------------

test("a first run's practice line comes up as its first cup rides in, and nothing else shows while it lasts", () => {
  for (const mode of [NORMAL, EXPERT]) {
    for (const hand of [HANDS.dead, HANDS.graze, HANDS.sloppy]) {
      const run = play(mode, hand, { seconds: 30 });
      const first = run.cups[0];
      assert.equal(run.offers[0].id, "stab");
      assert.ok(first.time - run.offers[0].at <= PRACTICE_LEAD + 1e-9);
      assert.ok(first.time - run.offers[0].at >= PRACTICE_LEAD - FRAME * 1.5, `${first.time - run.offers[0].at} s to read it`);
      for (const frame of run.frames) {
        if (frame.practicing && frame.id) assert.equal(frame.id, "stab", `${frame.id} at ${frame.at}`);
      }
      // It stays up (not on its way out) until the practice is over.
      const over = run.frames.findIndex((frame) => !frame.practicing);
      for (const frame of run.frames.slice(0, over)) if (frame.at > run.offers[0].at) assert.ok(frame.id === "stab" && !frame.leaving);
    }
  }
});

test("a first run's practice costs no pearl, and a dead-on hand ends it after two cups", () => {
  const dead = play(NORMAL, HANDS.dead, { seconds: 20 });
  assert.equal(dead.cups.filter((cup) => cup.practice).length, 2);
  assert.equal(dead.coach.learned("stab"), true);
  // A hand that lets every cup go loses nothing in the practice, then pays.
  const away = play(NORMAL, () => null, { seconds: 20 });
  assert.equal(away.practiceLost, PRACTICE_CUPS);
  assert.ok(away.lost > 0);
  assert.equal(away.coach.learned("stab"), false);
});

test("a first good practice stab is kept for later runs at once, and this practice still runs to its streak", () => {
  const coach = createCoach("stab", { persist: false });
  // The player leaves just after the first cup, taken dead on.
  const first = play(NORMAL, HANDS.dead, { seconds: 4.2, coach });
  assert.equal(first.cups.filter((cup) => cup.practice).length, 1);
  assert.equal(first.practice.over, false);
  assert.equal(coach.learned("stab"), true);
  // Meanwhile the line stayed up, not on its way out, while the practice ran.
  assert.ok(first.frames.at(-1).id === "stab" && !first.frames.at(-1).leaving);
  // A full first run still practises to two good stabs in a row.
  assert.equal(play(NORMAL, HANDS.dead, { seconds: 20 }).cups.filter((cup) => cup.practice).length, 2);
  // And the next run on this device has no practice.
  assert.equal(play(NORMAL, HANDS.dead, { seconds: 20, coach }).cups.filter((cup) => cup.practice).length, 0);
});

test("a practice with no good stab comes back next run; one that taught the stab doesn't", () => {
  const coach = createCoach("stab", { persist: false });
  const grazed = play(NORMAL, HANDS.graze, { seconds: 15, coach });
  assert.equal(grazed.cups.filter((cup) => cup.practice).length, PRACTICE_CUPS);
  assert.equal(coach.learned("stab"), false);
  const again = play(NORMAL, HANDS.dead, { seconds: 15, coach });
  assert.equal(again.offers[0].id, "stab");
  assert.equal(coach.learned("stab"), true);
  const later = play(NORMAL, HANDS.dead, { seconds: 15, coach });
  assert.ok(!ids(later).includes("stab"));
  assert.equal(later.cups.filter((cup) => cup.practice).length, 0);
});

test("Continue on the practice ends it at once, counted, and the next cup scores", () => {
  const run = play(NORMAL, HANDS.dead, { seconds: 20, reads: 1.2 });
  assert.equal(run.coach.learned("stab"), true);
  assert.ok(run.cups.filter((cup) => cup.practice).length < PRACTICE_CUPS);
  assert.ok(run.scored > 0);
});

// --- Lessons in play ----------------------------------------------------------------

test("a device meets every lesson over its first few runs, each run ending when its pearls do", () => {
  for (const [mode, hands, wanted] of [
    [NORMAL, [HANDS.sloppy, HANDS.wobbly], ["stab", "early", "late", "perfect", "graze", "miss", "bonk", "song", "night", "golden", "offbeat"]],
    // Expert's two pearls: the second loss ends the run before its line, so
    // the runs take turns losing one to a cup let go and one to the belt.
    [EXPERT, [HANDS.expertSloppy, HANDS.expertWobbly, HANDS.expertBonky], ["stab", "expert", "miss", "bonk", "night", "song", "golden", "offbeat"]],
  ]) {
    const coach = createCoach("stab", { persist: false });
    const taught = [];
    /** Lines the end of a run cut short before they could be read: those may come again. */
    const cut = new Set();
    let runs = 0;
    while (runs < 9 && !wanted.every((id) => taught.includes(id))) {
      const run = play(mode, hands[runs % hands.length], { seconds: 240, seed: 11 + runs, coach });
      // A sloppy run ends when its pearls do, and nothing is taught after.
      if (run.died !== null) {
        assert.ok(run.offers.every((offer) => offer.at <= run.died));
        const last = run.offers.at(-1);
        if (last && run.died - last.at < (LESSONS[last.id].minLife ?? 0.9)) cut.add(last.id);
      }
      for (const id of ids(run)) {
        // Taught once a device, unless the last pearl cut it short.
        assert.ok(!taught.includes(id) || cut.has(id), `${id} taught again`);
        taught.push(id);
      }
      runs += 1;
    }
    for (const id of wanted) assert.ok(taught.includes(id), `${mode.expert ? "expert" : "normal"} never taught ${id} in ${runs} runs: ${taught.join(" ")}`);
    assert.equal(taught.includes("expert"), mode.expert);
  }
  // The scripted sloppy hand does run out of pearls, so the budget is real.
  assert.notEqual(play(EXPERT, HANDS.expertSloppy, { seconds: 240 }).died, null);
});

const PAIRS = [
  [NORMAL, HANDS.sloppy],
  [NORMAL, HANDS.wobbly],
  [EXPERT, HANDS.expertSloppy],
  [EXPERT, HANDS.expertWobbly],
];

test("a line about a cup comes up only once that cup is the next one the straw needs, and goes with it", () => {
  let cueLines = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const [mode, hand] of PAIRS) {
      const run = play(mode, hand, { seconds: 200, seed });
      for (const offer of run.offers.filter((offer) => offer.cup)) {
        cueLines += 1;
        assert.equal(offer.cup, offer.earliest, `${offer.id} pointed past an earlier cup`);
        assert.ok(offer.cup.time - offer.at >= CUP_LEAD, `${offer.id} too late to see`);
        // Up until its cup is taken or lost, then on its way out.
        const after = run.frames.filter((frame) => frame.at > offer.cup.time + 0.3 && frame.at < offer.cup.time + 0.5);
        assert.ok(after.every((frame) => frame.id !== offer.id || frame.leaving), `${offer.id} outlived its cup`);
      }
    }
  }
  assert.ok(cueLines >= 12, `${cueLines} lines about a cup checked`);
});

test("a golden or off-beat cup half a beat at 164 bpm behind one taken dead on is still taught", () => {
  const none = () => false;
  const halfBeat = 30 / 164;
  for (const fps of [30, 60, 120]) {
    // The first frame drawn after the dead-on stab, shown a frame later still.
    const shown = 10 + 2 / fps;
    for (const [later, lesson] of [
      [{ time: 10 + halfBeat, beat: 2, golden: true, resolved: false }, LESSONS.golden],
      [{ time: 10 + halfBeat, beat: 2.5, golden: false, resolved: false }, LESSONS.offbeat],
    ]) {
      const cups = [{ time: 10, beat: 1.5, golden: false, resolved: true }, later];
      const next = nextWaiting(cups);
      assert.equal(next, later);
      assert.equal(lessonNow({ now: shown, next, practicing: false }, none)?.lesson, lesson, `${lesson.id} at ${fps} Hz`);
    }
  }
});

test("a line is never cut short, a timing note waits for a rest after the last, and none outstays its hold", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const [mode, hand] of PAIRS) {
      const run = play(mode, hand, { seconds: 200, seed });
      for (const offer of run.offers) {
        const lesson = LESSONS[offer.id];
        if (offer.over) {
          // Took over: only a higher priority, and only once the line up had been read.
          assert.ok(rank(lesson) > rank(offer.over), `${offer.id} over ${offer.over.id}`);
          assert.ok(offer.overAge >= (offer.over.minLife ?? 0.9), `${offer.over.id} cut at ${offer.overAge}`);
        } else if (rank(lesson) === 1) {
          // A timing note, a golden or an off-beat cup: only after a rest.
          // (The practice, a lost pearl and a new song can't wait, so they don't.)
          assert.ok(offer.quiet >= REST, `${offer.id} after ${offer.quiet} s of quiet`);
        }
      }
      // Up for at most its hold and the fade, practice aside.
      for (const frame of run.frames) if (frame.id && frame.id !== "stab") assert.ok(frame.age <= HOLD + FADE + FRAME, `${frame.id} ${frame.age}`);
    }
  }
});

test("timing notes, a perfect, a graze and the pearl lines are said for what just happened", () => {
  const known = (list) => (id) => list.includes(id);
  const none = known([]);
  assert.equal(lessonForStab({ result: "good", error: -0.07, practicing: false, expert: false }, none), LESSONS.early);
  assert.equal(lessonForStab({ result: "good", error: 0.07, practicing: false, expert: false }, none), LESSONS.late);
  assert.equal(lessonForStab({ result: "perfect", error: 0.01, practicing: false, expert: false }, none), LESSONS.perfect);
  assert.equal(lessonForStab({ result: "graze", error: 0.12, practicing: false, expert: false }, none), LESSONS.graze);
  assert.equal(lessonForStab({ result: "graze", error: 0.12, practicing: false, expert: false }, known(["graze"])), LESSONS.late);
  assert.equal(lessonForStab({ result: "bonk", error: 0, practicing: false, expert: false }, none), LESSONS.bonk);
  // In expert, a stab the normal windows rate better is told why.
  assert.equal(lessonForStab({ result: "good", error: 0.04, practicing: false, expert: true }, none), LESSONS.expert);
  // One the normal windows rate the same is only told which way it was off.
  assert.equal(lessonForStab({ result: "good", error: 0.055, practicing: false, expert: true }, none), LESSONS.late);
  // Nothing during the practice, where nothing costs or scores.
  assert.equal(lessonForStab({ result: "bonk", error: 0, practicing: true, expert: false }, none), null);
  assert.equal(lessonForMiss(true, none), null);
  assert.equal(lessonForMiss(false, none), LESSONS.miss);
  // A new song: nightfall when the tier rose, else (or then) the new beat.
  assert.equal(lessonForSong({ tierRose: true, practicing: false }, none), LESSONS.night);
  assert.equal(lessonForSong({ tierRose: true, practicing: false }, known(["night"])), LESSONS.song);
  assert.equal(lessonForSong({ tierRose: false, practicing: false }, none), LESSONS.song);
});

test("the golden and off-beat lines need their cup next, and far enough off to see", () => {
  const none = () => false;
  const golden = { time: 10, beat: 0, golden: true };
  assert.equal(lessonNow({ now: 9, next: golden, practicing: false }, none).lesson, LESSONS.golden);
  assert.equal(lessonNow({ now: 10 - CUP_LEAD + 0.01, next: golden, practicing: false }, none), null);
  const off = { time: 10, beat: 1.5, golden: false };
  assert.equal(lessonNow({ now: 9, next: off, practicing: false }, none).lesson, LESSONS.offbeat);
  assert.equal(lessonNow({ now: 9, next: { ...off, beat: 2 }, practicing: false }, none), null);
  // While practising, only the practice line.
  assert.equal(lessonNow({ now: 9, next: golden, practicing: true }, none).lesson, LESSONS.stab);
  assert.equal(lessonNow({ now: 10 - PRACTICE_LEAD - 0.01, next: golden, practicing: true }, none), null);
});

test("the ghost straw's tip meets the lid exactly on the beat, at any size, and only poses under Reduce Motion", () => {
  // As StrawStab lays it out: the hand 14 px over the lid, stuck six art
  // pixels in; desktop art pixels are 6 px, a phone's 4.
  for (const px of [4, 6]) {
    const beltY = 600;
    const lid = beltY - 9 * px;
    const straw = { rest: lid - 14, lid, stuck: lid + px * 6, plunge: 0.05, ride: 0.36, reduce: false };
    const tip = (since, reduce = false) => {
      const share = ghostPlunge(since, { ...straw, reduce });
      return share === null ? null : straw.rest + (straw.stuck - straw.rest) * share;
    };
    assert.ok(Math.abs(tip(0) - lid) < 1e-9, `${px}px: tip at ${tip(0)}, lid at ${lid}`);
    // Above the lid before the beat, through it after, and moving down all the way.
    assert.ok(tip(-0.01) < lid && tip(0.01) > lid);
    let last = -Infinity;
    for (let since = -0.05; since <= 0.36; since += 0.002) {
      const y = tip(since);
      if (y === null) continue;
      assert.ok(y >= last - 1e-9);
      last = y;
    }
    assert.equal(tip(-0.05), null);
    assert.equal(tip(0.4), null);
    // Under Reduce Motion: nothing before the beat, then the contact pose, still.
    assert.equal(tip(-0.001, true), null);
    assert.ok(Math.abs(tip(0, true) - lid) < 1e-9 && Math.abs(tip(0.3, true) - lid) < 1e-9);
  }
});
