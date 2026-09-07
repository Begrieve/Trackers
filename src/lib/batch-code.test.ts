import { test } from "node:test";
import assert from "node:assert/strict";
import { batchCodePrefix, nextBatchCode } from "./batch-code";

test("the prefix carries the date the batch was made", () => {
  assert.equal(batchCodePrefix(new Date(2026, 8, 7)), "B-260907");
});

test("months and days are zero-padded", () => {
  assert.equal(batchCodePrefix(new Date(2026, 0, 5)), "B-260105");
});

test("the first batch of a day is number 1", () => {
  assert.equal(nextBatchCode(new Date(2026, 8, 7), []), "B-260907-1");
});

test("a second batch the same day increments", () => {
  assert.equal(nextBatchCode(new Date(2026, 8, 7), ["B-260907-1"]), "B-260907-2");
});

test("codes from other days do not affect the count", () => {
  const code = nextBatchCode(new Date(2026, 8, 7), ["B-260906-1", "B-260906-2"]);
  assert.equal(code, "B-260907-1");
});

test("a deleted batch never has its code reused", () => {
  // B-260907-2 was deleted; the next batch must still be 3.
  assert.equal(nextBatchCode(new Date(2026, 8, 7), ["B-260907-1", "B-260907-3"]), "B-260907-4");
});

test("double-digit batches in one day keep counting", () => {
  const existing = Array.from({ length: 11 }, (_, i) => `B-260907-${i + 1}`);
  assert.equal(nextBatchCode(new Date(2026, 8, 7), existing), "B-260907-12");
});

test("malformed codes are ignored rather than throwing", () => {
  assert.equal(nextBatchCode(new Date(2026, 8, 7), ["B-260907-oops", "B-260907-2"]), "B-260907-3");
});
