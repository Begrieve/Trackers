import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseUrl, resolveMigrationUrl } from "./db-url";

test("uses DATABASE_URL when it is set", () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "postgres://a" }), "postgres://a");
});

test("treats an empty DATABASE_URL as unset and falls back", () => {
  const url = resolveDatabaseUrl({ DATABASE_URL: "", POSTGRES_PRISMA_URL: "postgres://b" });
  assert.equal(url, "postgres://b");
});

test("treats a whitespace-only value as unset", () => {
  const url = resolveDatabaseUrl({ DATABASE_URL: "   ", POSTGRES_URL: "postgres://c" });
  assert.equal(url, "postgres://c");
});

test("throws a readable error when nothing is set", () => {
  assert.throws(() => resolveDatabaseUrl({}), /No database connection string found/);
});

test("throws when every candidate is empty", () => {
  assert.throws(
    () => resolveDatabaseUrl({ DATABASE_URL: "", POSTGRES_URL: "" }),
    /No database connection string found/,
  );
});

test("migrations prefer a direct, non-pooled connection", () => {
  const found = resolveMigrationUrl({
    DATABASE_URL: "postgres://pooled",
    DATABASE_URL_UNPOOLED: "postgres://direct",
  });
  assert.equal(found?.value, "postgres://direct");
});

test("migrations fall back to the pooled URL when no direct one exists", () => {
  const found = resolveMigrationUrl({ DATABASE_URL: "postgres://pooled" });
  assert.equal(found?.value, "postgres://pooled");
});
