"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import { isAllocationKind } from "@/lib/allocations";
import { splitOldestFirst, totalRemaining } from "@/lib/allocate-fifo";
import { jarsFrom } from "@/lib/weight";
import { fromDateInputValue } from "@/lib/money";
import type { ActionState } from "./customers";

function revalidateAll(batchId: string) {
  revalidatePath("/set-aside");
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
        customerId: String(formData.get("customerId") ?? "").trim() || null,
        wentOutOn: formData.get("pending") === "on" ? null : new Date(),
        note: String(formData.get("note") ?? "").trim() || null,
      };
    }),
  });

  revalidateAll(batchId);
  return { ok: true };
}

/**
 * Correct an entry after the fact.
 *
 * These get typed in quickly — a jar handed over at the door, a sample at a
 * fair — so the details catch up later: who it actually went to, which day,
 * what it was for. Everything about the entry can be changed except which
 * batch it came from, since that is what ties it to a cook.
 */
export async function updateAllocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const db = await getDb();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing entry" };

  const existing = await db.batchAllocation.findUnique({ where: { id } });
  if (!existing) return { error: "That entry no longer exists." };

  const kindRaw = String(formData.get("kind") ?? "");
  if (!isAllocationKind(kindRaw)) return { error: "Pick where the jars went." };

  const quantity = Number(String(formData.get("quantity") ?? "0"));
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Enter how many jars." };

  // Ticking "still to hand over" clears the day, which is what puts the entry
  // back on the delivery run. An emptied date box means the same thing.
  const pending = formData.get("pending") === "on";
  const dayRaw = String(formData.get("wentOutOn") ?? "").trim();
  let wentOutOn: Date | null = null;
  if (!pending) {
    wentOutOn = dayRaw ? fromDateInputValue(dayRaw) : (existing.wentOutOn ?? new Date());
    if (!wentOutOn) return { error: "Enter the day like 2026-11-19." };
  }

  // Raising the count has to fit what the batch still holds. Its own jars are
  // added back first, or editing an entry without touching the count would
  // measure it against itself.
  if (quantity > existing.quantity && existing.varietyId) {
    const batch = await db.batch.findUnique({
      where: { id: existing.batchId },
      include: {
        yields: { where: { varietyId: existing.varietyId } },
        orderItems: { where: { varietyId: existing.varietyId } },
        allocations: { where: { varietyId: existing.varietyId } },
      },
    });
    if (batch) {
      const freeOz = Math.max(
        batch.yields.reduce((sum, y) => sum + y.weightOz, 0) -
          batch.orderItems.reduce((sum, i) => sum + i.quantity * i.jarWeightOz, 0) -
          batch.allocations.reduce((sum, a) => sum + a.quantity * a.jarWeightOz, 0) +
          existing.quantity * existing.jarWeightOz,
        0,
      );
      const room = jarsFrom(freeOz, existing.jarWeightOz);
      if (quantity > room) {
        return {
          error: `${batch.code} only has enough left for ${room} ${room === 1 ? "jar" : "jars"} that size.`,
        };
      }
    }
  }

  const customerId = String(formData.get("customerId") ?? "").trim() || null;

  await db.batchAllocation.update({
    where: { id },
    data: {
      kind: kindRaw,
      quantity,
      wentOutOn,
      customerId,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });

  revalidateAll(existing.batchId);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
  return { ok: true };
}

/**
 * Hand over what was promised: the jars leave today.
 *
 * Its own action because this is the one-tap move on the delivery run, where
 * opening a form to set a date would be the wrong amount of ceremony.
 */
export async function markHandedOver(formData: FormData): Promise<void> {
  await requireUser();
  const db = await getDb();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const updated = await db.batchAllocation.update({
    where: { id },
    data: { wentOutOn: new Date() },
  });

  revalidateAll(updated.batchId);
  if (updated.customerId) revalidatePath(`/customers/${updated.customerId}`);
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
  const customerId = String(formData.get("customerId") ?? "").trim() || null;
  // Unticked means it is already out of your hands, which is the common case.
  const wentOutOn = formData.get("pending") === "on" ? null : new Date();

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
      customerId,
      wentOutOn,
      note,
    })),
  });

  for (const split of splits) revalidatePath(`/batches/${split.batchId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/set-aside");
  revalidatePath("/");
  revalidatePath("/batches");
  revalidatePath("/deliveries");
  revalidatePath("/reports");

  const where = splits.map((s) => s.code).join(", ");
  return { ok: true, message: `${wanted} ${wanted === 1 ? "jar" : "jars"} from ${where}` };
}
