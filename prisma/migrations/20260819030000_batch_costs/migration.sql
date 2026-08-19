-- What a batch cost to make, itemised (cabbage, chilli, jars, …).
-- Amounts are integer cents, matching every other money column.
CREATE TABLE "BatchCost" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "BatchCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BatchCost_batchId_idx" ON "BatchCost"("batchId");

ALTER TABLE "BatchCost" ADD CONSTRAINT "BatchCost_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
