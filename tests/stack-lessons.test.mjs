import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERT,
  FRAME_RATE,
  NORMAL,
  dropCup,
  grownSpan,
  perfectWindow,
  slideFor,
  sliderWidth,
  speedForHeight,
  traySpan,
  widthAfterPerfect,
} from "../src/lib/arcade/stack-engine.js";
import {
  EXPERT_LESSONS,
  EXPLAIN_SECONDS,
  EXPLAIN_SLOW,
  LESSONS,
  PENDING_SECONDS,
  FIRST_SECONDS,
  SLICE_SLOW,
  SLIP_GUESS,
  bestCallout,
  createStackLessons,
  firstCupLesson,
  ghostSpan,
  growWindow,
  lessonForDrop,
  lessonsFor,
  nextPerfectGrows,
  roomUnderSlice,
  sliceFall,
  slipBox,
  towerCallout,
} from "../src/lib/arcade/stack-lessons.js";
import { createCoach } from "../src/lib/arcade/core/coach.ts";

/** Screen pixels to a unit: phone and desktop, at one and two device pixels. */
const PIXEL_SCALES = [4, 5, 8, 10];
const MODES = [NORMAL, EXPERT];
const none = () => false;
const all = () => true;
/** Everything learned but `id`. */
const allBut = (id) => (other) => other !== id;

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of [...Object.values(LESSONS), ...Object.values(EXPERT_LESSONS)]) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
  }
});

test("normal explains in slow motion; expert never slows", () => {
  assert.ok(EXPLAIN_SLOW > 0.15 && EXPLAIN_SLOW <= 0.3);
  assert.deepEqual(Object.keys(EXPERT_LESSONS), Object.keys(LESSONS));
  for (const id of Object.keys(LESSONS)) {
    const normal = LESSONS[id];
    const expert = EXPERT_LESSONS[id];
    // The same line and keys in both modes.
    assert.equal(expert.id, normal.id);
    assert.equal(expert.text, normal.text);
    assert.equal(normal.slow, EXPLAIN_SLOW, `${id} doesn't slow normal`);
    // The perfect window is time turned into distance: a slower cup on the
    // expert board would be judged with a wider window than its rules give.
    assert.equal(expert.slow ?? 1, 1, `${id} slows expert`);
    // An explanation holds until Continue or a drop, up to its limit.
    assert.ok((normal.life ?? 0) >= EXPLAIN_SECONDS, `${id} doesn't hold`);
    assert.equal(!!normal.move, id === "first");
  }
  assert.equal(lessonsFor(NORMAL), LESSONS);
  assert.equal(lessonsFor(EXPERT), EXPERT_LESSONS);
  assert.deepEqual(LESSONS.first.keys, ["Space"]);
  assert.equal(LESSONS.first.touch, "tap");
  assert.ok(growWindow(EXPERT) < growWindow(NORMAL));
});

test("the first cup is taught on the first cup only, until it is learned", () => {
  assert.equal(firstCupLesson(0, none), LESSONS.first);
  assert.equal(firstCupLesson(1, none), null);
  assert.equal(firstCupLesson(0, (id) => id === "first"), null);
  assert.equal(firstCupLesson(0, none, EXPERT), EXPERT_LESSONS.first);
});

test("the ghost sits exactly where a perfect drop lands, in both modes", () => {
  for (const rules of MODES) {
    const tray = traySpan(rules);
    const width = sliderWidth(tray, rules);
    const ghost = ghostSpan(tray, width);
    assert.ok(Number.isInteger(ghost.left), "the ghost is on the unit grid");
    for (const { speed } of [slideFor(0, rules, 1), slideFor(0, rules, 2)]) {
      const window = perfectWindow(0, speed, rules);
      for (const px of PIXEL_SCALES) {
        const result = dropCup(tray, ghost.left, width, { window, px });
        assert.equal(result.kind, "perfect", `${rules.expert ? "expert" : "normal"} px ${px}`);
        assert.deepEqual(result.placed, ghost);
      }
    }
  }
});

