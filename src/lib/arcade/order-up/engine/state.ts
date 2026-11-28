import type { Station, Mode, SkillId } from "../content/schema.ts";
import {
  INGREDIENTS,
  MACHINES,
  POWERUPS,
  SHOPS,
  CREW_ROLES,
  TRAITS,
  DECOR,
  GUESTS,
  RECIPE_BY_ID,
  BADGES,
  GOALS,
} from "../content/index.ts";
import { BREW_MODS, WORKSHOP_PARTS, type BrewModId, type WorkshopParts } from "../content/upgrades.ts";
import type { TreeNodeId } from "../content/progression-trees.ts";
import { genericNode } from "./tree-nodes.ts";
import { TREE_NODES } from "../content/progression-trees.ts";
export const STATIONS: readonly Station[] = ["brew", "prep", "build", "serve", "stock"];
export interface ExtraLot {
  id: number;
  ingredient: string;
  quantity: number;
  expiresOn: number;
  shelf: number;
}
export interface MachineState {
  tier: number;
  condition: number;
  shop: string;
  slot: number;
  rotation: number;
  automatic: boolean;
  broken: boolean;
}
export interface WorkshopState {
  brewBench: boolean;
  parts: WorkshopParts;
  brew: Record<string, { unlocked: BrewModId[]; active: BrewModId | null } | undefined>;
}
export interface GardenFeatureState {
  sampleUntil: number;
  developed: boolean;
  calibratedMachine: string | null;
  trainedStaff: string | null;
  listed: boolean;
  lastOfferDay: number;
}
export interface StaffState {
  id: string;
  name: string;
  portrait: string;
  role: string;
  traits: string[];
  skills: Record<Station, number>;
  progress: Record<Station, number>;
  energy: number;
  station: Station | null;
  shop: string;
  rota: boolean[];
  shifts: number;
  paidDays: number[];
}
export interface Placement {
  id: string;
  x: number;
  y: number;
  rotation: number;
}
export interface ShopState {
  expansion: number;
  stars: number;
  receipts: number;
  quality: number;
  layout: Record<Station, [number, number]>;
  decor: Placement[];
  paint: string;
  manager: string | null;
}
export interface GardenPlot {
  ingredient: string | null;
  planted: number;
  watered: number;
  growth: number;
}
export interface Shipment {
  ingredient: string;
  quantity: number;
  supplier: string;
  arrivesOn: number;
  expiresOn: number;
}
export interface Route {
  priority?: true;
  to: string;
  ingredient: string;
  quantity: number;
  day: number;
  progress: number;
}
export interface ExpansionState {
  schema: 1;
  shipments: Shipment[];
  shelves: Record<string, number>;
  activeShop: string;
  shops: Record<string, ShopState>;
  extraInventory: ExtraLot[];
  machines: Record<string, MachineState>;
  workshop: WorkshopState;
  treeNodes: Record<string, TreeNodeId[] | undefined>;
  gardenFeature: GardenFeatureState;
  staff: StaffState[];
  loadout: string[];
  powerups: Record<string, number>;
  visits: Record<string, number>;
  recipes: Record<string, { count: number; best: number }>;
  metrics: Record<string, number>;
  badges: string[];
  decor: string[];
  keepsakes: string[];
  prints: string[];
  paint: string;
  apron: string;
  cupPrint: string;
  cat: boolean;
  catAccessory: string;
  garden: GardenPlot[];
  pairings: string[];
  labHistory: { ingredients: string[]; grades: number[] }[];
  houseBlend: string[];
  routes: Route[];
  truckStop: string;
  prices: Record<string, number>;
  loan: number;
  loanInterest: number;
  marketing: string | null;
  windowDisplay: string;
  dailyBests: Record<string, number>;
  selectedGoals: string[];
  goalProgress: Record<string, number>;
  claimedGoals: string[];
  rivalWins: number;
  tournamentRound: number;
  tasteoffDay: number;
  giftedDays: number[];
  seenDays: number[];
  nextId: number;
  ice: number;
  pearls: number;
  freshness: number;
  missedRent: number;
  lastReport: ExpandedReport | null;
  lessons: string[];
  totalPlaySeconds: number;
  recoveries: number;
  notice: string;
}
export interface ExpandedReport {
  day: number;
  served: number;
  lost: number;
  points: number;
  revenue: number;
  tips: number;
  wages: number;
  rent: number;
  interest: number;
  bonus: number;
  net: number;
  rankBefore: number;
  rankAfter: number;
  newBadges: string[];
  recipes: number;
  stories: number;
  average: number;
  shop: string;
}
export interface LegacySnapshot {
  day?: unknown;
  upgrades?: unknown;
  branches?: unknown;
  activeBranch?: unknown;
  crew?: unknown;
  certifiedCrew?: unknown;
  powerups?: unknown;
  regularVisits?: unknown;
  recipeRecords?: unknown;
  locationManagers?: unknown;
  [key: string]: unknown;
}
export const object = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
export const finite = (x: unknown, fallback = 0, min = 0, max = 1e12) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
const integer = (x: unknown, fallback = 0, min = 0, max = 1e9) => Math.floor(finite(x, fallback, min, max));
const text = (x: unknown, fallback = "", max = 100) => (typeof x === "string" ? x.slice(0, max) : fallback);
const list = (x: unknown) => (Array.isArray(x) ? x : []);
const ids = (x: unknown, allowed: readonly { id: string }[]) => [
  ...new Set(list(x).filter((s): s is string => typeof s === "string" && allowed.some((v) => v.id === s))),
];
const counts = (x: unknown, allowed?: readonly { id: string }[]) =>
  Object.fromEntries(
    Object.entries(object(x))
      .filter(
        ([k]) =>
          !["__proto__", "constructor", "prototype"].includes(k) &&
          k.length < 100 &&
          (!allowed || allowed.some((v) => v.id === k)),
      )
      .map(([k, v]) => [k, integer(v)]),
  );
