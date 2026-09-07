"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/auth";
import type { ActionState } from "./customers";
import { parseMoney } from "@/lib/money";
import { batchCodePrefix, nextBatchCode } from "@/lib/batch-code";

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

function readCosts(formData: FormData) {
  const labels = formData.getAll("costLabel").map(String);
  const amounts = formData.getAll("costAmount").map(String);

  return labels
    .map((label, index) => ({ label: label.trim(), raw: (amounts[index] ?? "").trim() }))
    .filter((row) => row.raw !== "")
    .map((row) => ({ label: row.label || "Cost", amount: parseMoney(row.raw) }))
    .filter((row) => row.amount !== 0);
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

  let costs: { label: string; amount: number }[];
  try {
    costs = readCosts(formData);
  } catch {
    return { error: "Enter each cost like 24.50" };
  }
  if (costs.some((c) => c.amount < 0)) return { error: "Costs can't be negative." };

  const data = {
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
    costs: { create: costs },
  };

  // Two batches saved at the same moment would compute the same code, so the
  // unique index is the arbiter: on a clash, recompute and try again.
  let batch;
  for (let attempt = 0; attempt < 5; attempt++) {
    const sameDay = await prisma.batch.findMany({
      where: { code: { startsWith: batchCodePrefix(madeOn) } },
      select: { code: true },
    });
    try {
      batch = await prisma.batch.create({
        data: { ...data, code: nextBatchCode(madeOn, sameDay.map((b) => b.code)) },
      });
      break;
    } catch (error) {
      const clash =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!clash || attempt === 4) throw error;
    }
  }

  revalidateAll(batch!.id);
  redirect("/batches");
}

export async function updateBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing batch." };

  const existing = await prisma.batch.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return { error: "That batch no longer exists." };

  const lines = readLineItems(formData);
  if (lines.length === 0) return { error: "A batch needs at least one jar count." };

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (lines.some((l) => !byId.has(l.productId))) {
    return { error: "One of those products no longer exists." };
  }

  let costs: { label: string; amount: number }[];
  try {
    costs = readCosts(formData);
  } catch {
    return { error: "Enter each cost like 24.50" };
  }
  if (costs.some((c) => c.amount < 0)) return { error: "Costs can't be negative." };

  // Items and costs are replaced wholesale inside one transaction, so a failure
  // part-way cannot leave a batch holding half its old contents.
  await prisma.$transaction([
    prisma.batchItem.deleteMany({ where: { batchId: id } }),
    prisma.batchCost.deleteMany({ where: { batchId: id } }),
    prisma.batch.update({
      where: { id },
      data: {
        label: String(formData.get("label") ?? "").trim() || existing.label,
        madeOn: parseDate(formData.get("madeOn")) ?? existing.madeOn,
        readyOn: parseDate(formData.get("readyOn")),
        notes: String(formData.get("notes") ?? "").trim() || null,
        items: {
          create: lines.map((line) => {
            const product = byId.get(line.productId)!;
            return { productId: product.id, name: product.name, quantity: line.quantity };
          }),
        },
        costs: { create: costs },
      },
    }),
  ]);

  revalidateAll(id);
  redirect(`/batches/${id}`);
}

export async function deleteBatch(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.batch.delete({ where: { id } });
  revalidateAll();
  redirect("/batches");
}

/**
 * Point order lines at the batch that filled them. Only lines whose product the
 * batch actually made are touched, so a radish line can never be attributed to
 * a napa cook.
 */
export async function fillOrdersFromBatch(formData: FormData): Promise<void> {
  await requireUser();
  const batchId = String(formData.get("batchId") ?? "");
  const orderIds = formData.getAll("orderId").map(String).filter(Boolean);
  if (!batchId || orderIds.length === 0) return;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { items: { select: { productId: true } } },
  });
  if (!batch) return;

  await prisma.orderItem.updateMany({
    where: {
      orderId: { in: orderIds },
      productId: { in: batch.items.map((i) => i.productId) },
    },
    data: { batchId },
  });

  for (const orderId of orderIds) revalidatePath(`/orders/${orderId}`);
  revalidateAll(batchId);
}

/** Attribute every line of one order to a batch, or clear them all. */
export async function fillOrderFromBatch(formData: FormData): Promise<void> {
  await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!orderId) return;

  if (!batchId) {
    await prisma.orderItem.updateMany({ where: { orderId }, data: { batchId: null } });
  } else {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { items: { select: { productId: true } } },
    });
    if (!batch) return;

    await prisma.orderItem.updateMany({
      where: { orderId, productId: { in: batch.items.map((i) => i.productId) } },
      data: { batchId },
    });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidateAll(batchId || undefined);
}