test("following the first lesson literally never fails: a cup covering the ghost lands whole", () => {
  for (const rules of MODES) {
    const tray = traySpan(rules);
    const width = sliderWidth(tray, rules);
    const ghost = ghostSpan(tray, width);
    const window = perfectWindow(0, speedForHeight(0, rules), rules);
    for (const px of PIXEL_SCALES) {
      // Covering it but for up to a unit at one side.
      for (let off = -1; off <= 1 + 1e-9; off += 1 / 64) {
        const result = dropCup(tray, ghost.left + off, width, { window, px });
        assert.ok(["perfect", "close", "clean"].includes(result.kind), `off ${off}: ${result.kind}`);
        assert.equal(result.cut, null, `off ${off}`);
        assert.equal(result.placed?.width, width);
      }
    }
  }
});

test("in normal's slow motion, every pass still shows a frame on the ghost", () => {
  for (const rules of MODES) {
    const tray = traySpan(rules);
    const width = sliderWidth(tray, rules);
    const ghost = ghostSpan(tray, width);
    const base = speedForHeight(0, rules);
    for (const speed of [base * (1 - rules.vary), base, base * (1 + rules.vary)]) {
      // The window is judged at the slide's own speed; the lesson only shortens each frame's step.
      const window = perfectWindow(0, speed, rules);
      const step = (speed * EXPLAIN_SLOW) / FRAME_RATE;
      for (const px of PIXEL_SCALES) {
        for (let phase = 0; phase < 1; phase += 0.05) {
          let hit = false;
          for (let k = -60; k <= 60 && !hit; k++) {
            hit = dropCup(tray, ghost.left + (k + phase) * step, width, { window, px }).kind === "perfect";
          }
          assert.ok(hit, `speed ${speed} px ${px} phase ${phase}`);
        }
      }
    }
  }
});

/**
 * Drops cups at the given offsets off centre (units) through the real rules,
 * asking what each drop teaches as the component does, and learning each
 * lesson as soon as it is offered.
 */
function play(offsets, rules = NORMAL, learned = new Set(["first"])) {
  let tower = [traySpan(rules)];
  let streak = 0;
  const taught = [];
  for (const off of offsets) {
    const height = tower.length - 1;
    const top = tower[height];
    const width = sliderWidth(top, rules);
    const { speed } = slideFor(height, rules, 7);
    const window = perfectWindow(height, speed, rules);
    const result = dropCup(top, top.left + (top.width - width) / 2 + off, width, { window, px: 5 });
    if (!result.placed) {
      taught.push({ kind: result.kind, lesson: null });
      break;
    }
    let placed = result.placed;
    if (result.kind === "perfect") {
      streak++;
      placed = grownSpan(placed, streak, rules);
    } else {
      streak = 0;
    }
    const lesson = lessonForDrop({ kind: result.kind, streak, width: placed.width }, (id) => learned.has(id), rules);
    if (lesson) learned.add(lesson.id);
    taught.push({ kind: result.kind, lesson: lesson?.id ?? null, width: placed.width });
    tower.push(placed);
  }
  return taught;
}

test("a first tower teaches the slice, the perfect, and the regrowth as each first happens", () => {
  const run = play([0, 2.6, 0, 0, 0, 0, 1.4]);
  assert.deepEqual(
    run.map((drop) => [drop.kind, drop.lesson]),
    [
      ["perfect", "perfect"],
      ["cut", "trim"],
      ["perfect", null],
      // One short of the third in a row, on a narrowed cup: the next one grows it.
      ["perfect", "grow"],
      ["perfect", null],
      ["perfect", null],
      ["cut", null],
    ],
  );
  // The promise was kept: the drop after the line grew the cup a unit.
  assert.equal(run[4].width, run[3].width + 1);
});

