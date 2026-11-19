-- A sample or a gift is often promised before it is handed over. Dropping the
-- default and the NOT NULL lets an entry sit with no day yet: the jars are
-- spoken for and off the shelf, but they have not gone anywhere.
--
-- Every row that exists now was recorded as already gone and keeps its day, so
-- a null from here on means exactly one thing — still to hand over.

ALTER TABLE "BatchAllocation" ALTER COLUMN "wentOutOn" DROP DEFAULT;
ALTER TABLE "BatchAllocation" ALTER COLUMN "wentOutOn" DROP NOT NULL;
