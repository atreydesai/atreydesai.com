import { normalizeHouseBlend, type HouseBlend } from "./orders-service.ts";

export interface BlendTin {
  presets: HouseBlend[];
  rotate: boolean;
}

export const BLEND_TIN_LIMIT = 3;

export function sameBlend(left: HouseBlend, right: HouseBlend): boolean {
  return left.tea === right.tea && left.accentTea === right.accentTea && left.milk === right.milk &&
    left.topping === right.topping && left.fruit === right.fruit && left.syrup === right.syrup &&
    left.sugar === right.sugar && left.ice === right.ice && left.float === right.float &&
    left.sparkling === right.sparkling;
}

export function normalizeBlendTin(value: unknown, day: number): BlendTin {
  const presets: HouseBlend[] = [];
  if (!value || typeof value !== "object") return { presets, rotate: false };

  const saved = value as Partial<BlendTin>;
  if (Array.isArray(saved.presets)) {
    for (const candidate of saved.presets) {
      const blend = normalizeHouseBlend(candidate, day);
      if (!blend || presets.some((preset) => sameBlend(preset, blend))) continue;
      presets.push(blend);
      if (presets.length === BLEND_TIN_LIMIT) break;
    }
  }

  return { presets, rotate: saved.rotate === true && presets.length >= 2 };
}

export function blendForDay(manual: HouseBlend | null, tin: BlendTin, day: number): HouseBlend | null {
  if (!tin.rotate) return manual;
  const { presets, rotate } = normalizeBlendTin(tin, day);
  return rotate ? presets[(day - 1) % presets.length] : manual;
}
