import { test } from "node:test";
import assert from "node:assert/strict";
import { costOfGoodsSold, marginPercent, unitCosts } from "./costing";

test("splits a batch cost evenly across the jars it made", () => {
  const costs = unitCosts([
    { items: [{ productId: "napa", quantity: 30 }], costs: [{ amount: 12000 }] },
  ]);
  assert.equal(costs.get("napa")?.perJar, 400); // $120 over 30 jars
});

test("sums itemised costs before dividing", () => {
  const costs = unitCosts([
    {
      items: [{ productId: "napa", quantity: 10 }],
      costs: [{ amount: 6000 }, { amount: 3000 }, { amount: 1000 }],
    },
  ]);
  assert.equal(costs.get("napa")?.perJar, 1000); // $100 over 10 jars
});

test("a mixed batch shares its cost across both products", () => {
  const costs = unitCosts([
    {
      items: [
        { productId: "napa", quantity: 6 },
        { productId: "radish", quantity: 4 },
      ],
      costs: [{ amount: 10000 }],
    },
  ]);
  assert.equal(costs.get("napa")?.totalCost, 6000);
  assert.equal(costs.get("radish")?.totalCost, 4000);
  assert.equal(costs.get("napa")?.perJar, 1000);
  assert.equal(costs.get("radish")?.perJar, 1000);
});

test("averages across batches by jars made, not by batch count", () => {
  const costs = unitCosts([
    { items: [{ productId: "napa", quantity: 90 }], costs: [{ amount: 9000 }] }, // $1.00/jar
    { items: [{ productId: "napa", quantity: 10 }], costs: [{ amount: 3000 }] }, // $3.00/jar
  ]);
  // 100 jars costing $120 in total => $1.20 each, not the $2.00 that averaging
  // the two batches' per-jar rates would give.
  assert.equal(costs.get("napa")?.perJar, 120);
});

test("a batch with no costs recorded contributes zero, not a crash", () => {
  const costs = unitCosts([{ items: [{ productId: "napa", quantity: 10 }], costs: [] }]);
  assert.equal(costs.get("napa")?.perJar, 0);
});

test("a batch that made nothing is ignored rather than dividing by zero", () => {
  const costs = unitCosts([{ items: [], costs: [{ amount: 5000 }] }]);
  assert.equal(costs.size, 0);
});

test("cost of goods sold multiplies jars sold by their unit cost", () => {
  const costs = unitCosts([
    { items: [{ productId: "napa", quantity: 30 }], costs: [{ amount: 12000 }] },
  ]);
  const result = costOfGoodsSold([{ productId: "napa", quantity: 5 }], costs);
  assert.equal(result.cost, 2000);
  assert.equal(result.costedJars, 5);
  assert.equal(result.uncostedJars, 0);
});

test("jars with no batch cost are reported rather than silently counted as free", () => {
  const costs = unitCosts([
    { items: [{ productId: "napa", quantity: 10 }], costs: [{ amount: 5000 }] },
  ]);
  const result = costOfGoodsSold(
    [
      { productId: "napa", quantity: 2 },
      { productId: "cucumber", quantity: 7 },
    ],
    costs,
  );
  assert.equal(result.cost, 1000);
  assert.equal(result.costedJars, 2);
  assert.equal(result.uncostedJars, 7, "the cucumber jars have no cost behind them");
});

test("margin is a percentage of revenue", () => {
  assert.equal(marginPercent(10000, 4000), 40);
  assert.equal(marginPercent(3000, 1000), 33.3);
});

test("margin is undefined rather than infinite when nothing was sold", () => {
  assert.equal(marginPercent(0, 0), null);
});

test("margin goes negative when a batch costs more than it earns", () => {
  assert.equal(marginPercent(1000, -500), -50);
});
