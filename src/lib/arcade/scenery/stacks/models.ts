import type { GameId } from "#lib/boba.ts";
import type { SpriteModel } from "./types";
import { basket } from "./art/basket";
import { crate } from "./art/crate";
import { beacon } from "./art/beacon";
import { satellite } from "./art/satellite";
import { kettle } from "./art/kettle";
import { caddy } from "./art/caddy";
import { pump } from "./art/pump";

export const models: Record<GameId, SpriteModel> = {
  catch: basket,
  runner: crate,
  lander: beacon,
  stack: satellite,
  spill: kettle,
  stab: caddy,
  orders: pump,
};
