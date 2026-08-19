#!/usr/bin/env node
/**
 * Deploy-time build: resolve the database URL from whatever the host named it,
 * then migrate, create the accounts, and build the app. Fails loudly with a
 * readable message rather than a Prisma schema validation error.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Hosts inject real environment variables; a local checkout keeps them in .env,
// which node does not read on its own. Values already set always win.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Node < 20.12 has no loadEnvFile; the host-provided variables still apply.
    }
  }
}

const RUNTIME_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

const MIGRATION_KEYS = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", ...RUNTIME_KEYS];

const firstNonEmpty = (keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
};

const runtime = firstNonEmpty(RUNTIME_KEYS);

if (!runtime) {
  const present = RUNTIME_KEYS.filter((k) => k in process.env);
  console.error("\n✖ No database connection string found.\n");
  console.error("  Set DATABASE_URL to your Postgres connection string.");
  if (present.length > 0) {
    console.error(`  These names exist but are empty: ${present.join(", ")}`);
    console.error("  An empty value usually means the database was never attached.");
  } else {
    console.error(`  Looked for: ${RUNTIME_KEYS.join(", ")}`);
  }
  console.error("\n  On Vercel: Storage → Create Database → Postgres, then redeploy.\n");
  process.exit(1);
}

const migration = firstNonEmpty(MIGRATION_KEYS) ?? runtime;

if (runtime.key !== "DATABASE_URL") {
  console.log(`Using ${runtime.key} as the database connection string.`);
}

const run = (command, args, extraEnv) => {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: migration.value });
run("npx", ["tsx", "prisma/seed.ts"], { DATABASE_URL: migration.value });
run("npx", ["next", "build"], { DATABASE_URL: runtime.value });
