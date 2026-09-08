import { orderMath, type FullOrder } from "./ledger";
import { readinessOf } from "./readiness";

/**
 * A delivery run. Production here is driven by demand rather than a schedule,
 * so this doesn't assume a delivery day: it answers what can go out right now,
 * what is still waiting on a cook, and what that cook needs to contain.
 */

export type Stop = {
  orderId: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  orderedAt: Date;
  jars: number;
  items: { name: string; quantity: number; batchCode: string | null }[];
  /** Cash to take at the door. Zero when they already paid up front. */
  collect: number;
  prepaid: boolean;
  batchCodes: string[];
};

export type ToMake = { productId: string; name: string; quantity: number };

export type Run = {
  ready: Stop[];
  waiting: Stop[];
  stops: number;
  jars: number;
  collect: number;
  /** Jars owed on open orders that no batch covers yet. */
  toMake: ToMake[];
  toMakeJars: number;
};

function toStop(order: FullOrder): Stop {
  const math = orderMath(order);
  const codes = [...new Set(order.items.map((i) => i.batch?.code).filter(Boolean))] as string[];

  return {
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customer.name,
    phone: order.customer.phone ?? null,
    orderedAt: order.orderedAt,
    jars: order.items.reduce((sum, i) => sum + i.quantity, 0),
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      batchCode: i.batch?.code ?? null,
    })),
    collect: math.collectOnDelivery,
    prepaid: math.collectOnDelivery === 0,
    batchCodes: codes,
  };
}

/**
 * @param spareByProduct jars on hand and unclaimed, per product — subtracted
 * from what open orders need so the make-list doesn't ask for kimchi that is
 * already sitting in the fridge.
 */
export function buildRun(orders: FullOrder[], spareByProduct: Map<string, number> = new Map()): Run {
  const open = orders.filter((o) => o.status === "PENDING");

  // Oldest order first: whoever has waited longest gets handed their jars first.
  const byAge = [...open].sort((a, b) => a.orderedAt.getTime() - b.orderedAt.getTime());

  const ready: Stop[] = [];
  const waiting: Stop[] = [];

  for (const order of byAge) {
    (readinessOf(order).ready ? ready : waiting).push(toStop(order));
  }

  // What the next cook needs: every unattached line on an open order, less any
  // spare jars already made.
  const needed = new Map<string, ToMake>();
  const spare = new Map(spareByProduct);

  for (const order of byAge) {
    for (const item of order.items) {
      if (item.batchId) continue;
      const available = spare.get(item.productId) ?? 0;
      const short = Math.max(item.quantity - available, 0);
      spare.set(item.productId, Math.max(available - item.quantity, 0));
      if (short === 0) continue;

      const row = needed.get(item.productId) ?? {
        productId: item.productId,
        name: item.name,
        quantity: 0,
      };
      row.quantity += short;
      needed.set(item.productId, row);
    }
  }

  const toMake = [...needed.values()].sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name),
  );

  return {
    ready,
    waiting,
    stops: ready.length,
    jars: ready.reduce((sum, s) => sum + s.jars, 0),
    collect: ready.reduce((sum, s) => sum + s.collect, 0),
    toMake,
    toMakeJars: toMake.reduce((sum, r) => sum + r.quantity, 0),
  };
}
