"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import { isAllocationKind } from "@/lib/allocations";
import type { ActionState } from "./customers";

function revalidateAll(batchId: string) {
  revalidatePath("/");
  revalidatePath("/batches");
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/deliveries");
  revalidatePath("/reports");
}

/**
 * Record jars that left a batch without being sold.
 *
 * Quantities are read per product, so one submission can set aside a single
 * jar or everything the batch made.
 */
export async function allocateJars(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const db = await getDb();

  const batchId = String(formData.get("batchId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  if (!batchId || !isAllocationKind(kindRaw)) return { error: "Pick how these jars left the batch." };

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map((q) => Number(String(q) || 0));

  const lines = productIds
    .map((productId, index) => ({ productId, quantity: quantities[index] ?? 0 }))
    .filter((line) => line.productId && Number.isFinite(line.quantity) && line.quantity > 0);

  if (lines.length === 0) return { error: "Set a count on at least one jar." };

  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
  if (!batch) return { error: "That batch no longer exists." };

  // Only what this batch actually made can be set aside from it.
  const made = new Map(batch.items.map((i) => [i.productId, i]));
  const valid = lines.filter((line) => made.has(line.productId));
  if (valid.length === 0) return { error: "This batch did not make those jars." };

  await db.batchAllocation.createMany({
    data: valid.map((line) => ({
      batchId,
      productId: line.productId,
      name: made.get(line.productId)!.name,
      quantity: line.quantity,
      kind: kindRaw,
      note: String(formData.get("note") ?? "").trim() || null,
    })),
  });

  revalidateAll(batchId);
  return { ok: true };
}

export async function removeAllocation(formData: FormData): Promise<void> {
  await requireUser();
  const db = await getDb();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const allocation = await db.batchAllocation.delete({ where: { id } });
  revalidateAll(allocation.batchId);
}
