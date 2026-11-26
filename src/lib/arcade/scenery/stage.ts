import type { GameId } from "#lib/boba.ts";
import { paintAscent } from "./ascent";
import { alternateScenes, paintIceBelt } from "./alternate";
import { Pixels } from "./pixel";
import { paintBar, paintKitchen, paintMarket } from "./shops";
import { paintCatch, paintRille, paintRoute } from "./streets";

const scenes = {
  runner: paintRoute,
  lander: paintRille,
  spill: paintKitchen,
  stab: paintMarket,
  orders: paintBar,
  catch: paintCatch,
};

export function renderBackdrop(canvas: HTMLCanvasElement, game: GameId, altitude: number, time: number, alternate = false, entry = 1) {
  const ink = new Pixels(canvas.getContext("2d")!);
  if (game === "stack") {
    if (alternate) paintIceBelt(ink, time, entry);
    else paintAscent(ink, altitude, time);
  } else if (alternate) alternateScenes[game](ink, time);
  else scenes[game](ink, time);
}
