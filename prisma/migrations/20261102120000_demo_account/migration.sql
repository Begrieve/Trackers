-- A demo account signs in against this database but reads and writes its own
-- separate set of tables, so a visitor can try the app without touching the
-- real ledger.
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
