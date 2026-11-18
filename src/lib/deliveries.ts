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

/** What the next cook has to contain, in weight. */
export type ToMake = { varietyId: string; name: string; weightOz: number };

export type Run = {
  ready: Stop[];
  waiting: Stop[];
  stops: number;
  jars: number;
  collect: number;
  /** Weight owed on open orders that no batch covers yet. */
  toMake: ToMake[];
  toMakeWeightOz: number;
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
 * @param spareByVariety ounces on hand and unclaimed, per kimchi — subtracted
 * from what open orders need so the make-list doesn't ask for kimchi that is
 * already sitting in the fridge.
 */
export function buildRun(orders: FullOrder[], spareByVariety: Map<string, number> = new Map()): Run {
  const open = orders.filter((o) => o.status === "PENDING");

  // Oldest order first: whoever has waited longest gets handed their jars first.
  const byAge = [...open].sort((a, b) => a.orderedAt.getTime() - b.orderedAt.getTime());

  const ready: Stop[] = [];
  const waiting: Stop[] = [];

  for (const order of byAge) {
    (readinessOf(order).ready ? ready : waiting).push(toStop(order));
  }

  // What the next cook needs: the weight behind every unattached line on an
  // open order, less any spare already made. The subtraction is carried across
  // orders, so two orders cannot both be told the same spare pound covers them.
  const needed = new Map<string, ToMake>();
  const spare = new Map(spareByVariety);

  for (const order of byAge) {
    for (const item of order.items) {
      if (item.batchId) continue;
      const varietyId = item.varietyId ?? item.productId;
      const wanted = item.quantity * (item.jarWeightOz ?? 16);

      const available = spare.get(varietyId) ?? 0;
      const short = Math.max(wanted - available, 0);
      spare.set(varietyId, Math.max(available - wanted, 0));
      if (short === 0) continue;

      const row = needed.get(varietyId) ?? { varietyId, name: item.name, weightOz: 0 };
      row.weightOz += short;
      needed.set(varietyId, row);
    }
  }

  const toMake = [...needed.values()].sort(
    (a, b) => b.weightOz - a.weightOz || a.name.localeCompare(b.name),
  );

  return {
    ready,
    waiting,
    stops: ready.length,
    jars: ready.reduce((sum, s) => sum + s.jars, 0),
    collect: ready.reduce((sum, s) => sum + s.collect, 0),
    toMake,
    toMakeWeightOz: toMake.reduce((sum, r) => sum + r.weightOz, 0),
  };
}