test("the regrowth line is only ever shown when the next perfect really grows the cup", () => {
  for (const rules of MODES) {
    for (let width = 1; width <= rules.startWidth; width++) {
      for (let streak = 1; streak <= 14; streak++) {
        const lesson = lessonForDrop({ kind: "perfect", streak, width }, allBut("grow"), rules);
        const grows = widthAfterPerfect(width, streak + 1, rules) > width;
        assert.equal(lesson?.id === "grow", grows, `${rules.expert ? "expert" : "normal"} width ${width} streak ${streak}`);
        if (lesson) assert.equal(lesson, lessonsFor(rules).grow);
        assert.equal(nextPerfectGrows(width, streak, rules), grows);
      }
    }
    // A fresh cup has nothing to grow back.
    for (let streak = 0; streak <= 14; streak++) assert.ok(!nextPerfectGrows(rules.startWidth, streak, rules));
  }
  // Normal grows on the third perfect in a row; expert on the fourth, then every second.
  assert.ok(nextPerfectGrows(9, 2, NORMAL) && !nextPerfectGrows(9, 1, NORMAL));
  assert.ok(nextPerfectGrows(6, 3, EXPERT) && !nextPerfectGrows(6, 4, EXPERT) && nextPerfectGrows(6, 5, EXPERT));
  // Only after a perfect: a whole drop that isn't one has no streak to grow.
  for (const kind of ["close", "clean", "miss"]) assert.equal(lessonForDrop({ kind, streak: 0, width: 6 }, none), null);
});

test("expert teaches the same things on its own regrowth count", () => {
  const run = play([0, 1.8, 0, 0, 0, 0, 0], EXPERT);
  const lessons = run.map((drop) => drop.lesson);
  assert.deepEqual(lessons.slice(0, 2), ["perfect", "trim"]);
  // Three perfects in a row on the narrowed cup, then the fourth grows it.
  assert.equal(lessons[4], "grow");
  assert.equal(run[5].width, run[4].width + 1);
});

test("a learned lesson is never offered again", () => {
  assert.equal(firstCupLesson(0, all), null);
  for (const kind of ["perfect", "close", "clean", "cut", "miss"]) {
    for (let streak = 0; streak <= 6; streak++) assert.equal(lessonForDrop({ kind, streak, width: 6 }, all), null);
  }
});

/**
 * The component's geometry: the play area under the tickets, the cup's row
 * kept about a third of the way down it, the ground near the bottom.
 */
function screen(viewW, viewH, playTop) {
  const unit = viewW < 640 ? 4 : 5;
  const cupH = 10 * unit;
  const groundY = viewH - Math.max(56, Math.round(viewH * 0.1));
  const desired = playTop + (viewH - playTop) * 0.34;
  /** The camera settled with `stacked` cups down. */
  const settled = (stacked) => Math.max(0, desired - (groundY - (stacked + 1) * cupH));
  /**
   * The stage as the component builds it, `lag` px of camera still to come
   * (right after a drop the new row starts a row higher, then comes down).
   */
  const stageAt = (stacked, lag, slipW, slipH, towerUnits = 14) => {
    const camera = settled(stacked) - lag;
    return {
      rowTop: groundY - (stacked + 1) * cupH + camera,
      settledTop: groundY - (stacked + 1) * cupH + settled(stacked),
      rowH: cupH,
      playTop,
      viewW,
      viewH,
      towerX: viewW / 2,
      towerHalf: (towerUnits * unit) / 2,
      slipW,
      slipH,
    };
  };
  /** The best line's y with `stacked` cups down and the camera `lag` px behind. */
  const lineAt = (stacked, best, lag) => groundY - best * cupH + settled(stacked) - lag;
  return { unit, cupH, groundY, settled, stageAt, lineAt };
}

const SCREENS = [
  [375, 667, 76],
  [390, 844, 76],
  [667, 375, 64],
  [667, 250, 64],
  [844, 390, 64],
  [1280, 800, 84],
  [1440, 900, 84],
];
/** Slips as measured: one line, a line with Continue beside it, Continue wrapped under, two lines and Continue. */
const SLIPS = [
  [220, 34],
  [320, 48],
  [300, 76],
  [320, 96],
];

/** Whether two boxes overlap. */
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The rows a drop is judged by: the sliding row, the whole width, and the tower's top cup. */
function judgedRows(g) {
  return [
    { left: 0, right: g.viewW, top: g.rowTop - 2, bottom: g.rowTop + g.rowH },
    { left: g.towerX - g.towerHalf, right: g.towerX + g.towerHalf, top: g.rowTop + g.rowH, bottom: g.rowTop + 2 * g.rowH },
  ];
}

