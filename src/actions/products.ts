"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/auth";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "./customers";

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  unitLabel: z.string().trim().min(1).max(24),
  price: z.string().trim().min(1, "Price is required"),
});

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    unitLabel: String(formData.get("unitLabel") || "jar"),
    price: String(formData.get("price") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let unitPrice: number;
  try {
    unitPrice = parseMoney(parsed.data.price);
  } catch {
    return { error: "Enter a price like 25.00" };
  }
  if (unitPrice < 0) return { error: "Price can't be negative" };

  await prisma.product.create({
    data: { name: parsed.data.name, unitLabel: parsed.data.unitLabel, unitPrice },
  });

  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true };
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    unitLabel: String(formData.get("unitLabel") || "jar"),
    price: String(formData.get("price") ?? ""),
  });
  if (!id) return { error: "Missing product" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let unitPrice: number;
  try {
    unitPrice = parseMoney(parsed.data.price);
  } catch {
    return { error: "Enter a price like 25.00" };
  }

  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      unitLabel: parsed.data.unitLabel,
      unitPrice,
      active: formData.get("active") === "on",
    },
  });

  revalidatePath("/products");
  revalidatePath("/orders/new");
  return { ok: true };
}

export async function toggleProduct(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return;
  await prisma.product.update({ where: { id }, data: { active: !product.active } });
  revalidatePath("/products");
  revalidatePath("/orders/new");
}