function normalizeWorkshop(value: unknown, shops: readonly string[]): WorkshopState {
  const saved = object(value);
  const workshop: WorkshopState = { brewBench: saved.brewBench === true, parts: {}, brew: {} };
  if (!workshop.brewBench) return workshop;
  for (const { id } of WORKSHOP_PARTS) {
    const quantity = integer(object(saved.parts)[id]);
    if (quantity) workshop.parts[id] = quantity;
  }
  for (const id of shops) {
    const entry = object(object(saved.brew)[id]);
    const unlocked = BREW_MODS.filter((mod) => list(entry.unlocked).includes(mod.id)).map((mod) => mod.id);
    if (unlocked.length)
      workshop.brew[id] = { unlocked, active: unlocked.find((mod) => mod === entry.active) ?? null };
  }
  return workshop;
}

function normalizeTreeNodes(value: unknown, shops: readonly string[]): ExpansionState["treeNodes"] {
  const result: ExpansionState["treeNodes"] = {};
  for (const shop of shops) {
    const local = list(object(value)[shop]);
    const groups = new Set<string>();
    const nodes: TreeNodeId[] = [];
    for (const id of local.slice(0, TREE_NODES.length)) {
      const node = TREE_NODES.find((item) => item.id === id);
      if (!node || !genericNode(node.id) || groups.has(node.group)) continue;
      groups.add(node.group);
      nodes.push(node.id);
    }
    const qualified = new Set<TreeNodeId>();
    for (const node of [...TREE_NODES].sort((a, b) => a.day - b.day))
      if (nodes.includes(node.id) && node.requires.every((id) => !genericNode(id) || qualified.has(id)))
        qualified.add(node.id);
    const installed = nodes.filter((id) => qualified.has(id));
    if (installed.length) result[shop] = installed;
  }
  return result;
}
function blankGardenFeature(): GardenFeatureState {
  return { sampleUntil: 0, developed: false, calibratedMachine: null, trainedStaff: null, listed: false, lastOfferDay: 0 };
}

