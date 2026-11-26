const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export type ShopSound = "tap" | "ticket" | "heat" | "brew" | "portion" | "ice" | "shake" | "sizzle" | "seal" | "tray" | "serve";

export function money(cents: number) {
  return currency.format(cents / 100);
}
