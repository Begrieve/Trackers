import type { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { demoDb, mainDb } from "./db";

/**
 * Which set of tables this request may touch, decided by who is signed in.
 *
 * Every page and action reads its database through here. The demo flag rides
 * on the signed session, so it can't be set by a query string or a form field
 * — a demo visitor gets the demo tables for the life of their session and has
 * no way to address the real ones.
 */

export async function isDemoSession(): Promise<boolean> {
  const session = await auth();
  return session?.user?.demo === true;
}

export async function getDb(): Promise<PrismaClient> {
  return (await isDemoSession()) ? demoDb() : mainDb();
}