function normalizeGardenFeature(
  value: unknown,
  machines: Record<string, MachineState>,
  staff: readonly StaffState[],
  shops: readonly string[],
): GardenFeatureState {
  const saved = object(value);
  const state = blankGardenFeature();
  if (!shops.includes("garden")) return state;
  state.sampleUntil = integer(saved.sampleUntil);
  state.developed = saved.developed === true;
  if (!state.developed) return state;
  const key = text(saved.calibratedMachine, "", 120);
  if (Object.hasOwn(machines, key)) state.calibratedMachine = key;
  state.trainedStaff = staff.find((person) => person.id === saved.trainedStaff)?.id ?? null;
  state.listed = saved.listed === true && !!state.calibratedMachine && !!state.trainedStaff;
  state.lastOfferDay = integer(saved.lastOfferDay);
  return state;
}
export function emptyShop(id: string): ShopState {
  const definition = SHOPS.find((s) => s.id === id) ?? SHOPS[0];
  return {
    expansion: 0,
    stars: 1,
    receipts: 0,
    quality: 0,
    layout: structuredClone(definition.layout.counters),
    decor: [],
    paint: "clay",
    manager: null,
  };
}
export function createStaff(role: string, index: number, shop = "corner", portrait?: string): StaffState {
  const definition = CREW_ROLES.find((r) => r.id === role) ?? CREW_ROLES[0],
    guest = GUESTS.find((g) => g.id === portrait) ?? GUESTS[(index * 7 + 3) % GUESTS.length];
  return {
    id: "staff-" + index,
    name: guest.name,
    portrait: guest.id,
    role: definition.id,
    traits: [TRAITS[index % TRAITS.length].id, TRAITS[(index + 3) % TRAITS.length].id],
    skills: { brew: 1, prep: 1, build: 1, serve: 1, stock: 1 },
    progress: { brew: 0, prep: 0, build: 0, serve: 0, stock: 0 },
    energy: 100,
    station: definition.stations[0] ?? null,
    shop,
    rota: [true, true, true, true, true, false, false],
    shifts: 0,
    paidDays: [],
  };
}
export function initialExpansion(legacy: LegacySnapshot = {}): ExpansionState {
  const branches = ids(legacy.branches, SHOPS);
  if (!branches.includes("corner")) branches.unshift("corner");
  const activeShop = branches.includes(text(legacy.activeBranch)) ? text(legacy.activeBranch) : "corner";
  const machines = Object.fromEntries(
    ids(legacy.upgrades, MACHINES).map((id, i) => [
      id,
      { tier: 1, condition: 100, shop: activeShop, slot: i, rotation: 0, automatic: true, broken: false },
    ]),
  );
  const roles = ids(legacy.crew, CREW_ROLES),
    staff = roles.map((role, i) => createStaff(role, i + 1, activeShop));
  for (const s of staff)
    if (list(legacy.certifiedCrew).includes(s.role)) for (const station of STATIONS) s.skills[station] = 3;
  for (const [shop, rawManager] of Object.entries(object(legacy.locationManagers))) {
    if (!branches.includes(shop)) continue;
    const saved = object(rawManager),
      person = createStaff("manager", 100 + staff.length, shop);
    person.id = "legacy-manager-" + shop;
    person.rota = Array(7).fill(!!saved.scheduled);
    person.shifts = integer(saved.shifts);
    if (saved.certified) for (const station of STATIONS) person.skills[station] = 3;
    staff.push(person);
  }
  return {
    schema: 1,
    shipments: [],
    shelves: {},
    activeShop,
    shops: Object.fromEntries(branches.map((id) => [id, emptyShop(id)])),
    extraInventory: [],
    machines,
    workshop: normalizeWorkshop(null, branches),
    treeNodes: {},
    gardenFeature: blankGardenFeature(),
    staff,
    loadout: ["rush", "patience", "quality", "assist", "supplies"],
    powerups: Object.fromEntries(POWERUPS.map((p) => [p.id, integer(object(legacy.powerups)[p.id])])),
    visits: counts(legacy.regularVisits, GUESTS),
    recipes: {},
    metrics: {},
    badges: [],
    decor: [],
    keepsakes: [],
    prints: ["house"],
    paint: "clay",
    apron: "house",
    cupPrint: "house",
    cat: false,
    catAccessory: "",
    garden: Array.from({ length: 4 }, () => ({ ingredient: null, planted: 0, watered: 0, growth: 0 })),
    pairings: [],
    labHistory: [],
    houseBlend: [],
    routes: [],
    truckStop: "park",
    prices: {},
    loan: 0,
    loanInterest: 0,
    marketing: null,
    windowDisplay: "milk-tea",
    dailyBests: {},
    selectedGoals: [],
    goalProgress: {},
    claimedGoals: [],
    rivalWins: 0,
    tournamentRound: 0,
    tasteoffDay: 0,
    giftedDays: [],
    seenDays: [],
    nextId: 10000,
    ice: 100,
    pearls: 0,
    freshness: 1,
    missedRent: 0,
    lastReport: null,
    lessons: [],
    totalPlaySeconds: 0,
    recoveries: 0,
    notice: "",
  };
}
/**
 * Moves any counter a saved layout puts where it can't stand (a doorway, the
 * guests' way in and out, under something the shop stands on its floor:
 * the shop's `blocked` tiles) or on another counter: back to its default
 * place when that is free, otherwise the nearest free floor tile.
 */
