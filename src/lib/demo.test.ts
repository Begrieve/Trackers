import { test } from "node:test";
import assert from "node:assert/strict";
import { demoDatabaseUrl, isSeparateFromMain } from "./demo";

const MAIN = "postgresql://u:p@host.neon.tech/neondb?sslmode=require";

test("the demo gets its own schema on the same database by default", () => {
  const url = demoDatabaseUrl(MAIN, {});
  assert.match(url, /schema=demo/);
  assert.match(url, /sslmode=require/, "other connection options survive");
});

test("an existing schema is replaced, not appended", () => {
  const url = demoDatabaseUrl("postgresql://u:p@h/db?schema=public", {});
  assert.match(url, /schema=demo/);
  assert.ok(!url.includes("schema=public"));
});

test("DEMO_DATABASE_URL wins, so the demo can be a whole separate database", () => {
  const url = demoDatabaseUrl(MAIN, { DEMO_DATABASE_URL: "postgresql://u:p@other/demo" });
  assert.equal(url, "postgresql://u:p@other/demo");
});

test("a blank DEMO_DATABASE_URL falls back rather than being treated as set", () => {
  assert.match(demoDatabaseUrl(MAIN, { DEMO_DATABASE_URL: "   " }), /schema=demo/);
});

test("the derived demo url is recognised as separate from the real one", () => {
  assert.equal(isSeparateFromMain(MAIN, demoDatabaseUrl(MAIN, {})), true);
});

test("pointing the demo at the real tables is caught", () => {
  assert.equal(isSeparateFromMain(MAIN, MAIN), false, "identical url");
  assert.equal(
    isSeparateFromMain("postgresql://u:p@h/db", "postgresql://u:p@h/db?schema=public"),
    false,
    "default schema spelled out is still the real tables",
  );
});

test("a different database on the same server counts as separate", () => {
  assert.equal(isSeparateFromMain("postgresql://u:p@h/real", "postgresql://u:p@h/demo"), true);
});

test("an unparseable url is treated as unsafe rather than assumed fine", () => {
  assert.equal(isSeparateFromMain(MAIN, "not-a-url"), false);
});
