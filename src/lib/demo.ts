/**
 * The demo lives in its own set of tables, so a friend poking at it cannot
 * touch the real ledger.
 *
 * By default that's a separate Postgres *schema* on the same database:
 * `?schema=demo` gives Prisma a wholly separate set of tables, including its
 * own migration history, with nothing to provision and no second database to
 * pay for. Setting DEMO_DATABASE_URL points the demo at a different database
 * entirely instead — the app can't tell the difference.
 */

export const DEMO_SCHEMA = "demo";

/** Fixed so the same row can exist in both the real and the demo tables. */
export const DEMO_USER_ID = "demo-account-fixed-id";

type Env = Record<string, string | undefined>;

export function demoDatabaseUrl(mainUrl: string, env: Env = process.env): string {
  const explicit = env.DEMO_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const url = new URL(mainUrl);
  url.searchParams.set("schema", DEMO_SCHEMA);
  return url.toString();
}

/**
 * Guards against the demo being pointed at the real tables by a mistake in
 * configuration — an empty DEMO_DATABASE_URL, or one copied from the main URL.
 */
export function isSeparateFromMain(mainUrl: string, demoUrl: string): boolean {
  if (mainUrl === demoUrl) return false;

  try {
    const a = new URL(mainUrl);
    const b = new URL(demoUrl);
    const sameServer = a.host === b.host && a.pathname === b.pathname;
    if (!sameServer) return true;
    // Same database: only a different schema keeps the tables apart.
    return (a.searchParams.get("schema") ?? "public") !== (b.searchParams.get("schema") ?? "public");
  } catch {
    return false;
  }
}

export function isDemoEnabled(env: Env = process.env): boolean {
  return Boolean(env.SEED_DEMO_EMAIL?.trim() && env.SEED_DEMO_PASSWORD?.trim());
}
