import { test } from "node:test";
import assert from "node:assert/strict";
import { batchStockFor, shelfByProduct, type BatchLike } from "./shelf";

const batch = (
  id: string,
  code: string,
  day: number,
  items: [string, string, number][],
  orderItems: [string, number][] = [],
  allocations: [string, number][] = [],
): BatchLike => ({
  id,
  code,
  madeOn: new Date(2026, 9, day),
  items: items.map(([productId, name, quantity]) => ({ productId, name, quantity })),
  orderItems: orderItems.map(([productId, quantity]) => ({ productId, quantity })),
  allocations: allocations.map(([productId, quantity]) => ({ productId, quantity })),
});

test("what is left in a batch is what it made, less orders and jars set aside", () => {
  const [stock] = batchStockFor([batch("b1", "B-1", 1, [["napa", "Napa", 20]], [["napa", 5]], [["napa", 3]])], "napa");
  assert.equal(stock.remaining, 12);
});

test("a batch with nothing left of a product drops out", () => {
  const stock = batchStockFor([batch("b1", "B-1", 1, [["napa", "Napa", 4]], [["napa", 4]])], "napa");
  assert.equal(stock.length, 0);
});

test("the oldest batch still holding a jar sets the shelf age", () => {
  const [entry] = shelfByProduct([
    batch("new", "B-2", 20, [["napa", "Napa", 5]]),
    batch("old", "B-1", 1, [["napa", "Napa", 5]]),
  ]);
  assert.equal(entry.oldest?.code, "B-1");
  assert.equal(entry.remaining, 10);
});

test("an emptied old batch stops counting against the shelf age", () => {
  // The old batch is gone, so the shelf is only as old as what is left.
  const [entry] = shelfByProduct([
    batch("old", "B-1", 1, [["napa", "Napa", 5]], [["napa", 5]]),
    batch("new", "B-2", 20, [["napa", "Napa", 5]]),
  ]);
  assert.equal(entry.oldest?.code, "B-2");
  assert.equal(entry.remaining, 5);
});

test("a product entirely sold out reports no age rather than a stale one", () => {
  const [entry] = shelfByProduct([batch("b1", "B-1", 1, [["napa", "Napa", 3]], [["napa", 3]])]);
  assert.equal(entry.remaining, 0);
  assert.equal(entry.oldest, null);
});

test("products are listed oldest stock first, because that is what to move", () => {
  const rows = shelfByProduct([
    batch("b1", "B-1", 20, [["radish", "Radish", 4]]),
    batch("b2", "B-2", 1, [["napa", "Napa", 4]]),
  ]);
  assert.equal(rows[0].name, "Napa");
});

test("one batch holding two products tracks them apart", () => {
  const rows = shelfByProduct([
    batch("b1", "B-1", 5, [["napa", "Napa", 10], ["radish", "Radish", 6]], [["napa", 10]]),
  ]);
  const napa = rows.find((r) => r.productId === "napa")!;
  const radish = rows.find((r) => r.productId === "radish")!;
  assert.equal(napa.remaining, 0);
  assert.equal(radish.remaining, 6);
});