test("a callout never covers the judged rows, with the slip as measured and the camera still moving", () => {
  let squeezed = 0;
  for (const [viewW, viewH, playTop] of SCREENS) {
    const { stageAt, cupH } = screen(viewW, viewH, playTop);
    for (const [slipW, slipH] of SLIPS) {
      for (let stacked = 0; stacked < 30; stacked++) {
        for (const towerUnits of [14, 6]) {
          // From a row higher (just after a drop) down to settled.
          for (let lag = cupH; lag >= 0; lag -= 5) {
            const g = stageAt(stacked, lag, slipW, slipH, towerUnits);
            const at = towerCallout(g);
            if (at.squeezed) {
              squeezed++;
              // Nowhere clear: the component holds it back until the camera settles.
              if (Math.abs(g.rowTop - g.settledTop) > 1) continue;
            }
            const box = slipBox(at, g);
            for (const row of judgedRows(g)) {
              assert.ok(!overlaps(box, row), `${viewW}×${viewH} slip ${slipW}×${slipH} at ${stacked} cups, lag ${lag}: ${at.side}`);
            }
            if (!at.squeezed) assert.ok(box.top >= playTop + 8, `${viewW}×${viewH}: under the tickets`);
          }
        }
      }
    }
  }
  // Short landscape play areas can run out of room.
  assert.ok(squeezed > 0);
  // Upright phones and laptops always have a clear place.
  for (const [viewW, viewH, playTop] of SCREENS.filter(([, h]) => h >= 600)) {
    const { stageAt } = screen(viewW, viewH, playTop);
    for (const [slipW, slipH] of SLIPS.slice(0, 3)) {
      for (let stacked = 0; stacked < 30; stacked++) assert.ok(!towerCallout(stageAt(stacked, 0, slipW, slipH)).squeezed, `${viewW}×${viewH}`);
    }
  }
});

test("the best line's callout sits on the line beside the tower when it fits, else by the tower", () => {
  for (const [viewW, viewH, playTop] of SCREENS) {
    const { stageAt, lineAt, cupH } = screen(viewW, viewH, playTop);
    for (const [slipW, slipH] of SLIPS) {
      for (let best = 1; best <= 40; best++) {
        for (let stacked = 0; stacked <= best; stacked++) {
          for (const lag of [cupH, 0]) {
            const g = stageAt(stacked, lag, slipW, slipH);
            const line = lineAt(stacked, best, lag);
            const at = bestCallout(g, line);
            if (at.squeezed && Math.abs(g.rowTop - g.settledTop) > 1) continue;
            const box = slipBox(at, g);
            for (const row of judgedRows(g)) assert.ok(!overlaps(box, row), `${viewW}×${viewH} best ${best} at ${stacked}: ${at.side}`);
            if (at.side === "right" && at.y < g.rowTop) {
              // On the line: just above it, right of the tower.
              assert.ok(box.bottom <= line && box.left >= g.towerX + g.towerHalf);
            }
          }
        }
      }
    }
  }
});

test("a named slice stays on screen while its line is read, and says where the line fits", () => {
  // It falls at a share of real speed in both modes, below normal's slow motion.
  assert.ok(SLICE_SLOW < EXPLAIN_SLOW);
  const readable = Math.max(LESSONS.trim.minLife, EXPERT_LESSONS.trim.minLife);
  assert.ok(sliceFall(readable) > 0);
  // The tightest case: the first cup's slice on a small phone, right above
  // the ground. There is no room for the line under it, and the slice is
  // still on screen once it has been read.
  const { groundY, cupH } = screen(375, 667, 76);
  const sliceTop = groundY - cupH;
  assert.ok(!roomUnderSlice(groundY + cupH, 667, 34, readable));
  assert.ok(sliceTop + sliceFall(readable) < 667, `gone after ${sliceFall(readable).toFixed(0)} px`);
  // A slice a third of the way down a laptop has room under it, unless the slip is tall.
  assert.ok(roomUnderSlice(400 + 50, 800, 48, readable));
  assert.ok(!roomUnderSlice(400 + 50, 800, 400, readable));
});

// --- In order, around the real coach ------------------------------------------------

const DT = 1 / 60;

