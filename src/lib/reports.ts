import { orderMath, type FullOrder } from "./ledger";
import { methodLabel } from "./payment-methods";
import { batchTotalCost, costOfGoodsSold, marginPercent, unitCosts, type CostedBatch } from "./costing";

export type Range = { from: Date; to: Date };

export type PresetKey = "this-month" | "last-month" | "last-90" | "this-year" | "all";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-90", label: "Last 90 days" },
  { key: "this-year", label: "This year" },
  { key: "all", label: "All time" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function rangeForPreset(key: PresetKey, now = new Date()): Range {
  switch (key) {
    case "this-month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "last-month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "last-90": {
      const from = startOfDay(new Date(now));
      from.setDate(from.getDate() - 89);
      return { from, to: endOfDay(now) };
    }
    case "this-year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "all":
    default:
      return { from: new Date(2000, 0, 1), to: endOfDay(now) };
  }
}

export function parseRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  preset: PresetKey,
  now = new Date(),
): Range {
  const parsed = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const from = parsed(fromRaw);
  const to = parsed(toRaw);
  if (from && to) return { from: startOfDay(from), to: endOfDay(to) };
  return rangeForPreset(preset, now);
}

export function inRange(date: Date | string, range: Range) {
  const value = new Date(date).getTime();
  return value >= range.from.getTime() && value <= range.to.getTime();
}

export type ProductRow = {
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
  cost: number;
  profit: number;
};
export type PersonRow = {
  id: string;
  name: string;
  orders: number;
  jars: number;
  billed: number;
  paid: number;
  owed: number;
};
export type MethodRow = { method: string; label: string; count: number; amount: number };

export type Report = {
  range: Range;
  orderCount: number;
  jars: number;
  billed: number;
  /** Payments received inside the range, whatever period the order came from. */
  collected: number;
  /** Still owed on orders placed inside the range. */
  outstanding: number;
  jarsMade: number;
  batchCount: number;
  /** Cash spent on batches made inside the range. */
  batchSpend: number;
  /** Cost of the jars actually ordered in the range, at weighted-average cost. */
  cogs: number;
  /** Billed minus cogs. */
  profit: number;
  marginPct: number | null;
  /** Jars ordered whose product has no batch cost — profit above is optimistic. */
  uncostedJars: number;
  products: ProductRow[];
  people: PersonRow[];
  methods: MethodRow[];
};

type ReportBatch = CostedBatch & { madeOn: Date };

export function buildReport(orders: FullOrder[], batches: ReportBatch[], range: Range): Report {
  // Unit costs come from every batch ever made, not just this period: a jar sold
  // today may well have been cooked last month.
  const costs = unitCosts(batches);
  const scoped = orders.filter((o) => inRange(o.orderedAt, range) && o.status !== "CANCELLED");

  const products = new Map<string, ProductRow>();
  const people = new Map<string, PersonRow>();
  const methods = new Map<string, MethodRow>();

  let jars = 0;
  let billed = 0;
  let outstanding = 0;
  const soldItems: { productId: string; quantity: number }[] = [];

  for (const order of scoped) {
    const math = orderMath(order);
    billed += math.total;
    outstanding += Math.max(math.balance, 0);

    const person =
      people.get(order.customerId) ??
      ({
        id: order.customerId,
        name: order.customer.name,
        orders: 0,
        jars: 0,
        billed: 0,
        paid: 0,
        owed: 0,
      } satisfies PersonRow);
    person.orders += 1;
    person.billed += math.total;
    person.paid += math.paid;
    person.owed += Math.max(math.balance, 0);

    for (const item of order.items) {
      jars += item.quantity;
      person.jars += item.quantity;
      soldItems.push({ productId: item.productId, quantity: item.quantity });

      const row =
        products.get(item.name) ??
        { name: item.name, quantity: 0, revenue: 0, orders: 0, cost: 0, profit: 0 };
      row.quantity += item.quantity;
      row.revenue += item.quantity * item.unitPrice;
      row.orders += 1;
      row.cost += (costs.get(item.productId)?.perJar ?? 0) * item.quantity;
      products.set(item.name, row);
    }

    people.set(order.customerId, person);
  }

  let collected = 0;
  for (const order of orders) {
    for (const payment of order.payments) {
      if (!inRange(payment.paidAt, range)) continue;
      collected += payment.amount;

      const row = methods.get(payment.method) ?? {
        method: payment.method,
        label: methodLabel(payment.method),
        count: 0,
        amount: 0,
      };
      row.count += 1;
      row.amount += payment.amount;
      methods.set(payment.method, row);
    }
  }

  const scopedBatches = batches.filter((b) => inRange(b.madeOn, range));
  const cogsResult = costOfGoodsSold(soldItems, costs);
  const profit = billed - cogsResult.cost;

  for (const row of products.values()) row.profit = row.revenue - row.cost;

  return {
    range,
    orderCount: scoped.length,
    jars,
    billed,
    collected,
    outstanding,
    jarsMade: scopedBatches.reduce((sum, b) => sum + b.items.reduce((n, i) => n + i.quantity, 0), 0),
    batchCount: scopedBatches.length,
    batchSpend: scopedBatches.reduce((sum, b) => sum + batchTotalCost(b), 0),
    cogs: cogsResult.cost,
    profit,
    marginPct: marginPercent(billed, profit),
    uncostedJars: cogsResult.uncostedJars,
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
    people: [...people.values()].sort((a, b) => b.billed - a.billed || a.name.localeCompare(b.name)),
    methods: [...methods.values()].sort((a, b) => b.amount - a.amount),
  };
}
