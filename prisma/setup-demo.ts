import { spawnSync } from "node:child_process";
import { DEMO_SCHEMA, demoDatabaseUrl, isDemoEnabled, isSeparateFromMain } from "../src/lib/demo";
import { seedDemo } from "./seed-demo";

/**
 * Prepares the demo's own tables: same schema, same migrations, separate data.
 * Run from the build. Never opens the real ledger.
 */

async function main() {
  const main = process.env.DATABASE_URL?.trim();
  if (!main) throw new Error("DATABASE_URL is not set.");

  if (!isDemoEnabled()) {
    console.log("SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD not set — no demo account.");
    return;
  }

  const demoUrl = demoDatabaseUrl(main);
  if (!isSeparateFromMain(main, demoUrl)) {
    console.error("\n✖ The demo database resolves to the same tables as the real one.");
    console.error("  Unset DEMO_DATABASE_URL, or point it at a different database.\n");
    process.exit(1);
  }

  console.log(`\nSetting up the demo's own tables (schema "${DEMO_SCHEMA}" unless overridden).`);

  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: demoUrl },
    shell: process.platform === "win32",
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  const result = await seedDemo(
    demoUrl,
    process.env.SEED_DEMO_PASSWORD!,
    process.env.SEED_DEMO_NAME ?? "Demo",
  );
  console.log(`demo data ready: ${result.people} people, ${result.products} products`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
