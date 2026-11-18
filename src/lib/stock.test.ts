import { test } from "node:test";
import assert from "node:assert/strict";
import { stockByVariety } from "./stock";

const made = (weightOz: number) => [{ varietyId: "napa", name: "Napa", weightOz }];
const jars = (
  quantity: number,
  status: string,
  jarWeightOz = 16,
  batchId: string | null = null,
) => ({ varietyId: "napa", name: "Napa", quantity, jarWeightOz, status, batchId });

test("a batch is held as the weight it was made as", () => {
  const [row] = stockByVariety(made(608), []);
  assert.equal(row.made, 608, "38 lb");
  assert.equal(row.onHand, 608);
  assert.equal(row.spare, 608);
});

test("delivered jars draw down the weight they carried away", () => {
  // 5 small jars is 5 lb; 2 big jars is another 4 lb.
  const [row] = stockByVariety(made(608), [
    jars(5, "DELIVERED", 16, "b1"),
    jars(2, "DELIVERED", 32, "b1"),
  ]);
  assert.equal(row.drawnDown, 80 + 64);
  assert.equal(row.onHand, 608 - 144);
});

test("both jar sizes of one kimchi come out of the same cook", () => {
  // The whole point of weighing batches: a 32 oz order eats twice the 16 oz one.
  const [row] = stockByVariety(made(160), [jars(1, "PENDING", 32), jars(1, "PENDING", 16)]);
  assert.equal(row.committed, 48);
  assert.equal(row.spare, 112);
});

test("a promise beyond what is on hand is a shortfall, in weight", () => {
  const [row] = stockByVariety(made(32), [jars(4, "PENDING", 16)]);
  assert.equal(row.committed, 64);
  assert.equal(row.short, 32, "two more pounds to make");
  assert.equal(row.spare, 0);
});

test("jars set aside take their weight with them", () => {
  const [row] = stockByVariety(made(160), [], [
    { varietyId: "napa", name: "Napa", quantity: 2, jarWeightOz: 16 },
  ]);
  assert.equal(row.allocated, 32);
  assert.equal(row.onHand, 128);
});

test("a delivery with no batch behind it draws nothing down", () => {
  // Kimchi from before any of this was recorded: reported, not subtracted.
  const [row] = stockByVariety(made(160), [jars(3, "DELIVERED", 16, null)]);
  assert.equal(row.untracked, 48);
  assert.equal(row.drawnDown, 0);
  assert.equal(row.onHand, 160, "the recorded batch is intact");
});

test("a delivered jar can never create a shortfall", () => {
  const [row] = stockByVariety([], [jars(11, "DELIVERED", 16, null)]);
  assert.equal(row.short, 0);
  assert.equal(row.untracked, 176);
});

test("cancelled orders claim no weight", () => {
  const [row] = stockByVariety(made(160), [jars(4, "CANCELLED", 32)]);
  assert.equal(row.committed, 0);
  assert.equal(row.spare, 160);
});

test("two cooks of the same kimchi add up", () => {
  const [row] = stockByVariety(
    [
      { varietyId: "napa", name: "Napa", weightOz: 320 },
      { varietyId: "napa", name: "Napa", weightOz: 288 },
    ],
    [],
  );
  assert.equal(row.made, 608);
});

test("shortfalls sort to the top", () => {
  const rows = stockByVariety(
    [
      { varietyId: "a", name: "Aaa", weightOz: 160 },
      { varietyId: "b", name: "Bbb", weightOz: 16 },
    ],
    [{ varietyId: "b", name: "Bbb", quantity: 5, jarWeightOz: 16, status: "PENDING" }],
  );
  assert.equal(rows[0].varietyId, "b");
});
