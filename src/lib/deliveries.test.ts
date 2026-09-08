import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRun } from "./deliveries";
import type { FullOrder } from "./ledger";

function order(o: {
  id: string;
  name: string;
  phone?: string;
  orderedAt: Date;
  status?: "PENDING" | "DELIVERED" | "CANCELLED";
  items: [string, number, number, string | null, string | null][]; // name, qty, price, batchId, code
  paid?: number;
}) {
  return {
    id: o.id,
    customerId: `c-${o.id}`,
    customer: { id: `c-${o.id}`, name: o.name, phone: o.phone ?? null },
    status: o.status ?? "PENDING",
    orderedAt: o.orderedAt,
    items: o.items.map(([name, quantity, unitPrice, batchId, code], i) => ({
      id: `${o.id}-${i}`,
      productId: name,
      name,
      quantity,
      unitPrice,
      batchId,
      batch: code ? { code } : null,
    })),
    payments: o.paid ? [{ amount: o.paid }] : [],
  } as unknown as FullOrder;
}

test("an order with its batch attached is ready to go out", () => {
  const run = buildRun([
    order({
      id: "a",
      name: "Dion",
      orderedAt: new Date(2026, 8, 1),
      items: [["Napa", 1, 1500, "b1", "B-260801-1"]],
    }),
  ]);
  assert.equal(run.ready.length, 1);
  assert.equal(run.waiting.length, 0);
  assert.equal(run.ready[0].batchCodes[0], "B-260801-1");
});

test("an order still waiting on a cook is listed separately, not as a stop", () => {
  const run = buildRun([
    order({ id: "b", name: "Fabian", orderedAt: new Date(2026, 8, 2), items: [["Napa", 4, 1500, null, null]] }),
  ]);
  assert.equal(run.ready.length, 0);
  assert.equal(run.waiting.length, 1);
  assert.equal(run.stops, 0);
});

test("the run collects the cash due at the door", () => {
  const run = buildRun([
    order({
      id: "a",
      name: "Dion",
      orderedAt: new Date(2026, 8, 1),
      items: [["Napa", 2, 1500, "b1", "B-1"]],
    }),
  ]);
  assert.equal(run.collect, 3000);
  assert.equal(run.ready[0].prepaid, false);
});

test("a prepaid order asks for nothing at the door", () => {
  const run = buildRun([
    order({
      id: "a",
      name: "Grace",
      orderedAt: new Date(2026, 8, 1),
      items: [["Napa", 2, 1500, "b1", "B-1"]],
      paid: 3000,
    }),
  ]);
  assert.equal(run.collect, 0);
  assert.equal(run.ready[0].prepaid, true);
});

test("a part-paid order asks only for the remainder", () => {
  const run = buildRun([
    order({
      id: "a",
      name: "Grace",
      orderedAt: new Date(2026, 8, 1),
      items: [["Napa", 2, 1500, "b1", "B-1"]],
      paid: 1000,
    }),
  ]);
  assert.equal(run.collect, 2000);
});

test("delivered and cancelled orders are not on the run", () => {
  const run = buildRun([
    order({
      id: "a",
      name: "Done",
      orderedAt: new Date(2026, 8, 1),
      status: "DELIVERED",
      items: [["Napa", 1, 1500, "b1", "B-1"]],
    }),
    order({
      id: "b",
      name: "Gone",
      orderedAt: new Date(2026, 8, 1),
      status: "CANCELLED",
      items: [["Napa", 1, 1500, null, null]],
    }),
  ]);
  assert.equal(run.ready.length, 0);
  assert.equal(run.waiting.length, 0);
});

test("whoever has waited longest is first on the run", () => {
  const run = buildRun([
    order({ id: "new", name: "Newer", orderedAt: new Date(2026, 8, 5), items: [["Napa", 1, 1500, "b1", "B-1"]] }),
    order({ id: "old", name: "Older", orderedAt: new Date(2026, 7, 1), items: [["Napa", 1, 1500, "b1", "B-1"]] }),
  ]);
  assert.equal(run.ready[0].customerName, "Older");
});

test("the make-list totals what open orders need with no batch behind it", () => {
  const run = buildRun([
    order({ id: "a", name: "Fabian", orderedAt: new Date(2026, 8, 2), items: [["Napa", 4, 1500, null, null]] }),
    order({ id: "b", name: "Mina", orderedAt: new Date(2026, 8, 3), items: [["Napa", 3, 1500, null, null], ["Radish", 2, 1600, null, null]] }),
  ]);
  assert.equal(run.toMakeJars, 9);
  assert.equal(run.toMake[0].name, "Napa");
  assert.equal(run.toMake[0].quantity, 7);
});

test("jars already made and spare are not asked for again", () => {
  // 4 napa are sitting unclaimed, so a 6-jar order only needs 2 more made.
  const run = buildRun(
    [order({ id: "a", name: "Fabian", orderedAt: new Date(2026, 8, 2), items: [["Napa", 6, 1500, null, null]] })],
    new Map([["Napa", 4]]),
  );
  assert.equal(run.toMakeJars, 2);
});

test("spare stock is not counted twice across two orders", () => {
  const run = buildRun(
    [
      order({ id: "a", name: "First", orderedAt: new Date(2026, 8, 1), items: [["Napa", 3, 1500, null, null]] }),
      order({ id: "b", name: "Second", orderedAt: new Date(2026, 8, 2), items: [["Napa", 3, 1500, null, null]] }),
    ],
    new Map([["Napa", 4]]),
  );
  // 4 spare covers the first order and one jar of the second; 2 still to make.
  assert.equal(run.toMakeJars, 2);
});

test("an attached line never appears on the make-list", () => {
  const run = buildRun([
    order({ id: "a", name: "Dion", orderedAt: new Date(2026, 8, 1), items: [["Napa", 5, 1500, "b1", "B-1"]] }),
  ]);
  assert.equal(run.toMakeJars, 0);
});
