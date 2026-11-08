import { test } from "node:test";
import assert from "node:assert/strict";
import { splitOldestFirst, totalRemaining } from "./allocate-fifo";

const batch = (code: string, day: number, remaining: number) => ({
  batchId: `id-${code}`,
  code,
  madeOn: new Date(2026, 9, day),
  remaining,
});

test("one jar comes out of the oldest batch", () => {
  const { splits, short } = splitOldestFirst([batch("B-2", 20, 5), batch("B-1", 1, 5)], 1);
  assert.equal(short, 0);
  assert.deepEqual(splits, [{ batchId: "id-B-1", code: "B-1", quantity: 1 }]);
});

test("a request spills into the next batch once the oldest runs out", () => {
  const { splits, short } = splitOldestFirst([batch("B-1", 1, 3), batch("B-2", 20, 10)], 8);
  assert.equal(short, 0);
  assert.deepEqual(splits, [
    { batchId: "id-B-1", code: "B-1", quantity: 3 },
    { batchId: "id-B-2", code: "B-2", quantity: 5 },
  ]);
});

test("empty batches are skipped rather than producing zero-jar rows", () => {
  const { splits } = splitOldestFirst([batch("B-1", 1, 0), batch("B-2", 20, 4)], 2);
  assert.equal(splits.length, 1);
  assert.equal(splits[0].code, "B-2");
});

test("asking for more than exists reports the shortfall instead of inventing jars", () => {
  const { splits, short } = splitOldestFirst([batch("B-1", 1, 2)], 5);
  assert.equal(short, 3);
  assert.equal(splits[0].quantity, 2, "it still takes what is there");
});

test("asking for nothing takes nothing", () => {
  assert.deepEqual(splitOldestFirst([batch("B-1", 1, 5)], 0), { splits: [], short: 0 });
});

test("with no batches at all, everything is short", () => {
  assert.deepEqual(splitOldestFirst([], 3), { splits: [], short: 3 });
});

test("batches made the same day fall back to the code, so the order is stable", () => {
  const same = [
    { batchId: "b", code: "B-261001-2", madeOn: new Date(2026, 9, 1), remaining: 2 },
    { batchId: "a", code: "B-261001-1", madeOn: new Date(2026, 9, 1), remaining: 2 },
  ];
  assert.equal(splitOldestFirst(same, 1).splits[0].code, "B-261001-1");
});

test("the total ignores negative remainders", () => {
  assert.equal(totalRemaining([batch("B-1", 1, 4), batch("B-2", 2, -3)]), 4);
});
