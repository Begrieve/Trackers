import { test } from "node:test";
import assert from "node:assert/strict";
import { stockByProduct } from "./stock";

test("counts jars made against jars delivered and promised", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 20 }],
    [
      { productId: "p1", name: "Napa", quantity: 5, status: "DELIVERED" },
      { productId: "p1", name: "Napa", quantity: 4, status: "PENDING" },
    ],
  );
  assert.equal(row.made, 20);
  assert.equal(row.delivered, 5);
  assert.equal(row.committed, 4);
  assert.equal(row.spare, 11);
  assert.equal(row.short, 0);
});

test("reports a shortfall when more is promised than made", () => {
  const [row] = stockByProduct(
    [{ productId: "p1", name: "Napa", quantity: 6 }],
    [{ productId: "p1", name: "Napa", quantity: 10, status: "PENDING" }],
  );
  assert.equal(row.short, 4);
  assert.equal(row.spare, 0);
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