export function settleLayout(layout: Record<Station, [number, number]>, shop: FloorPlan & { counters: Record<Station, [number, number]> }) {
  const taken = new Set<number>();
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < shop.width && y < shop.height && !shop.blocked.includes(y * shop.width + x) && !taken.has(y * shop.width + x);
  // Counters already on free floor keep their place; the rest move, in station order.
  const moving: Station[] = [];
  for (const station of STATIONS) {
    const [x, y] = layout[station];
    if (free(x, y)) taken.add(y * shop.width + x);
    else moving.push(station);
  }
  for (const station of moving) {
    const [dx, dy] = shop.counters[station];
    const [x0, y0] = layout[station];
    let best: [number, number] | null = free(dx, dy) ? [dx, dy] : null;
    for (let r = 1; !best && r < shop.width + shop.height; r++)
      for (let y = 0; y < shop.height && !best; y++)
        for (let x = 0; x < shop.width && !best; x++) if (Math.abs(x - x0) + Math.abs(y - y0) === r && free(x, y)) best = [x, y];
    if (!best) continue;
    layout[station] = best;
    taken.add(best[1] * shop.width + best[0]);
  }
  return layout;
}

type FloorPlan = { width: number; height: number; blocked: readonly number[] };

/**
 * Each shop's counters as the first release placed them, scattered round the
 * room. A save that still holds exactly these was never arranged, so it opens
 * on today's row along the back wall instead.
 */
const FORMER_COUNTERS: Record<string, Record<Station, [number, number]>> = {
  corner: { brew: [1, 1], prep: [1, 5], build: [4, 3], serve: [6, 1], stock: [4, 0] },
  campus: { brew: [1, 1], prep: [1, 4], build: [3, 3], serve: [5, 1], stock: [3, 0] },
  garden: { brew: [1, 1], prep: [1, 6], build: [4, 4], serve: [7, 1], stock: [4, 0] },
  night: { brew: [1, 1], prep: [1, 3], build: [3, 2], serve: [4, 1], stock: [3, 0] },
  station: { brew: [1, 1], prep: [1, 4], build: [5, 3], serve: [8, 1], stock: [5, 0] },
  harbor: { brew: [1, 1], prep: [1, 5], build: [4, 3], serve: [7, 1], stock: [4, 0] },
  loft: { brew: [1, 1], prep: [1, 6], build: [4, 4], serve: [6, 1], stock: [4, 0] },
  truck: { brew: [1, 1], prep: [1, 2], build: [3, 2], serve: [4, 2], stock: [3, 0] },
  boardwalk: { brew: [1, 1], prep: [1, 4], build: [4, 3], serve: [6, 1], stock: [4, 0] },
  lodge: { brew: [2, 2], prep: [1, 5], build: [5, 4], serve: [7, 2], stock: [5, 0] },
  commissary: { brew: [1, 1], prep: [1, 6], build: [5, 4], serve: [9, 1], stock: [5, 0] },
  moon: { brew: [2, 1], prep: [1, 4], build: [4, 4], serve: [6, 2], stock: [4, 0] },
};

/**
 * A floor tile for a piece of decor: `want` when it is free, otherwise the
 * nearest free one. Free is on the floor off the back walls' line, off the
 * shop's blocked tiles (its doorway and the guests' way through it) and its
 * counters, and, while there is room, off the tiles the counters' workers
 * stand on (behind a counter, or in front of one against the back wall) and
 * not under another piece.
 */
