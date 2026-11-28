/**
 * The original shop's customer floor walks guests in, queues them, hands
 * them their cup and walks them out. It reads the first campaign's service
 * orders, so this adapter keeps a running list of the expansion's tickets in
 * that shape: a ticket on the rail is waiting in line, a ticket whose cups
 * are all ready waits at pickup, and a ticket that left the rail is served
 * (it has a receipt) or missed (it does not).
 */
import type { Shift } from "../engine/shift-types.ts";

export interface FloorOrder {
  id: string;
  customerId: string;
  customerName: string;
  arrivesAt: number;
  patience: number;
  maxPatience: number;
  status: "accepted" | "served" | "missed";
  cup: { sealed: boolean } | null;
  /** The ticket's slot on the rail, while it is there. */
  slot: number;
  /** The special guest it is (a crammer, a parent and child), how many cups, and how many times it has come round again. */
  special?: string | null;
  cups?: number;
  refills?: number;
}

export interface FloorState {
  day: number;
  elapsed: number;
  orders: FloorOrder[];
  receipts: { orderId: string; quality: number }[];
  houseRoundAt?: number;
}

/** Guests who left stay on the list this long, so they can walk out. */
const DEPARTED_SECONDS = 12;

export function createFloor() {
  const known = new Map<number, FloorOrder & { leftAt?: number }>();
  let current = "";

  return function floor(s: Shift): FloorState {
    const key = s.mode + ":" + s.day + ":" + s.shop + ":" + s.seed;
    if (key !== current && s.elapsed < 1) known.clear();
    current = key;
    const present = new Set<number>();
    for (const ticket of s.tickets) {
      // A supply tray at the commissary is not a guest.
      if (!ticket || !ticket.guest) continue;
      present.add(ticket.id);
      known.set(ticket.id, {
        id: String(ticket.id),
        customerId: ticket.guest,
        customerName: ticket.name,
        arrivesAt: ticket.arrived,
        patience: ticket.sleeping ? ticket.maxPatience : ticket.patience,
        maxPatience: ticket.maxPatience,
        status: "accepted",
        cup: { sealed: ticket.cups.every((cup) => cup.ready) },
        slot: ticket.slot,
        special: ticket.special,
        cups: ticket.cups.length,
        refills: ticket.refills ?? 0,
      });
    }
    for (const [id, order] of known) {
      if (present.has(id)) continue;
      if (order.status === "accepted") {
        order.status = s.receipts.some((receipt) => receipt.ticket === id) ? "served" : "missed";
        order.leftAt = s.elapsed;
        order.slot = -1;
      }
      if (s.elapsed - (order.leftAt ?? s.elapsed) > DEPARTED_SECONDS) known.delete(id);
    }
    const best = new Map<number, number>();
    for (const receipt of s.receipts) best.set(receipt.ticket, Math.max(best.get(receipt.ticket) ?? 0, receipt.grade));
    return {
      day: s.day,
      elapsed: s.elapsed,
      orders: [...known.values()].sort((a, b) => a.arrivesAt - b.arrivesAt),
      receipts: [...best].map(([ticket, quality]) => ({ orderId: String(ticket), quality })),
    };
  };
}
