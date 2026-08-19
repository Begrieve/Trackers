import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, parseRange, rangeForPreset, inRange } from "./reports";
import type { FullOrder } from "./ledger";

const NOW = new Date(2026, 6, 15, 12, 0, 0); // 15 July 2026

function order(overrides: {
  id: string;
  customerId: string;
  customerName: string;
  orderedAt: Date;
  status?: "PENDING" | "DELIVERED" | "CANCELLED";
  items: [string, number, number][];
  payments?: [number, string, Date][];
}) {
  return {
    id: overrides.id,
    customerId: overrides.customerId,
    customer: { id: overrides.customerId, name: overrides.customerName },
    status: overrides.status ?? "DELIVERED",
    orderedAt: overrides.orderedAt,
    items: overrides.items.map(([name, quantity, unitPrice]) => ({ name, quantity, unitPrice })),
    payments: (overrides.payments ?? []).map(([amount, method, paidAt]) => ({ amount, method, paidAt })),
  } as unknown as FullOrder;
}

test("this month covers the first of the month through today", () => {
  const range = rangeForPreset("this-month", NOW);
  assert.equal(range.from.getMonth(), 6);
  assert.equal(range.from.getDate(), 1);
  assert.ok(inRange(new Date(2026, 6, 2), range));
  assert.ok(!inRange(new Date(2026, 5, 30), range));
});

test("last month covers the whole previous month and nothing after", () => {
  const range = rangeForPreset("last-month", NOW);
  assert.ok(inRange(new Date(2026, 5, 1), range));
  assert.ok(inRange(new Date(2026, 5, 30), range));
  assert.ok(!inRange(new Date(2026, 6, 1), range));
});

test("explicit dates win over the preset and include both endpoints", () => {
  const range = parseRange("2026-03-01", "2026-03-31", "this-month", NOW);
  assert.ok(inRange(new Date(2026, 2, 1, 0, 30), range));
  assert.ok(inRange(new Date(2026, 2, 31, 23, 30), range));
  assert.ok(!inRange(new Date(2026, 3, 1), range));
});

test("a half-filled custom range falls back to the preset", () => {
  const range = parseRange("2026-03-01", undefined, "this-year", NOW);
  assert.equal(range.from.getMonth(), 0);
});

test("totals only count orders placed inside the range", () => {
  const orders = [
    order({
      id: "a",
      customerId: "c1",
      customerName: "Grace",
      orderedAt: new Date(2026, 6, 5),
      items: [["Napa 32oz", 2, 2500]],
    }),
    order({
      id: "b",
      customerId: "c2",
      customerName: "Dae",
      orderedAt: new Date(2026, 4, 5), // May — outside
      items: [["Napa 32oz", 10, 2500]],
    }),
  ];

  const report = buildReport(orders, [], rangeForPreset("this-month", NOW));
  assert.equal(report.orderCount, 1);
  assert.equal(report.jars, 2);
  assert.equal(report.billed, 5000);
  assert.equal(report.people.length, 1);
  assert.equal(report.people[0].name, "Grace");
});

test("cancelled orders are excluded from the totals", () => {
  const report = buildReport(
    [
      order({
        id: "a",
        customerId: "c1",
        customerName: "Grace",
        orderedAt: new Date(2026, 6, 5),
        status: "CANCELLED",
        items: [["Napa", 4, 2500]],
      }),
    ],
    [],
    rangeForPreset("this-month", NOW),
  );
  assert.equal(report.orderCount, 0);
  assert.equal(report.billed, 0);
});

test("collections count payments made in the range, even on older orders", () => {
  const orders = [
    order({
      id: "b",
      customerId: "c2",
      customerName: "Dae",
      orderedAt: new Date(2026, 4, 5), // order is outside the range
      items: [["Napa", 4, 2500]],
      payments: [[10000, "BANK_TRANSFER", new Date(2026, 6, 9)]], // payment is inside
    }),
  ];

  const report = buildReport(orders, [], rangeForPreset("this-month", NOW));
  assert.equal(report.orderCount, 0, "the order itself is out of range");
  assert.equal(report.collected, 10000, "but the money arrived this month");
  assert.equal(report.methods[0].label, "Bank Transfer");
});

test("product rows aggregate quantity and revenue across orders", () => {
  const orders = [
    order({
      id: "a",
      customerId: "c1",
      customerName: "Grace",
      orderedAt: new Date(2026, 6, 2),
      items: [["Napa", 2, 2500], ["Radish", 1, 1600]],
    }),
    order({
      id: "b",
      customerId: "c2",
      customerName: "Dae",
      orderedAt: new Date(2026, 6, 3),
      items: [["Napa", 3, 2500]],
    }),
  ];

  const report = buildReport(orders, [], rangeForPreset("this-month", NOW));
  assert.equal(report.products[0].name, "Napa");
  assert.equal(report.products[0].quantity, 5);
  assert.equal(report.products[0].revenue, 12500);
  assert.equal(report.jars, 6);
});

test("batches are counted only when made inside the range", () => {
  const batches = [
    { madeOn: new Date(2026, 6, 4), items: [{ quantity: 12 }] },
    { madeOn: new Date(2026, 3, 4), items: [{ quantity: 99 }] },
  ];
  const report = buildReport([], batches, rangeForPreset("this-month", NOW));
  assert.equal(report.batchCount, 1);
  assert.equal(report.jarsMade, 12);
});
