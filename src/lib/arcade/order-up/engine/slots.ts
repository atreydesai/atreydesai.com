// Order Up keeps three shops per difficulty, each in its own save slot, and
// on a development host a fourth test kitchen whose shop can be cheated
// forward to reach any part of the game. The first campaign kept a single
// save under one key; that content is retired, and its keys are removed
// the first time the slots open.
//
// DOM-free: storage is passed in, so the rules can be checked with node.

import type { CampaignMode } from "../../orders-campaign.ts";
import { SHOPS } from "../content/index.ts";

export type SlotId = "1" | "2" | "3" | "test";
/** The player's own slots, in the order the picker lists them. */
export const PLAYER_SLOTS: readonly SlotId[] = ["1", "2", "3"];
/** The cheating slot, offered only on a development host. */
export const TEST_SLOT: SlotId = "test";
/** The slot played last, so the picker can offer it first. */
export const LAST_SLOT_KEY = "boba_order_up_last_slot";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function slotKey(slot: SlotId, mode: CampaignMode) {
  return `boba_order_up_slot_${slot}_${mode}`;
}

/** Where a slot's previous save is kept before an import replaces it. */
export function beforeImportKey(slot: SlotId, mode: CampaignMode) {
  return slotKey(slot, mode) + "_before_import";
}

/** Where an unreadable save is set aside, so it is never overwritten. */
export function unreadableKey(slot: SlotId, mode: CampaignMode) {
  return slotKey(slot, mode) + "_unreadable";
}

/** The first campaign's single save and the copies it kept around it. */
export function retiredKeys(mode: CampaignMode) {
  return [
    "boba_order_up_shop_v1_" + mode,
    "boba_order_up_v2_backup_" + mode,
    "boba_order_up_before_import_" + mode,
    "boba_order_up_unreadable_backup_" + mode,
  ];
}

/** Removes the first campaign's save, whose content the game no longer has. Returns how many keys went. */
export function retireOldSaves(store: Store) {
  let removed = 0;
  for (const mode of ["normal", "expert"] as const) {
    for (const key of retiredKeys(mode)) {
      try {
        if (store.getItem(key) !== null) {
          store.removeItem(key);
          removed++;
        }
      } catch {
        // Storage can be off; nothing to retire then.
      }
    }
  }
  return removed;
}

/** Empties a slot, its import backup and anything set aside as unreadable. */
export function clearSlot(store: Store, slot: SlotId, mode: CampaignMode) {
  for (const key of [slotKey(slot, mode), beforeImportKey(slot, mode), unreadableKey(slot, mode)]) {
    try {
      store.removeItem(key);
    } catch {
      // Storage can be off.
    }
  }
}

/** The test kitchen only exists where the site is being worked on. */
export function testSlotAllowed(hostname: string, dev = false) {
  return (
    dev ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export interface SlotSummary {
  slot: SlotId;
  empty: boolean;
  /** The save is there but can't be read. */
  unreadable: boolean;
  day: number;
  cash: number;
  shop: string;
  /** A shift was left open; playing the slot goes straight back to it. */
  midShift: boolean;
  savedAt: string | null;
}

/** What the picker shows for a slot, read from its saved text. */
export function summarizeSlot(slot: SlotId, raw: string | null): SlotSummary {
  const blank: SlotSummary = { slot, empty: true, unreadable: false, day: 0, cash: 0, shop: "", midShift: false, savedAt: null };
  if (!raw) return blank;
  try {
    const data = JSON.parse(raw);
    const campaign = data?.campaign;
    if (!campaign || typeof campaign !== "object") return { ...blank, empty: false, unreadable: true };
    const shopId = campaign.expansion?.activeShop;
    return {
      slot,
      empty: false,
      unreadable: false,
      day: Number.isFinite(campaign.day) ? Math.max(1, Math.floor(campaign.day)) : 1,
      cash: Number.isFinite(campaign.cash) ? campaign.cash : 0,
      shop: SHOPS.find((s) => s.id === shopId)?.name ?? SHOPS[0].name,
      midShift: campaign.status === "open" && !!data.expandedShift,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : null,
    };
  } catch {
    return { ...blank, empty: false, unreadable: true };
  }
}

/** Every slot the picker lists on this host, read from storage. */
export function readSlots(store: Store, mode: CampaignMode, withTest: boolean) {
  const slots = withTest ? [...PLAYER_SLOTS, TEST_SLOT] : [...PLAYER_SLOTS];
  return slots.map((slot) => {
    let raw: string | null = null;
    try {
      raw = store.getItem(slotKey(slot, mode));
    } catch {
      raw = null;
    }
    return summarizeSlot(slot, raw);
  });
}

/** The best shift any of the player's own shops has run (the test kitchen never counts). */
export function bestShiftScore(store: Store, mode: CampaignMode) {
  let best = 0;
  for (const slot of PLAYER_SLOTS) {
    try {
      const score = JSON.parse(store.getItem(slotKey(slot, mode)) ?? "null")?.campaign?.bestShiftScore;
      if (Number.isSafeInteger(score) && score > best) best = score;
    } catch {
      // An unreadable slot has no best.
    }
  }
  return best;
}
