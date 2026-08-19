import type { Order, OrderItem, Payment, Customer } from "@prisma/client";

export type FullOrder = Order & {
  items: OrderItem[];
  payments: Payment[];
  customer: Customer;
};

export type OrderMath = {
  total: number;
  paid: number;
  /** Positive when the customer still owes; negative means they overpaid. */
  balance: number;
  /** Money owed to us on an order already handed over. */
  receivable: number;
  /** Money taken for product not yet delivered — we owe them kimchi. */
  prepaid: number;
  /** Balance we expect to collect at the moment of delivery. */
  collectOnDelivery: number;
  /** Paid past the order total, available toward a future order. */
  credit: number;
  settled: boolean;
};

export function orderMath(order: {
  status: Order["status"];
  items: { quantity: number; unitPrice: number }[];
  payments: { amount: number }[];
}): OrderMath {
  const total = order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const cancelled = order.status === "CANCELLED";
  const delivered = order.status === "DELIVERED";

  const balance = cancelled ? 0 : total - paid;
  const owed = Math.max(balance, 0);

  return {
    total,
    paid,
    balance,
    receivable: delivered ? owed : 0,
    prepaid: cancelled || delivered ? 0 : Math.min(paid, total),
    collectOnDelivery: delivered ? 0 : owed,
    credit: cancelled ? paid : Math.max(paid - total, 0),
    settled: !cancelled && owed === 0,
  };
}

export type OrderBucket =
  | "AWAITING_DELIVERY"
  | "PREPAID_OWE_PRODUCT"
  | "UNPAID_RECEIVABLE"
  | "SETTLED"
  | "CANCELLED";

export function bucketOf(order: { status: Order["status"] }, math: OrderMath): OrderBucket {
  if (order.status === "CANCELLED") return "CANCELLED";
  if (order.status === "DELIVERED") return math.receivable > 0 ? "UNPAID_RECEIVABLE" : "SETTLED";
  return math.prepaid > 0 ? "PREPAID_OWE_PRODUCT" : "AWAITING_DELIVERY";
}

export const BUCKET_LABEL: Record<OrderBucket, string> = {
  AWAITING_DELIVERY: "Ordered — unpaid",
  PREPAID_OWE_PRODUCT: "Prepaid — owe product",
  UNPAID_RECEIVABLE: "Delivered — owes money",
  SETTLED: "Settled",
  CANCELLED: "Cancelled",
};

export const BUCKET_CLASS: Record<OrderBucket, string> = {
  AWAITING_DELIVERY: "bg-slate-100 text-slate-700 ring-slate-200",
  PREPAID_OWE_PRODUCT: "bg-violet-100 text-violet-800 ring-violet-200",
  UNPAID_RECEIVABLE: "bg-rose-100 text-rose-800 ring-rose-200",
  SETTLED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

export type Totals = {
  ordersOpen: number;
  orderedValue: number;
  collected: number;
  receivable: number;
  prepaid: number;
  collectOnDelivery: number;
  outstanding: number;
  credit: number;
  jarsOwed: number;
};

export function rollUp(orders: FullOrder[]): Totals {
  const t: Totals = {
    ordersOpen: 0,
    orderedValue: 0,
    collected: 0,
    receivable: 0,
    prepaid: 0,
    collectOnDelivery: 0,
    outstanding: 0,
    credit: 0,
    jarsOwed: 0,
  };

  for (const order of orders) {
    const m = orderMath(order);
    if (order.status === "CANCELLED") continue;
    if (order.status === "PENDING") {
      t.ordersOpen += 1;
      t.jarsOwed += order.items.reduce((sum, i) => sum + i.quantity, 0);
    }
    t.orderedValue += m.total;
    t.collected += m.paid;
    t.receivable += m.receivable;
    t.prepaid += m.prepaid;
    t.collectOnDelivery += m.collectOnDelivery;
    t.credit += m.credit;
  }

  t.outstanding = t.receivable + t.collectOnDelivery;
  return t;
}
