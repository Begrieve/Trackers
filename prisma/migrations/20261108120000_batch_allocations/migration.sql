-- Jars that leave a batch without being sold: given away, kept back for the
-- household, shipped somewhere whole, or lost. Without these a batch can never
-- balance — those jars sit as "spare" for ever and overstate what is sellable.
CREATE TYPE "AllocationKind" AS ENUM ('DONATED', 'KEPT', 'SHIPPED', 'WASTED');

CREATE TABLE "BatchAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "kind" "AllocationKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BatchAllocation_batchId_idx" ON "BatchAllocation"("batchId");

ALTER TABLE "BatchAllocation" ADD CONSTRAINT "BatchAllocation_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BatchAllocation" ADD CONSTRAINT "BatchAllocation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
