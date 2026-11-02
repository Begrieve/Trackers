"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { demoDatabaseUrl, isSeparateFromMain } from "@/lib/demo";
import { resolveDatabaseUrl } from "@/lib/db-url";
import { seedDemo } from "../../prisma/seed-demo";

/**
 * Puts the demo back to its starting state.
 *
 * Only a demo session may call it, and it is handed the demo connection
 * string directly rather than anything derived from the request, so there is
 * no argument a caller could pass that would point it at the real ledger.
 */
export async function resetDemo(): Promise<void> {
  const user = await requireUser();
  if (!user.demo) throw new Error("Only the demo account can reset the demo.");

  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("The demo is not configured on this deployment.");

  const main = resolveDatabaseUrl();
  const demo = demoDatabaseUrl(main);
  if (!isSeparateFromMain(main, demo)) {
    throw new Error("The demo database resolves to the real one. Refusing to reset.");
  }

  await seedDemo(demo, password, process.env.SEED_DEMO_NAME ?? "Demo");

  for (const path of ["/", "/orders", "/deliveries", "/customers", "/batches", "/reports", "/products"]) {
    revalidatePath(path);
  }
}
