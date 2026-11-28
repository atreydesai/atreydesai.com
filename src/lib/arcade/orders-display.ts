import { bestShiftScore } from "./order-up/engine/slots.ts";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export type ShopSound = "tap" | "ticket" | "heat" | "brew" | "portion" | "ice" | "shake" | "sizzle" | "seal" | "tray" | "serve";

export function money(cents: number) {
  return currency.format(cents / 100);
}

/** The best shift any of the player's own Order Up shops has run, for the menu. */
export function readBestShiftScore(mode: "normal" | "expert") {
  try {
    return bestShiftScore(localStorage, mode);
  } catch {
    return 0;
  }
}
