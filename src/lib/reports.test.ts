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
  productIds?: Record<string, string>;
  payments?: [number, string, Date][];
}) {
  return {
    id: overrides.id,
    customerId: overrides.customerId,
    customer: { id: overrides.customerId, name: overrides.customerName },
    status: overrides.status ?? "DELIVERED",
    orderedAt: overrides.orderedAt,
    items: overrides.items.map(([name, quantity, unitPrice]) => ({
      name,
      productId: overrides.productIds?.[name] ?? name,
      quantity,
      unitPrice,
    })),
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
    { madeOn: new Date(2026, 6, 4), items: [{ productId: "p1", quantity: 12 }], costs: [] },
    { madeOn: new Date(2026, 3, 4), items: [{ productId: "p1", quantity: 99 }], costs: [] },
  ];
  const report = buildReport([], batches, rangeForPreset("this-month", NOW));
  assert.equal(report.batchCount, 1);
  assert.equal(report.jarsMade, 12);
});

test("profit subtracts the cost of the jars sold from what was billed", () => {
  const orders = [
    order({
      id: "a",
      customerId: "c1",
      customerName: "Grace",
      orderedAt: new Date(2026, 6, 5),
      items: [["Napa", 4, 2500]], // billed $100
    }),
  ];
  // 20 jars cooked for $40 => $2.00 a jar, so 4 jars cost $8.
  const batches = [
    { madeOn: new Date(2026, 5, 1), items: [{ productId: "Napa", quantity: 20 }], costs: [{ amount: 4000 }] },
  ];

  const report = buildReport(orders, batches, rangeForPreset("this-month", NOW));
  assert.equal(report.billed, 10000);
  assert.equal(report.cogs, 800);
  assert.equal(report.profit, 9200);
  assert.equal(report.marginPct, 92);
  assert.equal(report.uncostedJars, 0);
  assert.equal(report.products[0].cost, 800);
  assert.equal(report.products[0].profit, 9200);
});

test("costs from an earlier period still price jars sold now", () => {
  const orders = [
    order({
      id: "a",
      customerId: "c1",
      customerName: "Grace",
      orderedAt: new Date(2026, 6, 5),
      items: [["Napa", 1, 2500]],
    }),
  ];
  const batches = [
    // Cooked back in April, sold in July.
    { madeOn: new Date(2026, 3, 1), items: [{ productId: "Napa", quantity: 10 }], costs: [{ amount: 5000 }] },
  ];

  const report = buildReport(orders, batches, rangeForPreset("this-month", NOW));
  assert.equal(report.batchSpend, 0, "the spend happened in April");
  assert.equal(report.cogs, 500, "but the jar still cost $5 to make");
  assert.equal(report.profit, 2000);
});

test("jars with no recorded cost are counted so the margin is not trusted blindly", () => {
  const orders = [
    order({
      id: "a",
      customerId: "c1",
      customerName: "Grace",
      orderedAt: new Date(2026, 6, 5),
      items: [["Radish", 3, 1600]],
    }),
  ];

  const report = buildReport(orders, [], rangeForPreset("this-month", NOW));
  assert.equal(report.cogs, 0);
  assert.equal(report.uncostedJars, 3);
  assert.equal(report.profit, report.billed, "profit equals revenue only because cost is unknown");
});

test("batch spend counts every cost line of batches made in the period", () => {
  const batches = [
    {
      madeOn: new Date(2026, 6, 4),
      items: [{ productId: "Napa", quantity: 10 }],
      costs: [{ amount: 3000 }, { amount: 1500 }],
    },
  ];
  const report = buildReport([], batches, rangeForPreset("this-month", NOW));
  assert.equal(report.batchSpend, 4500);
});
