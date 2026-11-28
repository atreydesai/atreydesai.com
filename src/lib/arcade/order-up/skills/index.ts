import type { SkillId, Mode } from "../content/schema.ts";
import { createRun, step, act, type SkillRun, type SkillAction, type SkillBehavior } from "./common.ts";
import { steep } from "./steep.ts";
import { kettle_heat } from "./kettle-heat.ts";
import { pour } from "./pour.ts";
import { milk_ratio } from "./milk-ratio.ts";
import { pearl_pot } from "./pearl-pot.ts";
import { egg_waffle } from "./egg-waffle.ts";
import { fruit_board } from "./fruit-board.ts";
import { cheese_foam } from "./cheese-foam.ts";
import { tiger_stripes } from "./tiger-stripes.ts";
import { topping_ladle } from "./topping-ladle.ts";
import { blender } from "./blender.ts";
import { shake } from "./shake.ts";
import { seal } from "./seal.ts";
import { straw_stab } from "./straw-stab.ts";
import { torch } from "./torch.ts";
import { layered_pour } from "./layered-pour.ts";
import { colour_change } from "./colour-change.ts";
import { cream_rosette } from "./cream-rosette.ts";
import { packing } from "./packing.ts";
export const BEHAVIORS: Readonly<Record<SkillId, SkillBehavior>> = Object.fromEntries(
  [
    steep,
    kettle_heat,
    pour,
    milk_ratio,
    pearl_pot,
    egg_waffle,
    fruit_board,
    cheese_foam,
    tiger_stripes,
    topping_ladle,
    blender,
    shake,
    seal,
    straw_stab,
    torch,
    layered_pour,
    colour_change,
    cream_rosette,
    packing,
  ].map((x) => [x.id, x]),
) as Record<SkillId, SkillBehavior>;
export { createRun, gradeDistance, guideGrade } from "./common.ts";
export type { SkillRun, SkillAction, Point } from "./common.ts";
export function stepSkill(run: SkillRun, dt: number) {
  return step(run, dt, BEHAVIORS[run.id]);
}
export function actSkill(run: SkillRun, action: SkillAction) {
  return act(run, action, BEHAVIORS[run.id]);
}
