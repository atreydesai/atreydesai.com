const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export type ShopSound = "tap" | "ticket" | "heat" | "brew" | "portion" | "ice" | "shake" | "sizzle" | "seal" | "tray" | "serve";

export function money(cents: number) {
  return currency.format(cents / 100);
}

export function shopSaveKey(mode: "normal" | "expert") {
  return "boba_order_up_shop_v1_" + mode;
}

export function readBestShiftScore(mode: "normal" | "expert") {
  try {
    const score = JSON.parse(localStorage.getItem(shopSaveKey(mode)) ?? "null")?.campaign?.bestShiftScore;
    return Number.isSafeInteger(score) && score > 0 ? score : 0;
  } catch {
    return 0;
  }
}
