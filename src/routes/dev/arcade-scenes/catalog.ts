import type { GameId } from "#lib/boba.ts";

export const altitudeStops = [
  { value: 0, name: "roof garden", note: "The shop roof is the warmest part of the ascent. Chimneys, a copper water tank, and the last light in the windows establish the scale." },
  { value: 25, name: "cloud sea", note: "The rooftops drop away. Cloud shadows move at different speeds, and a cup-shaped balloon drifts in the clear air beside the tower." },
  { value: 50, name: "blue hour", note: "Cirrus gives way to the first stars. A tiny courier plane crosses the remaining sunlit band far below." },
  { value: 72, name: "earth limb", note: "A cold rim catches the day over a turning Earth. The service station crosses low and wide, while the cups stay in the clearest part of the sky." },
  { value: 100, name: "pearl orbit", note: "A ringed planet rides behind glassy ice fragments. The coaster on the near moon is the warm spot at the edge of the frame." },
];

export const studies: Record<GameId, { title: string; note: string; props: readonly string[] }> = {
  stack: {
    title: "above the shop",
    note: "Cup Stack’s city-to-orbit climb, with haze, cloud banks, and deep-space silhouettes moving at different depths.",
    props: ["tank", "balloon", "courier", "station", "probe", "ice", "shard", "ringed", "coaster-moon", "pearl-satellite"],
  },
  runner: {
    title: "rain on the delivery route",
    note: "Three rooflines slide past behind the runner. Rain, wet brick, and distant train windows carry the motion along streets below the playable roof.",
    props: ["tank", "awning", "vent", "signal", "tram", "courier-crate"],
  },
  lander: {
    title: "the copper rille",
    note: "A relay outpost on the lip of a blue-grey ravine. Beacons pick out the far bank while a ground rover makes the depth and scale of the chasm legible.",
    props: ["rover", "relay", "pennant", "coaster-moon", "lunar-beacon"],
  },
  spill: {
    title: "storm through the kitchen window",
    note: "Rain and distant lit windows move behind the shelves. The tile, copper pipework, and ruled steel worktop hold still around the pour.",
    props: ["sieve", "mold", "tins", "kettle"],
  },
  stab: {
    title: "the closing market",
    note: "Lanterns and canopy cloth belong to the stalls behind the lane. The clean red notch and the cups come forward along the belt.",
    props: ["lantern", "seal-roll", "shutter", "awning", "straw-caddy"],
  },
  orders: {
    title: "the last ticket",
    note: "The back bar catches a warm pool of lamplight. The window cools toward blue, and the last tram crosses behind the jars.",
    props: ["sugar-jar", "receipt", "milk-crate", "pump", "tram"],
  },
  catch: {
    title: "the counter on paper",
    note: "A page-side illustration of the catch game. Cups leave lines of quiet type, with paper, coral margin marks, and the moving basket supplying the motion.",
    props: ["ticket", "takeaway", "basket"],
  },
};

export const alternateStudies: typeof studies = {
  stack: {
    title: "inside the ice belt",
    note: "A band of ice sweeps diagonally behind the tower. The relay is close enough to turn, while the eclipsed moon and far dust barely move.",
    props: ["mirror", "buoy", "shard", "ice", "probe"],
  },
  runner: {
    title: "the greenhouse roofs",
    note: "Warm city hazes sit behind glass growing houses. Planters and copper edges pick out the roofline while the streets drift farther below.",
    props: ["planter", "greenhouse", "tank", "vent"],
  },
  lander: {
    title: "the long shadow",
    note: "The low sun makes every ledge read in profile. Long violet shadows cross the basin, with a copper vault at its near edge and a folding mast on the rim.",
    props: ["vault", "mast", "pennant", "rover"],
  },
  spill: {
    title: "below the sink",
    note: "The pour moves into the service space beneath a ceramic basin, among patinated pipes and a soft pink tile grid.",
    props: ["valve", "trap", "mold", "sieve"],
  },
  stab: {
    title: "the ferry market",
    note: "Day breaks on the waterfront. Pennants frame a little ferry in the mist, and the lamps on the wharf pick out the belt’s depth.",
    props: ["dock-lamp", "ferry", "seal-roll", "lantern"],
  },
  orders: {
    title: "the courtyard stand",
    note: "Orders pass through a green arch onto a sunlit sill. Planters and brass lanterns frame the service tray and the open ice box.",
    props: ["ice-chest", "tray", "planter", "lantern"],
  },
  catch: {
    title: "the folded menu",
    note: "A two-fold menu with an off-register cup print, a coral order stamp, and the little carrier used to take drinks home.",
    props: ["stamp", "carrier", "basket", "ticket"],
  },
};
