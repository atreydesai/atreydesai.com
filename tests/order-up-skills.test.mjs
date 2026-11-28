import test from "node:test";
import assert from "node:assert/strict";
import { SKILLS } from "../src/lib/arcade/order-up/content/index.ts";
import {
  createRun,
  stepSkill,
  actSkill,
  gradeDistance,
  guideGrade,
  BEHAVIORS,
} from "../src/lib/arcade/order-up/skills/index.ts";
import { TUNING, gradingWindow, shiftDuration, ticketLimit } from "../src/lib/arcade/order-up/engine/tuning.ts";
import { playSkill } from "./helpers/order-up-player.mjs";
import { RECIPES, RECIPE_BY_ID } from "../src/lib/arcade/order-up/content/recipes.ts";
import { newCampaign, normalizeCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { beginWork, handoff, skillAction, skillMastery, startShift, tickShift } from "../src/lib/arcade/order-up/engine/shift.ts";
import { restoreExpandedShift } from "../src/lib/arcade/order-up/engine/save.ts";
for (const mode of ["normal", "expert"])
  for (const skill of SKILLS) {
    test(`${mode} ${skill.id}: realistic visible-cue gesture can earn at least 90`, () => {
      const run = playSkill(skill.id, mode, 120);
      assert.ok(run.finished, skill.id);
      assert.ok(run.grade >= 90, `${skill.id}: ${run.grade}`);
      assert.ok(run.elapsed <= 3.11);
    });
    test(`${mode} ${skill.id}: unattended tool or wrong action does not grade perfect`, () => {
      const run = createRun(skill.id, mode, 120);
      if (skill.input === "hold") actSkill(run, { type: "down" });
      if (skill.input === "drag") actSkill(run, { type: "point", x: 0, y: 0 });
      if (skill.input === "knob") actSkill(run, { type: "knob", value: 0 });
      if (skill.input === "pick") actSkill(run, { type: "done" });
      for (let n = 0; n < 200; n++) stepSkill(run, 0.02);
      assert.ok(run.finished);
      assert.ok(run.grade < 90);
    });
    test(`${mode} ${skill.id}: automated steps cannot score 100`, () => {
      const run = createRun(skill.id, mode, 120, { automatic: 100 });
      for (let n = 0; n < 200; n++) stepSkill(run, 0.02);
      assert.equal(run.grade, 97);
      assert.equal(run.finished, true);
    });
  }
test("Normal and Expert tuning differs only numerically", () => {
  assert.deepEqual(Object.keys(TUNING.normal), Object.keys(TUNING.expert));
  for (const k of Object.keys(TUNING.normal)) assert.equal(typeof TUNING.normal[k], "number", k);
  assert.ok(TUNING.expert.gradeWindow < TUNING.normal.gradeWindow);
  assert.ok(TUNING.expert.rent > TUNING.normal.rent);
  assert.ok(TUNING.expert.startingCash < TUNING.normal.startingCash);
  assert.equal(TUNING.normal.startingCash, 5400);
  assert.equal(TUNING.expert.startingCash, 4200);
});
test("windows tighten with days without becoming empty; ranks extend shifts to four minutes", () => {
  for (const mode of ["normal", "expert"])
    for (const s of SKILLS) {
      assert.ok(gradingWindow(mode, 120, s.id) <= gradingWindow(mode, 1, s.id));
      assert.ok(gradingWindow(mode, 999, s.id) > 0);
    }
  assert.equal(shiftDuration(1), 100);
  assert.equal(shiftDuration(60), 240);
  assert.equal(ticketLimit(1), 3);
  assert.equal(ticketLimit(10), 5);
});
test("milk ratio is a single choice and tolerates a paused clock", () => {
  const run = createRun("milk-ratio", "normal", 1);
  const before = structuredClone(run);
  stepSkill(run, 0);
  stepSkill(run, NaN);
  assert.deepEqual(run, before);
  actSkill(run, { type: "choose", index: run.knobTarget });
  assert.ok(run.finished);
  assert.equal(run.grade, 100);
});
test("drawing grades coverage and penalizes empty or off-guide traces", () => {
  const guide = BEHAVIORS["tiger-stripes"].guide;
  assert.equal(guideGrade([], guide, 0.1), 0);
  assert.equal(guideGrade(guide, guide, 0.1), 100);
  assert.ok(
    guideGrade(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      guide,
      0.1,
    ) < 60,
  );
});

test("real timed inputs allow at least 250 ms at 60 Hz in Normal, including flow speed", () => {
  for (const skill of SKILLS.filter((s) => ["press", "sequence", "rhythm"].includes(s.input))) {
    const marks = BEHAVIORS[skill.id].marks ?? [skill.target];
    for (const [index] of marks.entries()) {
      const run = createRun(skill.id, "normal", 999, { speed: 1.1 });
      run.hits = Array(index).fill(100);
      run.marks = marks.slice(0, index);
      let current = 0;
      let longest = 0;
      while (!run.finished) {
        const probe = structuredClone(run);
        actSkill(probe, { type: "press" });
        current = (marks.length === 1 ? probe.grade : probe.hits[index]) === 100 ? current + 1 : 0;
        longest = Math.max(current, longest);
        stepSkill(run, 1 / 60);
      }
      assert.ok(longest >= 15, `${skill.id} mark ${index}: ${longest}/60 s`);
    }
  }
  for (const { steps } of RECIPES) {
    assert.ok(!steps.includes("straw-stab"));
    assert.ok(steps.every((id) => SKILLS.find((skill) => skill.id === id).input !== "hold"));
  }
});

test("six good hand runs unlock a persistent preset and the player can choose precision", () => {
  const c = newCampaign();
  const s = startShift(c);
  const t = s.tickets[s.selected];
  const cup = t.cups[0];
  t.special = null;
  for (let i = 0; i <= 6; i++) {
    cup.step = 0;
    cup.grades = [];
    assert.ok(beginWork(c, s));
    assert.equal(cup.run.variant, i < 6 ? "hand" : "quick");
    for (let frame = 0; frame < 23; frame++) tickShift(c, s, 0.1);
    if (i === 6) {
      const restored = restoreExpandedShift(JSON.parse(JSON.stringify(s)), c);
      assert.equal(restored.tickets[t.slot].cups[0].run.variant, "quick");
      assert.ok(skillAction(c, restored, { type: "precision" }, t.slot));
      assert.equal(restored.tickets[t.slot].cups[0].run.variant, "hand");
      assert.ok(skillAction(c, s, { type: "quick" }, t.slot));
      assert.equal(cup.grades[0].grade, 94);
    } else {
      cup.run.position = cup.run.target;
      assert.ok(skillAction(c, s, { type: "press" }, t.slot));
      // Return to the first station for the next practice run.
      s.chefStation = "brew";
      s.walking = 0;
    }
  }
  const saved = normalizeCampaign(JSON.parse(JSON.stringify(c)), "normal");
  assert.deepEqual(skillMastery(saved, "steep"), { goodRuns: 6, required: 6, mastered: true });
});

test("a cup saved on or past the retired straw step can be served without remaking it", () => {
  const c = newCampaign();
  const shift = startShift(c);
  delete shift.skillModel;
  const ticket = shift.tickets[shift.selected];
  const cup = ticket.cups[0];
  const { steps } = RECIPE_BY_ID[cup.recipe];
  cup.started = true;
  cup.step = steps.length;
  cup.grades = steps.map((skill) => ({ skill, grade: 94, source: null, result: "done" }));
  cup.run = createRun("straw-stab", "normal", 1);
  for (const completed of [false, true]) {
    const data = structuredClone(shift);
    const savedCup = data.tickets[ticket.slot].cups[0];
    if (completed) {
      savedCup.grades.push({ skill: "straw-stab", grade: 100 });
      savedCup.step++;
      savedCup.ready = true;
      savedCup.run = null;
    }
    const restored = restoreExpandedShift(data, c);
    const restoredCup = restored.tickets[ticket.slot].cups[0];
    assert.equal(restoredCup.step, steps.length);
    assert.deepEqual(restoredCup.grades.map((g) => g.skill), steps);
    assert.equal(restoredCup.run, null);
    assert.ok(handoff(c, restored, ticket.slot));
  }
});
