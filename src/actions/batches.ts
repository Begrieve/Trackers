"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/auth";
import type { ActionState } from "./customers";

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readLineItems(formData: FormData) {
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map((q) => Number(String(q) || 0));

  return productIds
    .map((productId, index) => ({ productId, quantity: quantities[index] ?? 0 }))
    .filter((line) => line.productId && Number.isFinite(line.quantity) && line.quantity > 0);
}

function revalidateAll(batchId?: string) {
  revalidatePath("/");
  revalidatePath("/batches");
  revalidatePath("/reports");
  if (batchId) revalidatePath(`/batches/${batchId}`);
}

export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const madeOn = parseDate(formData.get("madeOn")) ?? new Date();
  const label =
    String(formData.get("label") ?? "").trim() ||
    `Batch of ${madeOn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const lines = readLineItems(formData);
  if (lines.length === 0) return { error: "Add at least one jar count." };

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (lines.some((l) => !byId.has(l.productId))) {
    return { error: "One of those products no longer exists." };
  }

  const batch = await prisma.batch.create({
    data: {
      label,
      madeOn,
      readyOn: parseDate(formData.get("readyOn")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdById: user.id,
      items: {
        create: lines.map((line) => {
          const product = byId.get(line.productId)!;
          return { productId: product.id, name: product.name, quantity: line.quantity };
        }),
      },
    },
  });

  revalidateAll(batch.id);
  redirect("/batches");
}

export async function updateBatch(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.batch.update({
    where: { id },
    data: {
      label: String(formData.get("label") ?? "").trim() || undefined,
      madeOn: parseDate(formData.get("madeOn")) ?? undefined,
      readyOn: parseDate(formData.get("readyOn")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidateAll(id);
}

export async function deleteBatch(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.batch.delete({ where: { id } });
  revalidateAll();
  redirect("/batches");
}