/** A fresh device's lessons, with `known` already learned. */
function device(known = []) {
  const coach = createCoach("stack", { persist: false });
  for (const id of known) coach.skip(id);
  return { coach, lessons: createStackLessons(coach) };
}

/** Steps until `id` is up (or `limit` seconds pass); returns the seconds it took. */
function until(coach, lessons, id, limit = 3, best) {
  let waited = 0;
  while (coach.current?.id !== id && waited < limit) {
    lessons.step(DT, DT, best);
    waited += DT;
  }
  return waited;
}

/** Steps `seconds` of frames. */
function run(lessons, seconds, best) {
  let game = 0;
  for (let t = 0; t < seconds; t += DT) game = lessons.step(DT, DT, best);
  return game;
}

test("normal: each first is explained in slow motion until Continue or a drop", () => {
  const { coach, lessons } = device();
  assert.equal(lessons.begin(), LESSONS.first);
  assert.ok(lessons.firstCup && lessons.explaining);
  let game = run(lessons, 1.5);
  assert.ok(Math.abs(game - EXPLAIN_SLOW * DT) < 1e-9, `${game / DT} of full speed`);

  // The first cup lands perfect: its line is learned and taken down at once
  // (it never follows cup two), and the perfect's explanation takes over.
  assert.equal(lessons.afterDrop({ kind: "perfect", level: 0, streak: 1, width: 14 }), LESSONS.perfect);
  assert.ok(coach.learned("first") && !lessons.firstCup);
  assert.equal(coach.current?.id, "perfect");
  // It holds the game slowed until Continue.
  game = run(lessons, EXPLAIN_SECONDS - 1);
  assert.ok(game < DT * 0.3 && coach.current?.id === "perfect");
  assert.ok(lessons.proceed());
  assert.ok(coach.learned("perfect") && !lessons.explaining);
  assert.equal(run(lessons, 1.5), DT);
  assert.ok(!lessons.proceed(), "nothing left to continue");

  // A cut: the slice's explanation slows the game at once, and a drop once
  // it has been read ends it, learned.
  lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 12 });
  assert.equal(coach.current?.id, "trim");
  run(lessons, LESSONS.trim.minLife);
  lessons.afterDrop({ kind: "clean", level: 2, streak: 0, width: 12 });
  assert.ok(coach.learned("trim"));
});

test("a drop before an explanation is read ends it unlearned, and it waits for the next run", () => {
  const { coach, lessons } = device(["first"]);
  lessons.begin();
  lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 12 });
  run(lessons, 0.4);
  lessons.afterDrop({ kind: "clean", level: 2, streak: 0, width: 12 });
  assert.ok(!coach.learned("trim"));
  assert.equal(coach.current, null);
  // Once a run: the next slice in this tower isn't explained.
  assert.equal(lessons.afterDrop({ kind: "cut", level: 3, streak: 0, width: 10 }), null);
  assert.equal(coach.current, null);
  assert.equal(run(lessons, 1.5), DT);
  // The next tower teaches it.
  lessons.begin();
  assert.equal(lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 12 }), LESSONS.trim);
  assert.equal(coach.current?.id, "trim");
});

test("the first cup's slow motion runs out: unlearned after its time, and not again that run", () => {
  const { coach, lessons } = device();
  lessons.begin();
  // Real seconds, however slowly frames come: a slow device still runs out.
  let t = 0;
  while (coach.current?.id === "first" && t < FIRST_SECONDS + 1) {
    lessons.step(0.1, 0.05);
    t += 0.1;
  }
  assert.ok(t <= FIRST_SECONDS + 0.2, `held ${t.toFixed(1)} s`);
  assert.equal(coach.current, null);
  assert.ok(!coach.learned("first"));
  assert.equal(run(lessons, 1.5), DT);
  // A drop later lands the first cup: it counts as known, never shown again.
  lessons.afterDrop({ kind: "perfect", level: 0, streak: 1, width: 14 });
  assert.ok(coach.learned("first"));
  // A fresh device's next run shows it again.
  const fresh = device();
  fresh.lessons.begin();
  run(fresh.lessons, FIRST_SECONDS + 0.5);
  assert.equal(fresh.lessons.begin(), LESSONS.first);
});

