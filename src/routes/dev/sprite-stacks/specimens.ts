import type { GameId } from "#lib/boba.ts";

interface Specimen {
  name: string;
  description: string;
  use: string;
  scene: string;
  angle: number;
  groundY?: number;
}

export const specimens: Record<GameId, Specimen> = {
  catch: {
    name: "wicker carry basket",
    description: "An open wicker basket with a folded coral napkin and an arched handle.",
    use: "A basket for the results slip, where a turn would give the weave a moment in the light.",
    scene: "catch",
    groundY: 54,
    angle: 30,
  },
  runner: {
    name: "courier crate",
    description: "A strapped delivery crate with a cream address slip and brass latches.",
    use: "Set it on a clear rooftop as a delivery prop between obstacle runs.",
    scene: "roof",
    angle: 30,
  },
  lander: {
    name: "lunar beacon",
    description: "An amber lantern on three splayed feet, with a red cap and a radio aerial.",
    use: "Give a landing site a marker just outside the playable coasters.",
    scene: "moon",
    groundY: 52,
    angle: 30,
  },
  stack: {
    name: "pearl satellite",
    description: "A gold dish and tea-brown body between two blue solar wings.",
    use: "Let it drift past the tower in Cup Stack’s orbital skyline.",
    scene: "orbit",
    angle: 30,
  },
  spill: {
    name: "copper kettle",
    description: "A broad copper belly, a raised lid, and a hollow handle opposite a long spout.",
    use: "Put it on the back-kitchen shelf, where the handle can show in profile.",
    scene: "kitchen",
    angle: 97.5,
  },
  stab: {
    name: "straw caddy",
    description: "A ribbed counter pot holding a fan of cream, coral, and pink straws.",
    use: "Sit it at the night-market stall, clear of the belt’s timing notch.",
    scene: "stall",
    groundY: 66,
    angle: 22.5,
  },
  orders: {
    name: "syrup pump",
    description: "An amber bottle with a cream order label and a coral pump head.",
    use: "Try it as a counter prop or an end-of-shift illustration.",
    scene: "counter",
    groundY: 62,
    angle: 30,
  },
};