export function freeDecorTile(want: [number, number], layout: Record<Station, [number, number]>, decor: readonly { x: number; y: number }[], shop: FloorPlan): [number, number] {
  const w = shop.width;
  const counters = Object.values(layout);
  const tiers = [
    [...shop.blocked, ...counters.map(([x, y]) => y * w + x)],
    counters.map(([x, y]) => (y >= 1 ? y - 1 : 1) * w + x),
    decor.map((p) => p.y * w + p.x),
  ];
  // Give up the softer rules (another piece's tile, then a worker's) only when the floor is full.
  for (let keep = tiers.length; keep >= 1; keep--) {
    const used = new Set(tiers.slice(0, keep).flat());
    const free = (x: number, y: number) => x >= 1 && y >= 1 && x < w && y < shop.height && !used.has(y * w + x);
    if (free(want[0], want[1])) return want;
    for (let r = 1; r < w + shop.height; r++)
      for (let y = 1; y < shop.height; y++) for (let x = 1; x < w; x++) if (Math.abs(x - want[0]) + Math.abs(y - want[1]) === r && free(x, y)) return [x, y];
  }
  return want;
}

/**
 * Moves saved decor standing on a counter or a blocked tile to the nearest
 * free floor. Pieces on the back walls' line are left where they are: those
 * hang on the wall.
 */
export function settleDecor(decor: Placement[], layout: Record<Station, [number, number]>, shop: FloorPlan) {
  const w = shop.width;
  const counters = new Set(Object.values(layout).map(([x, y]) => y * w + x));
  decor.forEach((p, i) => {
    if (p.x <= 0 || p.y <= 0 || (!shop.blocked.includes(p.y * w + p.x) && !counters.has(p.y * w + p.x))) return;
    [p.x, p.y] = freeDecorTile([p.x, p.y], layout, decor.filter((_, k) => k !== i), shop);
  });
  return decor;
}