test("the game's seconds are its own capped step, slowed only while an explanation is up", () => {
  const { lessons } = device(["first"]);
  lessons.begin();
  assert.equal(lessons.step(0.2, 0.05), 0.05);
  const slowed = device();
  slowed.lessons.begin();
  for (let t = 0; t < 1; t += 0.1) slowed.lessons.step(0.1, 0.05);
  assert.ok(Math.abs(slowed.lessons.step(0.2, 0.05) - 0.05 * EXPLAIN_SLOW) < 1e-9);
});

test("a move skipped with Continue counts as known", () => {
  const { coach, lessons } = device();
  lessons.begin();
  assert.ok(lessons.proceed());
  assert.ok(coach.learned("first") && !lessons.firstCup);
});

test("expert: every lesson shows at full speed, and Continue has nothing to do", () => {
  const { coach, lessons } = device();
  assert.equal(lessons.begin(EXPERT), EXPERT_LESSONS.first);
  assert.ok(lessons.firstCup && !lessons.explaining);
  const full = (best) => {
    for (let t = 0; t < 1; t += DT) assert.equal(lessons.step(DT, DT, best), DT);
  };
  full();
  assert.ok(!lessons.proceed());
  lessons.afterDrop({ kind: "perfect", level: 0, streak: 1, width: 10 });
  assert.ok(coach.learned("first"));
  assert.equal(coach.current?.id, "perfect");
  full();
  lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 8 });
  full();
  full();
  for (const streak of [1, 2, 3]) {
    lessons.afterDrop({ kind: "perfect", level: 1 + streak, streak, width: 8 });
    full();
  }
  for (let t = 0; t < 4; t++) full({ remaining: 3, ready: true });
});

test("a device that has landed a cup never sees the first lesson", () => {
  const { coach, lessons } = device(["first"]);
  assert.equal(lessons.begin(), null);
  assert.equal(coach.current, null);
  assert.equal(run(lessons, 2), DT);
});

test("a fall takes the lessons down uncounted, so a missed first cup is taught again", () => {
  const { coach, lessons } = device();
  lessons.begin();
  run(lessons, 2);
  lessons.fell();
  assert.equal(coach.current, null);
  assert.ok(!coach.learned("first"));
  // Play eases back out of the slow motion as the tower falls.
  assert.equal(run(lessons, 1.5), DT);
  assert.equal(lessons.begin(), LESSONS.first);
});

test("the regrowth line is kept by a perfect, taken back by anything else, and helps once a run", () => {
  const { coach, lessons } = device(["first", "perfect", "trim"]);
  lessons.begin();
  assert.equal(lessons.afterDrop({ kind: "perfect", level: 4, streak: 2, width: 12 }), LESSONS.grow);
  assert.equal(coach.current?.id, "grow");
  // A hair off: the line is no longer true, so it comes down unlearned...
  lessons.afterDrop({ kind: "close", level: 5, streak: 0, width: 12 });
  assert.equal(coach.current, null);
  assert.ok(!coach.learned("grow"));
  // ...and a second streak in the same tower gets no slow motion.
  lessons.afterDrop({ kind: "perfect", level: 6, streak: 1, width: 12 });
  assert.equal(lessons.afterDrop({ kind: "perfect", level: 7, streak: 2, width: 12 }), null);
  assert.equal(coach.current, null);
  // The next tower: the next perfect grows the cup, so the line was kept, and is learned.
  lessons.begin();
  lessons.afterDrop({ kind: "perfect", level: 7, streak: 2, width: 12 });
  assert.equal(coach.current?.id, "grow");
  lessons.afterDrop({ kind: "perfect", level: 8, streak: 3, width: 13 });
  assert.ok(coach.learned("grow"));
});

