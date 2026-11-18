-- Batches are recorded by weight of a kimchi type, not by a count of jars.
-- Jars are filled from that weight when orders are assigned, so a 16 oz and a
-- 32 oz jar of the same kimchi draw from the same cook.
--
-- Existing data is carried across, never dropped: each product is matched to a
-- variety by the part of its name before the size, its jar weight is read from
-- the size itself, and every recorded jar count becomes the weight it stood for.

CREATE TABLE "Variety" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Variety_name_key" ON "Variety"("name");

ALTER TABLE "Product" ADD COLUMN "varietyId" TEXT;
ALTER TABLE "Product" ADD COLUMN "jarWeightOz" INTEGER NOT NULL DEFAULT 16;

-- "Napa cabbage kimchi — 32 oz" -> variety "Napa cabbage kimchi", 32 oz a jar.
-- Both the em dash and a plain hyphen are accepted; a name with neither keeps
-- its whole name as the variety and the 16 oz default.
INSERT INTO "Variety" ("id", "name", "createdAt")
SELECT
  'var_' || md5(trim(split_part(replace("name", ' - ', ' — '), ' — ', 1))),
  trim(split_part(replace("name", ' - ', ' — '), ' — ', 1)),
  CURRENT_TIMESTAMP
FROM "Product"
GROUP BY trim(split_part(replace("name", ' - ', ' — '), ' — ', 1));

UPDATE "Product" p
SET "varietyId" = v."id"
FROM "Variety" v
WHERE v."name" = trim(split_part(replace(p."name", ' - ', ' — '), ' — ', 1));

UPDATE "Product"
SET "jarWeightOz" = GREATEST(
  COALESCE(NULLIF(substring("name" FROM '([0-9]+)\s*oz'), '')::int, 16),
  1
);

ALTER TABLE "Product" ADD CONSTRAINT "Product_varietyId_fkey"
  FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BatchYield" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightOz" INTEGER NOT NULL,
    CONSTRAINT "BatchYield_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BatchYield_batchId_idx" ON "BatchYield"("batchId");

-- Jar counts become the weight they represented, summed per kimchi type so a
-- batch that recorded two jar sizes of one kimchi becomes one weight.
INSERT INTO "BatchYield" ("id", "batchId", "varietyId", "name", "weightOz")
SELECT
  'byld_' || md5(bi."batchId" || ':' || p."varietyId"),
  bi."batchId",
  p."varietyId",
  v."name",
  SUM(bi."quantity" * p."jarWeightOz")
FROM "BatchItem" bi
JOIN "Product" p ON p."id" = bi."productId"
JOIN "Variety" v ON v."id" = p."varietyId"
WHERE p."varietyId" IS NOT NULL
GROUP BY bi."batchId", p."varietyId", v."name";

ALTER TABLE "BatchYield" ADD CONSTRAINT "BatchYield_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchYield" ADD CONSTRAINT "BatchYield_varietyId_fkey"
  FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "BatchItem";
