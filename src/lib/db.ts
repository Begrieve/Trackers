import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./db-url";
import { demoDatabaseUrl, isSeparateFromMain } from "./demo";

/**
 * Two clients: the real ledger, and the demo's own tables.
 *
 * There is deliberately no default export. Picking a database is never
 * implicit — callers go through getDb() in ./scope, which resolves it from
 * who is signed in, so a demo session cannot reach the real tables by
 * forgetting to say which it meant.
 */

type Cache = { clients?: Map<string, PrismaClient> };
const globalForPrisma = globalThis as unknown as Cache;

function client(url: string): PrismaClient {
  const cache = (globalForPrisma.clients ??= new Map());
  let existing = cache.get(url);
  if (!existing) {
    existing = new PrismaClient({ datasourceUrl: url });
    cache.set(url, existing);
  }
  return existing;
}

/** The real ledger. Authentication always reads from here. */
export function mainDb(): PrismaClient {
  return client(resolveDatabaseUrl());
}

/** The demo's own tables. */
export function demoDb(): PrismaClient {
  const main = resolveDatabaseUrl();
  const demo = demoDatabaseUrl(main);

  // Refuse rather than quietly let a misconfigured demo write to the real
  // ledger — the one outcome this whole split exists to prevent.
  if (!isSeparateFromMain(main, demo)) {
    throw new Error(
      "The demo database resolves to the same tables as the real one. " +
        "Unset DEMO_DATABASE_URL to use the demo schema, or point it at a different database.",
    );
  }

  return client(demo);
}
