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
test("holds require release and tolerate a paused clock", () => {
  const run = createRun("milk-ratio", "normal", 1);
  stepSkill(run, 0.1);
  assert.equal(run.elapsed, 0);
  actSkill(run, { type: "down" });
  for (let i = 0; i < 10; i++) stepSkill(run, 0.1);
  const before = structuredClone(run);
  stepSkill(run, 0);
  stepSkill(run, NaN);
  assert.deepEqual(run, before);
  actSkill(run, { type: "up" });
  assert.ok(run.finished);
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
