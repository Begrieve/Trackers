import { test } from "node:test";
import assert from "node:assert/strict";
import { batchWeight, costOfGoodsSold, costOfJar, marginPercent, unitCosts } from "./costing";

const cook = (weightOz: number, amount: number, varietyId = "napa") => ({
  yields: [{ varietyId, weightOz }],
  costs: [{ amount }],
});

test("cost is carried per ounce, from what the cook made", () => {
  // $40 over 20 lb (320 oz) is 12.5 cents an ounce.
  const costs = unitCosts([cook(320, 4000)]);
  assert.equal(costs.get("napa")?.perOz, 12.5);
});

test("a big jar costs exactly twice a small one", () => {
  // The reason weight is the unit: an even split across jars could not say this.
  const unit = unitCosts([cook(320, 4000)]).get("napa");
  assert.equal(costOfJar(unit, 16), 200);
  assert.equal(costOfJar(unit, 32), 400);
});

test("itemised costs are summed before dividing", () => {
  const costs = unitCosts([{ yields: [{ varietyId: "napa", weightOz: 160 }], costs: [{ amount: 6000 }, { amount: 2000 }] }]);
  assert.equal(costOfJar(costs.get("napa"), 16), 800, "$80 over 10 lb is $8 a pound");
});

test("a cook of two kimchis splits its cost by weight", () => {
  const costs = unitCosts([
    {
      yields: [
        { varietyId: "napa", weightOz: 300 },
        { varietyId: "radish", weightOz: 100 },
      ],
      costs: [{ amount: 4000 }],
    },
  ]);
  assert.equal(costs.get("napa")?.totalCost, 3000);
  assert.equal(costs.get("radish")?.totalCost, 1000);
  assert.equal(costs.get("napa")?.perOz, 10);
});

test("averaging across cooks is by weight, not by how many cooks there were", () => {
  // 90 lb at $1/lb and 10 lb at $3/lb is $1.20 a pound, not $2.
  const costs = unitCosts([cook(1440, 9000), cook(160, 3000)]);
  assert.equal(costOfJar(costs.get("napa"), 16), 120);
});

test("a cook with no weight recorded prices nothing", () => {
  assert.equal(unitCosts([{ yields: [], costs: [{ amount: 4000 }] }]).size, 0);
});

test("a cook with no cost recorded contributes zero, not a crash", () => {
  const costs = unitCosts([{ yields: [{ varietyId: "napa", weightOz: 160 }], costs: [] }]);
  assert.equal(costOfJar(costs.get("napa"), 16), 0);
});

test("cost of goods sold weighs each jar size properly", () => {
  const costs = unitCosts([cook(320, 4000)]);
  const result = costOfGoodsSold(
    [
      { varietyId: "napa", quantity: 2, jarWeightOz: 16 },
      { varietyId: "napa", quantity: 1, jarWeightOz: 32 },
    ],
    costs,
  );
  assert.equal(result.cost, 400 + 400);
  assert.equal(result.costedJars, 3);
});

test("jars with no cost behind them are reported, not treated as free", () => {
  const costs = unitCosts([cook(160, 4000)]);
  const result = costOfGoodsSold(
    [
      { varietyId: "napa", quantity: 2, jarWeightOz: 16 },
      { varietyId: "cucumber", quantity: 7, jarWeightOz: 16 },
    ],
    costs,
  );
  assert.equal(result.uncostedJars, 7);
  assert.equal(result.costedJars, 2);
});

test("batch weight adds its yields up", () => {
  assert.equal(batchWeight({ yields: [{ weightOz: 320 }, { weightOz: 96 }] }), 416);
});

test("margin is a percentage of revenue", () => {
  assert.equal(marginPercent(10000, 4000), 40);
  assert.equal(marginPercent(0, 0), null);
  assert.equal(marginPercent(1000, -500), -50);
});
