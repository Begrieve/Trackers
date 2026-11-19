-- A jar that leaves without being sold often went to somebody, and the day it
-- went is not always the day it was typed in. Both are optional: a jar kept
-- for the household or one that spoiled went to nobody.

ALTER TABLE "BatchAllocation" ADD COLUMN "customerId" TEXT;
ALTER TABLE "BatchAllocation" ADD COLUMN "wentOutOn" TIMESTAMP(3);

-- Entries recorded before this knew only when they were typed in, so that
-- stands as the day they went out until it is corrected by hand.
UPDATE "BatchAllocation" SET "wentOutOn" = "createdAt" WHERE "wentOutOn" IS NULL;

ALTER TABLE "BatchAllocation" ALTER COLUMN "wentOutOn" SET NOT NULL;
ALTER TABLE "BatchAllocation" ALTER COLUMN "wentOutOn" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "BatchAllocation_customerId_idx" ON "BatchAllocation"("customerId");

-- Losing a person from the ledger must not take the record of the gift with
-- them, so the link is cleared rather than the row deleted.
ALTER TABLE "BatchAllocation"
  ADD CONSTRAINT "BatchAllocation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
