import { test } from "node:test";
import assert from "node:assert/strict";
import { batchStockFor, shelfByVariety, type BatchLike } from "./shelf";

const batch = (
  id: string,
  code: string,
  day: number,
  yields: [string, string, number][],
  orderItems: [string, number, number][] = [],
  allocations: [string, number, number][] = [],
): BatchLike => ({
  id,
  code,
  madeOn: new Date(2026, 9, day),
  yields: yields.map(([varietyId, name, weightOz]) => ({ varietyId, name, weightOz })),
  orderItems: orderItems.map(([varietyId, quantity, jarWeightOz]) => ({
    varietyId,
    quantity,
    jarWeightOz,
  })),
  allocations: allocations.map(([varietyId, quantity, jarWeightOz]) => ({
    varietyId,
    quantity,
    jarWeightOz,
  })),
});

test("what is left is the weight made, less the weight that left in jars", () => {
  // 20 lb made; 5 small jars and 3 jars kept back is 8 lb gone.
  const [stock] = batchStockFor(
    [batch("b1", "B-1", 1, [["napa", "Napa", 320]], [["napa", 5, 16]], [["napa", 3, 16]])],
    "napa",
  );
  assert.equal(stock.remaining, 320 - 80 - 48);
});

test("a big jar takes twice the weight of a small one", () => {
  const [stock] = batchStockFor(
    [batch("b1", "B-1", 1, [["napa", "Napa", 160]], [["napa", 2, 32]])],
    "napa",
  );
  assert.equal(stock.remaining, 96);
});

test("an emptied batch drops out", () => {
  const stock = batchStockFor(
    [batch("b1", "B-1", 1, [["napa", "Napa", 64]], [["napa", 4, 16]])],
    "napa",
  );
  assert.equal(stock.length, 0);
});

test("the oldest batch still holding kimchi sets the shelf age", () => {
  const [entry] = shelfByVariety([
    batch("new", "B-2", 20, [["napa", "Napa", 80]]),
    batch("old", "B-1", 1, [["napa", "Napa", 80]]),
  ]);
  assert.equal(entry.oldest?.code, "B-1");
  assert.equal(entry.remaining, 160);
});

test("an emptied old batch stops setting the age", () => {
  const [entry] = shelfByVariety([
    batch("old", "B-1", 1, [["napa", "Napa", 80]], [["napa", 5, 16]]),
    batch("new", "B-2", 20, [["napa", "Napa", 80]]),
  ]);
  assert.equal(entry.oldest?.code, "B-2");
  assert.equal(entry.remaining, 80);
});

test("a kimchi entirely used up reports no age rather than a stale one", () => {
  const [entry] = shelfByVariety([batch("b1", "B-1", 1, [["napa", "Napa", 48]], [["napa", 3, 16]])]);
  assert.equal(entry.remaining, 0);
  assert.equal(entry.oldest, null);
});

test("kimchi types are listed oldest stock first", () => {
  const rows = shelfByVariety([
    batch("b1", "B-1", 20, [["radish", "Radish", 64]]),
    batch("b2", "B-2", 1, [["napa", "Napa", 64]]),
  ]);
  assert.equal(rows[0].name, "Napa");
});

test("one cook of two kimchis tracks them apart", () => {
  const rows = shelfByVariety([
    batch("b1", "B-1", 5, [["napa", "Napa", 160], ["radish", "Radish", 96]], [["napa", 10, 16]]),
  ]);
  assert.equal(rows.find((r) => r.varietyId === "napa")!.remaining, 0);
  assert.equal(rows.find((r) => r.varietyId === "radish")!.remaining, 96);
});
