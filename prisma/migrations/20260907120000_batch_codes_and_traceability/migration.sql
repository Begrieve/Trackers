-- Every batch gets a short human-readable code (B-YYMMDD-N) so a jar can be
-- traced back to the cook it came from when someone complains.
ALTER TABLE "Batch" ADD COLUMN "code" TEXT;

-- Backfill existing batches, numbering within each day by creation order.
WITH numbered AS (
  SELECT
    id,
    'B-' || to_char("madeOn", 'YYMMDD') || '-' ||
      ROW_NUMBER() OVER (PARTITION BY date_trunc('day', "madeOn") ORDER BY "createdAt", id) AS code
  FROM "Batch"
)
UPDATE "Batch" b SET "code" = n.code FROM numbered n WHERE b.id = n.id;

ALTER TABLE "Batch" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- Which batch an order line was filled from. Nullable: older lines predate
-- batch tracking, and a line can legitimately be unassigned.
ALTER TABLE "OrderItem" ADD COLUMN "batchId" TEXT;
CREATE INDEX "OrderItem_batchId_idx" ON "OrderItem"("batchId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
