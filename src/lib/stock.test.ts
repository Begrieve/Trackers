import { test } from "node:test";
import assert from "node:assert/strict";
import { stockByProduct } from "./stock";

test("counts jars made against jars delivered from a known batch and promised", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 20 }],
    [
      { productId: "p1", name: "Napa", quantity: 5, status: "DELIVERED", batchId: "b1" },
      { productId: "p1", name: "Napa", quantity: 4, status: "PENDING" },
    ],
  );
  assert.equal(row.made, 20);
  assert.equal(row.delivered, 5);
  assert.equal(row.committed, 4);
  assert.equal(row.onHand, 15);
  assert.equal(row.spare, 11);
  assert.equal(row.short, 0);
});

test("reports a shortfall when more is promised than is on hand", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 6 }],
    [{ productId: "p1", name: "Napa", quantity: 10, status: "PENDING" }],
  );
  assert.equal(row.short, 4);
  assert.equal(row.spare, 0);
});

test("jars delivered from stock no batch records do not create a shortfall", () => {
  // The reported case: 11 jars handed over from cooks that predate batch
  // tracking. They are gone, so they cannot be something still to make.
  const [row] = stockByProduct(
    [],
    [{ productId: "p1", name: "Napa", quantity: 11, status: "DELIVERED" }],
  );
  assert.equal(row.short, 0, "already delivered, so nothing is owed");
  assert.equal(row.untracked, 11, "but the gap is reported, not hidden");
  assert.equal(row.onHand, 0);
});

test("an open order is short only by what it needs, not by past deliveries", () => {
  // 11 delivered from untracked stock, plus 4 promised to Fabian from a batch
  // not yet made: the shortfall is 4, not 15.
  const [row] = stockByProduct(
    [],
    [
      { productId: "p1", name: "Napa", quantity: 11, status: "DELIVERED" },
      { productId: "p1", name: "Napa", quantity: 4, status: "PENDING" },
    ],
  );
  assert.equal(row.short, 4);
  assert.equal(row.untracked, 11);
});

test("a new batch is not eaten into by deliveries that predate it", () => {
  // 3 jars went out from an untracked cook; a 12-jar batch is then recorded.
  // All 12 are still in the kitchen — the old 3 came from somewhere else.
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 12 }],
    [
      { productId: "p1", name: "Napa", quantity: 3, status: "DELIVERED" },
      { productId: "p1", name: "Napa", quantity: 4, status: "PENDING" },
    ],
  );
  assert.equal(row.onHand, 12, "the new batch is intact");
  assert.equal(row.untracked, 3);
  assert.equal(row.spare, 8, "12 on hand, 4 promised to Fabian");
  assert.equal(row.short, 0);
});

test("attributing a delivery to a batch draws that batch down", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 12 }],
    [{ productId: "p1", name: "Napa", quantity: 4, status: "DELIVERED", batchId: "b1" }],
  );
  assert.equal(row.drawnDown, 4);
  assert.equal(row.onHand, 8);
  assert.equal(row.untracked, 0);
});

test("cancelled orders do not consume stock", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 6 }],
    [{ productId: "p1", name: "Napa", quantity: 6, status: "CANCELLED" }],
  );
  assert.equal(row.spare, 6);
  assert.equal(row.committed, 0);
});

test("orders for a product never batched still show as short", () => {
  const [row] = stockByProduct([], [{ productId: "p9", name: "Radish", quantity: 3, status: "PENDING" }]);
  assert.equal(row.made, 0);
  assert.equal(row.short, 3);
});

test("shortfalls sort to the top", () => {
  const rows = stockByProduct(
    [
      { productId: "a", name: "Aaa", quantity: 10 },
      { productId: "b", name: "Bbb", quantity: 1 },
    ],
    [{ productId: "b", name: "Bbb", quantity: 5, status: "PENDING" }],
  );
  assert.equal(rows[0].productId, "b");
});

test("jars kept or given away leave the shelf", () => {
  // 20 made, 3 kept for the household: 17 are sellable, not 20.
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 20 }],
    [],
    [{ productId: "p1", name: "Napa", quantity: 3 }],
  );
  assert.equal(row.allocated, 3);
  assert.equal(row.onHand, 17);
  assert.equal(row.spare, 17);
});

test("giving jars away can leave an open order short", () => {
  // 10 made, 8 donated, 5 promised: 3 left on the shelf, so 2 must be made.
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 10 }],
    [{ productId: "p1", name: "Napa", quantity: 5, status: "PENDING" }],
    [{ productId: "p1", name: "Napa", quantity: 8 }],
  );
  assert.equal(row.onHand, 2);
  assert.equal(row.short, 3);
  assert.equal(row.spare, 0);
});

test("a whole batch kept back leaves nothing on hand and no shortfall", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 12 }],
    [],
    [{ productId: "p1", name: "Napa", quantity: 12 }],
  );
  assert.equal(row.onHand, 0);
  assert.equal(row.spare, 0);
  assert.equal(row.short, 0);
});

test("allocating more than was made cannot drive stock negative", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 4 }],
    [],
    [{ productId: "p1", name: "Napa", quantity: 9 }],
  );
  assert.equal(row.onHand, 0);
  assert.equal(row.short, 0, "nothing is owed, so nothing is short");
});

test("deliveries and allocations both draw the same batch down", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 20 }],
    [{ productId: "p1", name: "Napa", quantity: 6, status: "DELIVERED", batchId: "b1" }],
    [{ productId: "p1", name: "Napa", quantity: 4 }],
  );
  assert.equal(row.drawnDown, 6);
  assert.equal(row.allocated, 4);
  assert.equal(row.onHand, 10);
});
