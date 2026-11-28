import type { SkillId, Mode } from "../content/schema.ts";
import { SKILLS } from "../content/skills.ts";
import { gradingWindow } from "../engine/tuning.ts";
import { ladleAt, sealNeedle, stepPour, SEAL_PERIOD } from "../../orders-engine.js";
export interface Point {
  x: number;
  y: number;
}
export interface SkillRun {
  id: SkillId;
  mode: Mode;
  day: number;
  elapsed: number;
  seconds: number;
  target: number;
  window: number;
  position: number;
  held: boolean;
  holdSeconds: number;
  hits: number[];
  marks: number[];
  path: Point[];
  cursor: Point;
  knob: number;
  knobTarget: number;
  finished: boolean;
  grade: number;
  automatic: number | null;
  source: string | null;
  result: string;
  speed: number;
}
export type SkillAction =
  | { type: "press" }
  | { type: "down" }
  | { type: "up" }
  | { type: "point"; x: number; y: number }
  | { type: "knob"; value: number }
  | { type: "arrow"; x: number; y: number }
  | { type: "finish" };
export interface SkillBehavior {
  id: SkillId;
  motion: "linear" | "ladle" | "seal" | "pour" | "sequence" | "rhythm" | "drag" | "knob";
  marks?: number[];
  guide?: Point[];
  good: string;
  under: string;
  over: string;
}
export function createRun(
  id: SkillId,
  mode: Mode,
  day: number,
  options: { window?: number; speed?: number; tea?: string; automatic?: number; source?: string } = {},
): SkillRun {
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) throw new Error(`Unknown station skill: ${id}`);
  return {
    id,
    mode,
    day,
    elapsed: 0,
    seconds: skill.seconds,
    target: skill.target,
    window: gradingWindow(mode, day, id) * (options.window ?? 1),
    position: 0,
    held: false,
    holdSeconds: 0,
    hits: [],
    marks: [],
    path: [],
    cursor: { x: 0.15, y: 0.2 },
    knob: 1,
    knobTarget: ["green", "jasmine", "matcha"].includes(options.tea ?? "")
      ? 0
      : ["black", "coffee", "barley"].includes(options.tea ?? "")
        ? 2
        : 1,
    finished: false,
    grade: 0,
    automatic: options.automatic ?? null,
    source: options.source ?? null,
    result: "",
    speed: options.speed ?? 1,
  };
}
/** The archive's clear clean/near/miss idea, now scaled through the shared tuning table. */
export function gradeDistance(error: number, window: number) {
  const d = Math.abs(error) / Math.max(0.001, window);
  return Math.round(
    d <= 0.32
      ? 100
      : d <= 1
        ? 100 - ((d - 0.32) / 0.68) * 20
        : d <= 2
          ? 80 - (d - 1) * 40
          : Math.max(0, 40 - (d - 2) * 25),
  );
}
export function finish(run: SkillRun, grade: number, behavior: SkillBehavior) {
  run.finished = true;
  run.held = false;
  run.grade = Math.max(0, Math.min(100, Math.round(grade)));
  run.result = run.grade >= 90 ? behavior.good : run.position > run.target ? behavior.over : behavior.under;
  return run;
}
export function guideGrade(path: Point[], guide: Point[], window: number) {
  if (path.length < 3) return 0;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const polylineDistance = (point: Point, line: Point[]) => {
    if (line.length === 1) return distance(point, line[0]);
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i],
        dx = b.x - a.x,
        dy = b.y - a.y,
        den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / den)) : 0;
      best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
    }
    return best;
  };
  // The drawn line is continuous; sampling fewer pointer events must not lower a grade.
  const error = guide.reduce((sum, target) => sum + polylineDistance(target, path), 0) / guide.length;
  const precision = path.reduce((sum, p) => sum + polylineDistance(p, guide), 0) / path.length;
  const coverage = guide.filter((target) => polylineDistance(target, path) < window * 1.6).length / guide.length;
  // Long scribbles do not earn perfect coverage by visiting every pixel.
  let length = 0;
  for (let i = 1; i < path.length; i++) length += distance(path[i - 1], path[i]);
  let ideal = 0;
  for (let i = 1; i < guide.length; i++) ideal += distance(guide[i - 1], guide[i]);
  const retrace = Math.max(0, length - ideal * 1.8) * 6;
  return Math.max(
    0,
    Math.round(gradeDistance(error * 0.5 + precision * 0.5, window) * (0.45 + 0.55 * coverage) - retrace),
  );
}
export function step(run: SkillRun, dt: number, behavior: SkillBehavior) {
  if (run.finished || !Number.isFinite(dt) || dt <= 0) return run;
  const def = SKILLS.find((s) => s.id === run.id)!;
  const delta = Math.min(dt, 0.1) * run.speed;
  if (run.automatic !== null) {
    run.elapsed += delta;
    if (run.elapsed >= run.seconds) finish(run, Math.min(97, run.automatic), behavior);
    run.position = Math.min(1, run.elapsed / run.seconds);
    return run;
  }
  // Held tools stop when released; kettles and irons keep their own clock.
  if (def.input === "hold" && !run.held) return run;
  if (def.input === "drag" && !run.held && run.path.length === 0) return run;
  run.elapsed += delta;
  const phase = Math.min(1, run.elapsed / run.seconds);
  if (behavior.motion === "pour") {
    run.holdSeconds += delta;
    run.position = stepPour(run.position, run.holdSeconds, delta);
  } else if (behavior.motion === "ladle") run.position = (ladleAt(phase, Math.PI * 2, -Math.PI / 2) + 1) / 2;
  else if (behavior.motion === "seal") run.position = sealNeedle(phase * SEAL_PERIOD, false);
  else run.position = phase;
  if (run.elapsed >= run.seconds) {
    if (def.input === "rhythm")
      finish(run, run.hits.reduce((a, b) => a + b, 0) / 4 - Math.max(0, run.marks.length - 4) * 15, behavior);
    else if (def.input === "drag") finish(run, guideGrade(run.path, behavior.guide ?? [], run.window), behavior);
    else if (def.input === "knob") finish(run, run.knob === run.knobTarget ? 100 : 30, behavior);
    else if (def.input === "sequence") finish(run, run.hits.reduce((a, b) => a + b, 0) / def.steps.length, behavior);
    else finish(run, 0, behavior);
  }
  return run;
}
export function act(run: SkillRun, action: SkillAction, behavior: SkillBehavior) {
  if (run.finished || run.automatic !== null) return run;
  const def = SKILLS.find((s) => s.id === run.id)!;
  if (action.type === "knob") {
    run.knob = Math.max(0, Math.min(2, Math.round(action.value)));
    return run;
  }
  if (action.type === "arrow") {
    if (def.input === "knob") run.knob = Math.max(0, Math.min(2, run.knob + Math.sign(action.x || -action.y)));
    if (def.input === "drag") {
      run.cursor = {
        x: Math.max(0, Math.min(1, run.cursor.x + action.x * 0.08)),
        y: Math.max(0, Math.min(1, run.cursor.y + action.y * 0.08)),
      };
      run.held = true;
      run.path.push({ ...run.cursor });
    }
    return run;
  }
  if (action.type === "point" && def.input === "drag") {
    const p = { x: Math.max(0, Math.min(1, action.x)), y: Math.max(0, Math.min(1, action.y)) };
    run.cursor = p;
    if (run.path.length < 180) run.path.push(p);
    return run;
  }
  if (action.type === "down") {
    run.held = true;
    return run;
  }
  if (action.type === "up") {
    if (def.input === "hold" && run.held) {
      const over = run.position > run.target ? 1.3 : 1;
      finish(run, gradeDistance((run.position - run.target) * over, run.window), behavior);
    } else if (def.input === "drag" && run.path.length)
      finish(run, guideGrade(run.path, behavior.guide ?? [], run.window), behavior);
    run.held = false;
    return run;
  }
  if (action.type === "finish" && def.input === "drag")
    return finish(run, guideGrade(run.path, behavior.guide ?? [], run.window), behavior);
  if (action.type === "press") {
    if (def.input === "press") return finish(run, gradeDistance(run.position - run.target, run.window), behavior);
    if (def.input === "knob") return finish(run, run.knob === run.knobTarget ? 100 : 30, behavior);
    if (def.input === "hold") {
      if (run.held) return act(run, { type: "up" }, behavior);
      run.held = true;
      return run;
    }
    if (def.input === "drag") return act(run, { type: "finish" }, behavior);
    if (def.input === "sequence") {
      const marks = behavior.marks ?? [0.12, 0.46, 0.82],
        idx = run.hits.length;
      run.hits.push(gradeDistance(run.position - marks[idx], run.window));
      run.marks.push(run.position);
      if (run.hits.length >= def.steps.length)
        finish(run, run.hits.reduce((a, b) => a + b, 0) / def.steps.length, behavior);
      return run;
    }
    if (def.input === "rhythm") {
      const marks = behavior.marks ?? [0.18, 0.38, 0.58, 0.78],
        idx = run.marks.length;
      run.marks.push(run.position);
      if (idx < 4) run.hits.push(gradeDistance(run.position - marks[idx], run.window * 0.85));
      return run;
    }
  }
  return run;
}
