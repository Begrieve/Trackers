"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import { isAllocationKind } from "@/lib/allocations";
import { splitOldestFirst, totalRemaining } from "@/lib/allocate-fifo";
import { jarsFrom } from "@/lib/weight";
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
    include: { yields: true },
  });
  if (!batch) return { error: "That batch no longer exists." };

  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Only kimchi this batch actually made can be set aside from it.
  const made = new Set(batch.yields.map((y) => y.varietyId));
  const valid = lines.filter((line) => {
    const product = byId.get(line.productId);
    return product?.varietyId && made.has(product.varietyId);
  });
  if (valid.length === 0) return { error: "This batch did not make that kimchi." };

  await db.batchAllocation.createMany({
    data: valid.map((line) => {
      const product = byId.get(line.productId)!;
      return {
        batchId,
        productId: product.id,
        name: product.name,
        quantity: line.quantity,
        varietyId: product.varietyId,
        jarWeightOz: product.jarWeightOz,
        kind: kindRaw,
        note: String(formData.get("note") ?? "").trim() || null,
      };
    }),
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

  if (!productId) return { error: "Pick which jar." };
  if (!isAllocationKind(kindRaw)) return { error: "Pick where the jars went." };
  if (!Number.isInteger(wanted) || wanted <= 0) return { error: "Enter how many jars." };

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product?.varietyId) return { error: "That jar has no kimchi type set." };

  const varietyId = product.varietyId;
  const batches = await db.batch.findMany({
    where: { yields: { some: { varietyId } } },
    include: {
      yields: { where: { varietyId } },
      orderItems: { where: { varietyId } },
      allocations: { where: { varietyId } },
    },
  });

  // Batches hold weight, so what matters is how many whole jars of this size
  // each one could still fill. A part jar's worth of kimchi is not a jar.
  const stock = batches.map((batch) => {
    const remainingOz = Math.max(
      batch.yields.reduce((sum, y) => sum + y.weightOz, 0) -
        batch.orderItems.reduce((sum, i) => sum + i.quantity * i.jarWeightOz, 0) -
        batch.allocations.reduce((sum, a) => sum + a.quantity * a.jarWeightOz, 0),
      0,
    );
    return {
      batchId: batch.id,
      code: batch.code,
      madeOn: batch.madeOn,
      remaining: jarsFrom(remainingOz, product.jarWeightOz),
    };
  });

  const available = totalRemaining(stock);
  if (available === 0) return { error: "There is not enough of that kimchi left to fill a jar." };
  if (wanted > available) {
    return {
      error: `Only ${available} ${available === 1 ? "jar" : "jars"} of that size can be filled from what is left.`,
    };
  }

  const { splits } = splitOldestFirst(stock, wanted);

  await db.batchAllocation.createMany({
    data: splits.map((split) => ({
      batchId: split.batchId,
      productId,
      name: product.name,
      quantity: split.quantity,
      varietyId,
      jarWeightOz: product.jarWeightOz,
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
