-- Narrow the payment methods to Cash, Bank Transfer, Cheque, Other.
-- Existing rows are remapped rather than dropped: cheques keep their identity,
-- and the various app-based methods collapse into OTHER.
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;

ALTER TABLE "Payment"
  ALTER COLUMN "method" TYPE "PaymentMethod_new"
  USING (
    CASE "method"::text
      WHEN 'CASH' THEN 'CASH'
      WHEN 'CHECK' THEN 'CHEQUE'
      WHEN 'ZELLE' THEN 'BANK_TRANSFER'
      ELSE 'OTHER'
    END
  )::"PaymentMethod_new";

ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'CASH';

DROP TYPE "PaymentMethod";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";

-- Production batches: what was actually made, and when.
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "madeOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Batch_madeOn_idx" ON "Batch"("madeOn");
CREATE INDEX "BatchItem_batchId_idx" ON "BatchItem"("batchId");

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BatchItem" ADD CONSTRAINT "BatchItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
