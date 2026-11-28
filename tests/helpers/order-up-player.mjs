import { acceptChange } from "../../src/lib/arcade/order-up/engine/guest-actions.ts";
import { SKILLS } from "../../src/lib/arcade/order-up/content/index.ts";
import { BEHAVIORS, createRun, stepSkill, actSkill } from "../../src/lib/arcade/order-up/skills/index.ts";
import {
  startShift,
  tickShift,
  settleShift,
  beginWork,
  currentSkill,
  setStation,
  skillAction,
  handoff,
  wakeGuest,
  feedCat,
  shooGull,
  inspectUsual,
} from "../../src/lib/arcade/order-up/engine/shift.ts";
export const FRAME = 1 / 60;
/** A visible-cue player, not a grade injector. Anticipation is offset by timing jitter. */
export function gesture(run, memory = {}, jitter = 0.012) {
  const def = SKILLS.find((s) => s.id === run.id),
    behavior = BEHAVIORS[run.id];
  if (run.finished || run.automatic !== null) return null;
  if (def.input === "knob")
    return run.knob !== run.knobTarget ? { type: "knob", value: run.knobTarget } : { type: "press" };
  if (def.input === "drag") {
    const guide = behavior.guide ?? [];
    const index = memory.index ?? 0;
    if (index < guide.length) {
      memory.index = index + 1;
      return { type: "point", x: guide[index].x + jitter, y: guide[index].y - jitter };
    }
    return { type: "finish" };
  }
  if (def.input === "hold" && !run.held) return { type: "down" };
  if (def.input === "sequence" || def.input === "rhythm") {
    const marks = behavior.marks ?? [0.18, 0.38, 0.58, 0.78],
      target = marks[run.marks.length];
    return target !== undefined && run.position >= target + jitter ? { type: "press" } : null;
  }
  if (Math.abs(run.position - run.target) <= run.window * 0.14 + Math.abs(jitter) * 0.35)
    return { type: def.input === "hold" ? "up" : "press" };
  return null;
}
export function playSkill(id, mode = "normal", day = 120, { jitter = 0.008 } = {}) {
  const run = createRun(id, mode, day),
    memory = {};
  let next = 0;
  // There is a 160ms reaction to the new skill; moving cues can be anticipated.
  for (let time = 0; time < 7 && !run.finished; time += FRAME) {
    if (time >= 0.16 && time >= next) {
      const a = gesture(run, memory, jitter);
      if (a) {
        actSkill(run, a);
        next = time + (a.type === "point" ? 0.07 : 0.12);
      }
    }
    stepSkill(run, FRAME);
  }
  return run;
}
export function playDay(c, { maxSeconds = 400, jitter = 0.009, record = false } = {}) {
  const s = startShift(c),
    memories = new WeakMap();
  let next = 0,
    commands = 0,
    missedInput = 0;
  const trace = [];
  while (s.status !== "complete" && s.realElapsed < maxSeconds) {
    if (s.realElapsed >= next) {
      if (s.gull.active) {
        shooGull(c, s);
        next = s.realElapsed + 0.18;
        commands++;
      } else {
        const ready = s.tickets.find((t) => t?.cups.every((c) => c.ready));
        if (ready) {
          if (ready.changeTo) acceptChange(c, s, ready.slot);
          else handoff(c, s, ready.slot);
          next = s.realElapsed + 0.18;
          commands++;
        } else {
          let tickets = s.tickets.filter(Boolean).sort((a, b) => a.patience - b.patience);
          let selected = null,
            cup = null;
          // Finish moving needles before going back to a passive kettle.
          for (const t of tickets) {
            const u = t.cups.find((u) => u.run && u.run.automatic === null && u.warmup <= 0);
            if (u) {
              selected = t;
              cup = u;
              break;
            }
          }
          if (!selected)
            for (const t of tickets) {
              const u = t.cups.find((u) => !u.ready && !u.run);
              if (u) {
                selected = t;
                cup = u;
                break;
              }
            }
          if (selected && cup) {
            s.selected = selected.slot;
            selected.cupIndex = selected.cups.indexOf(cup);
            if (selected.sleeping) {
              wakeGuest(s);
              next = s.realElapsed + 0.18;
              commands++;
            } else if (selected.changeTo) {
              acceptChange(c, s, selected.slot);
              next = s.realElapsed + 0.3;
              commands++;
            } else if (selected.usual && !selected.revealed) {
              inspectUsual(s);
              next = s.realElapsed + 0.3;
              commands++;
            } else if (selected.special === "cat") {
              feedCat(c, s);
              next = s.realElapsed + 0.18;
              commands++;
            } else if (cup.run) {
              let memory = memories.get(cup.run);
              if (!memory) {
                memory = {};
                memories.set(cup.run, memory);
              }
              if (cup.warmup <= 0) {
                const a = gesture(cup.run, memory, jitter);
                if (a) {
                  const run = cup.run;
                  skillAction(c, s, a);
                  next = s.realElapsed + (a.type === "point" ? 0.07 : 0.13);
                  commands++;
                  if (record)
                    trace.push({
                      time: s.realElapsed,
                      skill: run.id,
                      input: a.type,
                      grade: run.finished ? run.grade : null,
                    });
                }
              }
            } else {
              const def = SKILLS.find((k) => k.id === currentSkill(cup));
              if (def) {
                if (s.chefStation !== def.station) {
                  setStation(c, s, def.station);
                  next = s.realElapsed + 0.16;
                  commands++;
                } else if (s.walking <= 0) {
                  beginWork(c, s);
                  next = s.realElapsed + 0.16;
                  commands++;
                }
              }
            }
          }
        }
      }
    }
    tickShift(c, s, FRAME);
  }
  const report = settleShift(c, s);
  return { shift: s, report, commands, trace };
}
