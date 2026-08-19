/**
 * Vercel's Postgres integrations don't agree on a variable name: a Neon
 * integration sets DATABASE_URL and DATABASE_URL_UNPOOLED, Vercel Postgres sets
 * POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING, and a hand-added key can be
 * left empty. Resolve whichever one is actually present.
 */

const RUNTIME_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

// Migrations want a direct connection; pooled endpoints can drop long DDL.
const MIGRATION_KEYS = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  ...RUNTIME_KEYS,
] as const;

type Env = Record<string, string | undefined>;

function firstNonEmpty(keys: readonly string[], env: Env) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

export function resolveDatabaseUrl(env: Env = process.env): string {
  const found = firstNonEmpty(RUNTIME_KEYS, env);
  if (found) return found.value;

  throw new Error(
    "No database connection string found. Set DATABASE_URL to your Postgres URL " +
      `(looked for: ${RUNTIME_KEYS.join(", ")}).`,
  );
}

export function resolveMigrationUrl(env: Env = process.env) {
  return firstNonEmpty(MIGRATION_KEYS, env);
}

export function resolveRuntimeUrl(env: Env = process.env) {
  return firstNonEmpty(RUNTIME_KEYS, env);
}
