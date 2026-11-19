"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import { parseMoney } from "@/lib/money";
import { parseJarWeight } from "@/lib/weight";
import type { ActionState } from "./customers";

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  unitLabel: z.string().trim().min(1).max(24),
  price: z.string().trim().min(1, "Price is required"),
  variety: z.string().trim().min(1, "Which kimchi is this?").max(120),
  jarWeightOz: z.string().trim().min(1, "How much does the jar hold?"),
});

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Jar sizes are grouped by kimchi type, because a batch is a weight of a type.
 * Typing a new name creates it rather than refusing, so adding a jar never
 * means a detour to set a type up first.
 */
async function varietyByName(db: Db, name: string) {
  const existing = await db.variety.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  return existing ?? db.variety.create({ data: { name } });
}

function readJarWeight(raw: string): number | null {
  try {
    return parseJarWeight(raw);
  } catch {
    return null;
  }
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await getDb();
  await requireUser();
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    unitLabel: String(formData.get("unitLabel") || "jar"),
    price: String(formData.get("price") ?? ""),
    variety: String(formData.get("variety") ?? ""),
    jarWeightOz: String(formData.get("jarWeightOz") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let unitPrice: number;
  try {
    unitPrice = parseMoney(parsed.data.price);
  } catch {
    return { error: "Enter a price like 25.00" };
  }
  if (unitPrice < 0) return { error: "Price can't be negative" };

  const jarWeightOz = readJarWeight(parsed.data.jarWeightOz);
  if (jarWeightOz === null) return { error: "Enter how many ounces the jar holds, like 16 or 11." };

  const variety = await varietyByName(db, parsed.data.variety);

  await db.product.create({
    data: {
      name: parsed.data.name,
      unitLabel: parsed.data.unitLabel,
      unitPrice,
      varietyId: variety.id,
      jarWeightOz,
    },
  });

  revalidatePath("/products");
  revalidatePath("/orders/new");
  revalidatePath("/batches");
  return { ok: true };
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await getDb();
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    unitLabel: String(formData.get("unitLabel") || "jar"),
    price: String(formData.get("price") ?? ""),
    variety: String(formData.get("variety") ?? ""),
    jarWeightOz: String(formData.get("jarWeightOz") ?? ""),
  });
  if (!id) return { error: "Missing product" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let unitPrice: number;
  try {
    unitPrice = parseMoney(parsed.data.price);
  } catch {
    return { error: "Enter a price like 25.00" };
  }

  const jarWeightOz = readJarWeight(parsed.data.jarWeightOz);
  if (jarWeightOz === null) return { error: "Enter how many ounces the jar holds, like 16 or 11." };

  const variety = await varietyByName(db, parsed.data.variety);

  // Orders already placed snapshot their own weight and type, so changing a
  // jar here never restates what has already gone out.
  await db.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      unitLabel: parsed.data.unitLabel,
      unitPrice,
      varietyId: variety.id,
      jarWeightOz,
      active: formData.get("active") === "on",
    },
  });

  revalidatePath("/products");
  revalidatePath("/orders/new");
  revalidatePath("/batches");
  return { ok: true };
}

export async function toggleProduct(formData: FormData): Promise<void> {
  const db = await getDb();
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return;
  await db.product.update({ where: { id }, data: { active: !product.active } });
  revalidatePath("/products");
  revalidatePath("/orders/new");
}
