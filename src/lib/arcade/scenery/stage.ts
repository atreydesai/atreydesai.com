import type { GameId } from "#lib/boba.ts";
import { paintAscent } from "./ascent";
import { alternateScenes } from "./alternate";
import { Pixels } from "./pixel";
import { paintBar, paintKitchen, paintMarket } from "./shops";
import { paintCatch, paintRille, paintRoute } from "./streets";

const streetStudies = {
  runner: paintRoute,
  lander: paintRille,
  spill: paintKitchen,
  stab: paintMarket,
  orders: paintBar,
  catch: paintCatch,
};

export function drawStudy(canvas: HTMLCanvasElement, game: GameId, altitude: number, time: number, gameplay: boolean, alternate = false) {
  const ink = new Pixels(canvas.getContext("2d")!);
  if (alternate) alternateScenes[game](ink, time, gameplay);
  else if (game === "stack") paintAscent(ink, altitude, time, gameplay);
  else streetStudies[game](ink, time, gameplay);
}