test("the regrowth line can't be learned by waiting it out, but Continue learns it", () => {
  const { coach, lessons } = device(["first", "perfect", "trim"]);
  lessons.begin();
  lessons.afterDrop({ kind: "perfect", level: 4, streak: 2, width: 12 });
  run(lessons, growWindow(NORMAL) + 0.1);
  assert.equal(coach.current, null);
  assert.ok(!coach.learned("grow"));
  // A perfect that didn't grow the cup doesn't count either.
  lessons.begin();
  lessons.afterDrop({ kind: "perfect", level: 7, streak: 2, width: 12 });
  lessons.afterDrop({ kind: "perfect", level: 8, streak: 3, width: 12 });
  assert.ok(!coach.learned("grow"));
  // Continue: the player chose to move on, so it is learned.
  lessons.begin();
  lessons.afterDrop({ kind: "perfect", level: 4, streak: 2, width: 12 });
  assert.ok(lessons.proceed());
  assert.ok(coach.learned("grow"));
});

test("a line whose thing has gone is retired: learned once read, not before", () => {
  const { coach, lessons } = device(["first"]);
  lessons.begin();
  lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 12 });
  run(lessons, 0.5);
  lessons.retire("trim");
  assert.equal(coach.current, null);
  assert.ok(!coach.learned("trim"));
  lessons.begin();
  lessons.afterDrop({ kind: "cut", level: 2, streak: 0, width: 10 });
  run(lessons, LESSONS.trim.minLife);
  lessons.retire("trim");
  assert.equal(coach.current, null);
  assert.ok(coach.learned("trim"));
  // Fading after Continue, it still comes down the moment its slice goes.
  const fading = device(["first"]);
  fading.lessons.begin();
  fading.lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 12 });
  fading.lessons.proceed();
  assert.ok(fading.coach.leaving);
  fading.lessons.retire("trim");
  assert.equal(fading.coach.current, null);
  // A held line of that id is dropped too.
  const held = device(["first"]);
  held.lessons.begin(EXPERT);
  held.lessons.afterDrop({ kind: "perfect", level: 0, streak: 1, width: 10 });
  held.lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 8 });
  assert.equal(held.lessons.pending?.id, "trim");
  held.lessons.retire("trim");
  assert.equal(held.lessons.pending, null);
});

test("expert: a drop's line waits for an unread one, then goes stale, and is taught at the next chance", () => {
  const { coach, lessons } = device(["first"]);
  lessons.begin(EXPERT);
  lessons.afterDrop({ kind: "perfect", level: 0, streak: 1, width: 10 });
  assert.equal(coach.current?.id, "perfect");
  // A cut right away: the perfect's line hasn't been read, so it stays and the slice's waits.
  lessons.afterDrop({ kind: "cut", level: 1, streak: 0, width: 8 });
  assert.equal(lessons.pending, EXPERT_LESSONS.trim);
  assert.equal(coach.current?.id, "perfect");
  run(lessons, PENDING_SECONDS + 2 * DT);
  assert.equal(lessons.pending, null);
  assert.ok(!coach.learned("trim"));
  // Once the perfect's line has run its course, the next slice is named (it was never shown).
  run(lessons, EXPERT_LESSONS.perfect.life + 0.5);
  assert.equal(coach.current, null);
  lessons.afterDrop({ kind: "cut", level: 4, streak: 0, width: 6 });
  assert.equal(coach.current?.id, "trim");
});

test("the best line waits its turn, takes it from a line about a drop, and is done once passed", () => {
  const { coach, lessons } = device(["perfect"]);
  // A best of one, on a new device: the first cup's lesson holds the stage.
  lessons.begin();
  run(lessons, 1, { remaining: 1, ready: true });
  assert.equal(coach.current?.id, "first");
  // The first cup lands, level with the best: the line takes its turn.
  lessons.afterDrop({ kind: "cut", level: 0, streak: 0, width: 12 });
  run(lessons, DT * 2, { remaining: 0, ready: true });
  assert.equal(coach.current?.id, "best");
  // Level with the tower, it holds; one cup past, it is done.
  run(lessons, 1, { remaining: 0, ready: true });
  assert.ok(!coach.leaving);
  run(lessons, DT, { remaining: -1, ready: true });
  assert.ok(coach.leaving && coach.learned("best"));
  // Not ready (out of view): never offered.
  const fresh = device(["first"]);
  fresh.lessons.begin();
  run(fresh.lessons, 1, { remaining: 3, ready: false });
  assert.equal(fresh.coach.current, null);
});
