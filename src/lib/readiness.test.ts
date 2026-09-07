import { test } from "node:test";
import assert from "node:assert/strict";
import { readinessOf, readyCount } from "./readiness";

const line = (batchId: string | null, code?: string) => ({
  batchId,
  batch: code ? { code } : null,
});

test("a pending order with every line attached is ready, and names the batch", () => {
  const r = readinessOf({ status: "PENDING", items: [line("b1", "B-260907-1")] });
  assert.equal(r.ready, true);
  assert.equal(r.ready && r.label, "Ready · B-260907-1");
});

test("a pending order with no batch attached is not ready", () => {
  // Fabian: promised, but the cook has not happened yet.
  assert.equal(readinessOf({ status: "PENDING", items: [line(null)] }).ready, false);
});

test("a partly attached order is not ready", () => {
  const r = readinessOf({
    status: "PENDING",
    items: [line("b1", "B-260907-1"), line(null)],
  });
  assert.equal(r.ready, false, "some jars still do not exist");
});

test("a delivered order is not ready — it is already gone", () => {
  assert.equal(readinessOf({ status: "DELIVERED", items: [line("b1", "B-260907-1")] }).ready, false);
});

test("a cancelled order is never ready", () => {
  assert.equal(readinessOf({ status: "CANCELLED", items: [line("b1", "B-260907-1")] }).ready, false);
});

test("an order with no items is not ready", () => {
  assert.equal(readinessOf({ status: "PENDING", items: [] }).ready, false);
});

test("an order filled from two cooks says so rather than naming one", () => {
  const r = readinessOf({
    status: "PENDING",
    items: [line("b1", "B-260907-1"), line("b2", "B-260908-1")],
  });
  assert.equal(r.ready && r.label, "Ready · 2 batches");
});

test("two lines from the same batch name it once", () => {
  const r = readinessOf({
    status: "PENDING",
    items: [line("b1", "B-260907-1"), line("b1", "B-260907-1")],
  });
  assert.equal(r.ready && r.label, "Ready · B-260907-1");
});

test("counting ready orders skips the ones still waiting on a cook", () => {
  const count = readyCount([
    { status: "PENDING", items: [line("b1", "B-1")] }, // Dion, set aside
    { status: "PENDING", items: [line(null)] },        // Fabian, awaiting a new batch
    { status: "DELIVERED", items: [line("b1", "B-1")] },
  ]);
  assert.equal(count, 1);
});