/** Normalization is deliberately bounded. An invalid field never erases the rest of a save. */
export function normalizeExpansion(value: unknown, legacy: LegacySnapshot = {}): ExpansionState {
  const base = initialExpansion(),
    s = object(value);
  if (s.schema !== 1) return initialExpansion(legacy);
  const owned = ids(Object.keys(object(s.shops)), SHOPS);
  for (const id of Object.keys(base.shops)) if (!owned.includes(id)) owned.push(id);
  const shops: Record<string, ShopState> = {};
  for (const id of owned) {
    const r = object(object(s.shops)[id]),
      d = SHOPS.find((x) => x.id === id)!;
    const layout = { ...emptyShop(id).layout };
    for (const station of STATIONS) {
      const pair = list(object(r.layout)[station]);
      if (pair.length === 2)
        layout[station] = [
          integer(pair[0], layout[station][0], 0, d.layout.width - 1),
          integer(pair[1], layout[station][1], 0, d.layout.height - 1),
        ];
    }
    const former = FORMER_COUNTERS[id];
    if (former && STATIONS.every((st) => layout[st][0] === former[st][0] && layout[st][1] === former[st][1]))
      Object.assign(layout, structuredClone(d.layout.counters));
    settleLayout(layout, d.layout);
    const decor: Placement[] = list(r.decor)
      .slice(0, 200)
      .flatMap((v) => {
        const x = object(v);
        return DECOR.some((i) => i.id === x.id)
          ? [
              {
                id: text(x.id),
                x: integer(x.x, 0, 0, d.layout.width - 1),
                y: integer(x.y, 0, 0, d.layout.height - 1),
                rotation: integer(x.rotation, 0, 0, 3),
              },
            ]
          : [];
      });
    settleDecor(decor, layout, d.layout);
    shops[id] = {
      expansion: integer(r.expansion, 0, 0, 3),
      stars: integer(r.stars, 1, 1, 5),
      receipts: integer(r.receipts),
      quality: finite(r.quality),
      layout,
      decor,
      paint: text(r.paint, "clay"),
      manager: typeof r.manager === "string" ? r.manager : null,
    };
  }
  const activeShop = owned.includes(text(s.activeShop)) ? text(s.activeShop) : base.activeShop;
  const machines: Record<string, MachineState> = {};
  for (const [id, value] of Object.entries(object(s.machines))) {
    if (!MACHINES.some((x) => x.id === (id.split("::").at(-1) ?? id)) || id.length > 120) continue;
    const m = object(value);
    machines[id] = {
      tier: integer(m.tier, 1, 1, 3),
      condition: finite(m.condition, 100, 0, 100),
      shop: owned.includes(text(m.shop)) ? text(m.shop) : activeShop,
      slot: integer(m.slot, 0, 0, 100),
      rotation: integer(m.rotation, 0, 0, 3),
      automatic: m.automatic !== false,
      broken: m.broken === true,
    };
  }
  for (const [id, m] of Object.entries(base.machines)) machines[id] ??= m;
  const staff: StaffState[] = list(s.staff)
    .slice(0, 100)
    .flatMap((v, i) => {
      const r = object(v);
      if (!CREW_ROLES.some((x) => x.id === r.role)) return [];
      const fresh = createStaff(text(r.role), i + 1, activeShop, text(r.portrait));
      return [
        {
          ...fresh,
          id: text(r.id, fresh.id),
          name: text(r.name, fresh.name),
          traits: ids(r.traits, TRAITS).slice(0, 2),
          skills: Object.fromEntries(STATIONS.map((st) => [st, integer(object(r.skills)[st], 1, 1, 5)])) as Record<
            Station,
            number
          >,
          progress: Object.fromEntries(STATIONS.map((st) => [st, finite(object(r.progress)[st], 0, 0, 100)])) as Record<
            Station,
            number
          >,
          energy: finite(r.energy, 100, 0, 100),
          station: STATIONS.includes(r.station as Station) ? (r.station as Station) : null,
          shop: owned.includes(text(r.shop)) ? text(r.shop) : activeShop,
          rota: Array.from({ length: 7 }, (_, j) => list(r.rota)[j] === true),
          shifts: integer(r.shifts),
          paidDays: list(r.paidDays)
            .filter((x): x is number => typeof x === "number" && Number.isInteger(x))
            .slice(-14),
        },
      ];
    });
  const extraInventory: ExtraLot[] = list(s.extraInventory)
    .slice(0, 2000)
    .flatMap((v, i) => {
      const l = object(v),
        ingredient = INGREDIENTS.find((x) => !x.legacy && x.id === l.ingredient);
      return ingredient && finite(l.quantity) > 0
        ? [
            {
              id: integer(l.id, 10000 + i, 1),
              ingredient: ingredient.id,
              quantity: integer(l.quantity, 0, 0, 10000),
              expiresOn: integer(l.expiresOn, 1, 1),
              shelf: integer(l.shelf, 0, 0, 15),
            },
          ]
        : [];
    });
  const recipes = Object.fromEntries(
    Object.entries(object(s.recipes))
      .filter(([id]) => !!RECIPE_BY_ID[id])
      .map(([id, v]) => [id, { count: integer(object(v).count), best: integer(object(v).best, 0, 0, 100) }]),
  );
  const report = object(s.lastReport);
  const lastReport = Object.keys(report).length
    ? {
        day: integer(report.day, 1, 1),
        served: integer(report.served),
        lost: integer(report.lost),
        points: integer(report.points),
        revenue: integer(report.revenue),
        tips: integer(report.tips),
        wages: integer(report.wages),
        rent: integer(report.rent),
        interest: integer(report.interest),
        bonus: integer(report.bonus),
        net: finite(report.net, 0, -1e9),
        rankBefore: integer(report.rankBefore, 1, 1, 60),
        rankAfter: integer(report.rankAfter, 1, 1, 60),
        newBadges: ids(report.newBadges, BADGES),
        recipes: integer(report.recipes),
        stories: integer(report.stories),
        average: finite(report.average, 0, 0, 100),
        shop: text(report.shop, "corner"),
      }
    : null;
  return {
    ...base,
    schema: 1,
    shipments: list(s.shipments)
      .slice(0, 200)
      .flatMap((v) => {
        const r = object(v);
        return INGREDIENTS.some((i) => i.id === r.ingredient)
          ? [
              {
                ingredient: text(r.ingredient),
                quantity: integer(r.quantity, 1, 1, 1000),
                supplier: text(r.supplier, "market"),
                arrivesOn: integer(r.arrivesOn, 1, 1),
                expiresOn: integer(r.expiresOn, 1, 1),
              },
            ]
          : [];
      }),
    shelves: counts(s.shelves),
    activeShop,
    shops,
    extraInventory,
    machines,
    workshop: normalizeWorkshop(s.workshop, owned),
    treeNodes: normalizeTreeNodes(s.treeNodes, owned),
    gardenFeature: normalizeGardenFeature(s.gardenFeature, machines, staff, owned),
    staff,
    loadout: ids(s.loadout, POWERUPS).slice(0, 6),
    powerups: { ...base.powerups, ...counts(s.powerups, POWERUPS) },
    visits: { ...base.visits, ...counts(s.visits, GUESTS) },
    recipes,
    metrics: counts(s.metrics),
    badges: ids(s.badges, BADGES),
    decor: ids(s.decor, DECOR),
    keepsakes: ids(s.keepsakes, DECOR),
    prints: ["house", ...ids(s.prints, DECOR)],
    paint: text(s.paint, "clay"),
    apron: text(s.apron, "house"),
    cupPrint: text(s.cupPrint, "house"),
    cat: s.cat === true,
    catAccessory: text(s.catAccessory),
    garden: Array.from({ length: 4 }, (_, i) => {
      const r = object(list(s.garden)[i]);
      return {
        ingredient: INGREDIENTS.some((x) => x.id === r.ingredient) ? text(r.ingredient) : null,
        planted: integer(r.planted),
        watered: integer(r.watered),
        growth: finite(r.growth, 0, 0, 4),
      };
    }),
    pairings: list(s.pairings)
      .filter((x): x is string => typeof x === "string" && x.length < 180)
      .slice(0, 1000),
    labHistory: list(s.labHistory)
      .slice(-30)
      .map((v) => ({
        ingredients: ids(object(v).ingredients, INGREDIENTS),
        grades: list(object(v).grades)
          .slice(0, 3)
          .map((n) => integer(n, 0, 0, 100)),
      })),
    houseBlend: ids(s.houseBlend, INGREDIENTS).slice(0, 4),
    routes: list(s.routes)
      .slice(0, 24)
      .flatMap((v) => {
        const r = object(v);
        return owned.includes(text(r.to)) && INGREDIENTS.some((x) => x.id === r.ingredient)
          ? [
              {
                to: text(r.to),
                ingredient: text(r.ingredient),
                quantity: integer(r.quantity, 1, 1, 100),
                day: integer(r.day, 1, 1),
                progress: finite(r.progress, 0, 0, 1),
                ...(r.priority === true ? { priority: true as const } : {}),
              },
            ]
          : [];
      }),
    truckStop: ["park", "stadium", "beach", "concert", "offices"].includes(text(s.truckStop))
      ? text(s.truckStop)
      : "park",
    prices: Object.fromEntries(
      Object.entries(object(s.prices))
        .filter(([id]) => id.length < 50)
        .map(([id, v]) => [id, integer(v, 1, 0, 2)]),
    ),
    loan: integer(s.loan),
    loanInterest: integer(s.loanInterest),
    marketing: typeof s.marketing === "string" ? s.marketing : null,
    windowDisplay: text(s.windowDisplay, "milk-tea"),
    dailyBests: counts(s.dailyBests),
    selectedGoals: ids(s.selectedGoals, GOALS).slice(0, 6),
    goalProgress: counts(s.goalProgress, GOALS),
    claimedGoals: list(s.claimedGoals)
      .filter((x): x is string => typeof x === "string" && x.length < 100)
      .slice(-1000),
    rivalWins: integer(s.rivalWins),
    tournamentRound: integer(s.tournamentRound, 0, 0, 4),
    tasteoffDay: integer(s.tasteoffDay),
    giftedDays: list(s.giftedDays).filter((x): x is number => typeof x === "number" && Number.isInteger(x)),
    seenDays: list(s.seenDays).filter((x): x is number => typeof x === "number" && Number.isInteger(x)),
    nextId: integer(s.nextId, 10000, 10000),
    ice: integer(s.ice, 100, 0, 1000),
    pearls: integer(s.pearls, 0, 0, 1000),
    freshness: finite(s.freshness, 1, 0, 1),
    missedRent: integer(s.missedRent),
    lastReport,
    lessons: list(s.lessons).filter((x): x is string => typeof x === "string" && x.length < 100),
    totalPlaySeconds: finite(s.totalPlaySeconds),
    recoveries: integer(s.recoveries),
    notice: text(s.notice, "", 180),
  };
}
