import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, orderMath, rollUp, type FullOrder } from "./ledger";

function make(
  status: "PENDING" | "DELIVERED" | "CANCELLED",
  items: [number, number][],
  payments: number[] = [],
) {
  return {
    status,
    items: items.map(([quantity, unitPrice]) => ({ quantity, unitPrice })),
    payments: payments.map((amount) => ({ amount })),
  };
}

test("ordered, nothing paid, not delivered: collect the full total on delivery", () => {
  const order = make("PENDING", [[2, 2500]]);
  const m = orderMath(order);
  assert.equal(m.total, 5000);
  assert.equal(m.collectOnDelivery, 5000);
  assert.equal(m.receivable, 0);
  assert.equal(m.prepaid, 0);
  assert.equal(bucketOf(order, m), "AWAITING_DELIVERY");
});

test("prepaid but not delivered: we owe product, nothing to collect", () => {
  const order = make("PENDING", [[2, 2500]], [5000]);
  const m = orderMath(order);
  assert.equal(m.prepaid, 5000);
  assert.equal(m.collectOnDelivery, 0);
  assert.equal(m.receivable, 0);
  assert.equal(bucketOf(order, m), "PREPAID_OWE_PRODUCT");
});

test("delivered but unpaid: it is a receivable", () => {
  const order = make("DELIVERED", [[1, 2500]]);
  const m = orderMath(order);
  assert.equal(m.receivable, 2500);
  assert.equal(m.collectOnDelivery, 0);
  assert.equal(m.prepaid, 0);
  assert.equal(bucketOf(order, m), "UNPAID_RECEIVABLE");
});

test("partly prepaid and undelivered: split between product owed and cash due", () => {
  const order = make("PENDING", [[4, 2500]], [4000]);
  const m = orderMath(order);
  assert.equal(m.total, 10000);
  assert.equal(m.prepaid, 4000);
  assert.equal(m.collectOnDelivery, 6000);
  assert.equal(bucketOf(order, m), "PREPAID_OWE_PRODUCT");
});

test("overpayment becomes credit, never negative product owed", () => {
  const order = make("PENDING", [[1, 2500]], [4000]);
  const m = orderMath(order);
  assert.equal(m.prepaid, 2500);
  assert.equal(m.credit, 1500);
  assert.equal(m.collectOnDelivery, 0);
});

test("delivered and paid in full settles", () => {
  const order = make("DELIVERED", [[1, 2500]], [1000, 1500]);
  const m = orderMath(order);
  assert.equal(m.balance, 0);
  assert.equal(m.receivable, 0);
  assert.ok(m.settled);
  assert.equal(bucketOf(order, m), "SETTLED");
});

test("cancelled orders owe nothing but keep money received as credit", () => {
  const order = make("CANCELLED", [[1, 2500]], [2500]);
  const m = orderMath(order);
  assert.equal(m.balance, 0);
  assert.equal(m.receivable, 0);
  assert.equal(m.collectOnDelivery, 0);
  assert.equal(m.credit, 2500);
});

test("roll-up totals cash to collect across both kinds of debt", () => {
  const orders = [
    make("DELIVERED", [[1, 2500]]),
    make("PENDING", [[2, 2500]], [2500]),
    make("PENDING", [[1, 1500]]),
    make("CANCELLED", [[9, 9900]]),
  ] as unknown as FullOrder[];

  const t = rollUp(orders);
  assert.equal(t.receivable, 2500);
  assert.equal(t.collectOnDelivery, 2500 + 1500);
  assert.equal(t.outstanding, 6500);
  assert.equal(t.prepaid, 2500);
  assert.equal(t.collected, 2500);
  assert.equal(t.ordersOpen, 2);
  assert.equal(t.jarsOwed, 3);
  assert.equal(t.orderedValue, 2500 + 5000 + 1500);
});
