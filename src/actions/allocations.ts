"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import { isAllocationKind } from "@/lib/allocations";
import { splitOldestFirst, totalRemaining } from "@/lib/allocate-fifo";
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

/**
 * Set jars aside without naming a batch.
 *
 * Reached from the dashboard, where the thought is "keep a napa for us"
 * rather than "take one from B-261018-1". The batch is still recorded — it
 * is chosen oldest-first, and a request spanning two batches is split across
 * both rather than being forced into one.
 */
export async function setAsideFromStock(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const db = await getDb();

  const productId = String(formData.get("productId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const wanted = Number(String(formData.get("quantity") ?? "0"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!productId) return { error: "Pick which kimchi." };
  if (!isAllocationKind(kindRaw)) return { error: "Pick where the jars went." };
  if (!Number.isInteger(wanted) || wanted <= 0) return { error: "Enter how many jars." };

  const batches = await db.batch.findMany({
    where: { items: { some: { productId } } },
    include: {
      items: { where: { productId } },
      orderItems: { where: { productId } },
      allocations: { where: { productId } },
    },
  });

  const stock = batches.map((batch) => ({
    batchId: batch.id,
    code: batch.code,
    madeOn: batch.madeOn,
    remaining: Math.max(
      batch.items.reduce((sum, i) => sum + i.quantity, 0) -
        batch.orderItems.reduce((sum, i) => sum + i.quantity, 0) -
        batch.allocations.reduce((sum, a) => sum + a.quantity, 0),
      0,
    ),
  }));

  const available = totalRemaining(stock);
  if (available === 0) return { error: "There are none of those on the shelf." };
  if (wanted > available) {
    return { error: `Only ${available} ${available === 1 ? "jar is" : "jars are"} on the shelf.` };
  }

  const { splits } = splitOldestFirst(stock, wanted);
  const name = batches.find((b) => b.items.length > 0)?.items[0]?.name ?? "Jar";

  await db.batchAllocation.createMany({
    data: splits.map((split) => ({
      batchId: split.batchId,
      productId,
      name,
      quantity: split.quantity,
      kind: kindRaw,
      note,
    })),
  });

  for (const split of splits) revalidatePath(`/batches/${split.batchId}`);
  revalidatePath("/");
  revalidatePath("/batches");
  revalidatePath("/deliveries");
  revalidatePath("/reports");

  const where = splits.map((s) => s.code).join(", ");
  return { ok: true, message: `${wanted} ${wanted === 1 ? "jar" : "jars"} from ${where}` };
}
