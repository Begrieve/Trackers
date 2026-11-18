-- An order line already snapshots the name and price it was sold at, so a
-- later price change cannot rewrite an old order. Jar weight and kimchi type
-- belong in that snapshot too: stock and cost are now weighed, and renaming or
-- resizing a product must not silently restate what already went out.
ALTER TABLE "OrderItem" ADD COLUMN "varietyId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "jarWeightOz" INTEGER NOT NULL DEFAULT 16;

ALTER TABLE "BatchAllocation" ADD COLUMN "varietyId" TEXT;
ALTER TABLE "BatchAllocation" ADD COLUMN "jarWeightOz" INTEGER NOT NULL DEFAULT 16;

UPDATE "OrderItem" oi
SET "varietyId" = p."varietyId", "jarWeightOz" = p."jarWeightOz"
FROM "Product" p WHERE p."id" = oi."productId";

UPDATE "BatchAllocation" a
SET "varietyId" = p."varietyId", "jarWeightOz" = p."jarWeightOz"
FROM "Product" p WHERE p."id" = a."productId";
