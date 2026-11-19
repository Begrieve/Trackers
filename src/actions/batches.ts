"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/scope";
import { requireUser } from "@/auth";
import type { ActionState } from "./customers";
import { fromDateInputValue, parseMoney } from "@/lib/money";
import { parseWeight } from "@/lib/weight";
import { batchCodePrefix, nextBatchCode } from "@/lib/batch-code";

const parseDate = (value: FormDataEntryValue | null) => fromDateInputValue(String(value ?? ""));

/**
 * What the cook produced: a weight for each kimchi type. Blank boxes are
 * skipped, so a batch can be saved before it has been weighed.
 */
function readYields(formData: FormData) {
  const varietyIds = formData.getAll("varietyId").map(String);
  const weights = formData.getAll("weight").map(String);

  return varietyIds
    .map((varietyId, index) => ({ varietyId, raw: (weights[index] ?? "").trim() }))
    .filter((line) => line.varietyId && line.raw !== "")
    .map((line) => ({ varietyId: line.varietyId, weightOz: parseWeight(line.raw) }))
    .filter((line) => line.weightOz > 0);
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
  revalidatePath("/deliveries");
  revalidatePath("/reports");
  if (batchId) revalidatePath(`/batches/${batchId}`);
}

export async function createBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await getDb();
  const user = await requireUser();

  const madeOn = parseDate(formData.get("madeOn")) ?? new Date();
  const label =
    String(formData.get("label") ?? "").trim() ||
    `Batch of ${madeOn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // A cook can be recorded before it is weighed: the weight comes later.
  let lines: { varietyId: string; weightOz: number }[];
  try {
    lines = readYields(formData);
  } catch {
    return { error: "Enter each weight like 38 or 38.5 lb, or 12 oz." };
  }

  const varieties = await db.variety.findMany({
    where: { id: { in: lines.map((l) => l.varietyId) } },
  });
  const byId = new Map(varieties.map((v) => [v.id, v]));
  if (lines.some((l) => !byId.has(l.varietyId))) {
    return { error: "One of those kimchi types no longer exists." };
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
    yields: {
      create: lines.map((line) => {
        const variety = byId.get(line.varietyId)!;
        return { varietyId: variety.id, name: variety.name, weightOz: line.weightOz };
      }),
    },
    costs: { create: costs },
  };

  // Two batches saved at the same moment would compute the same code, so the
  // unique index is the arbiter: on a clash, recompute and try again.
  let batch;
  for (let attempt = 0; attempt < 5; attempt++) {
    const sameDay = await db.batch.findMany({
      where: { code: { startsWith: batchCodePrefix(madeOn) } },
      select: { code: true },
    });
    try {
      batch = await db.batch.create({
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
  redirect(`/batches/${batch!.id}`);
}

export async function updateBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await getDb();
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing batch." };

  const existing = await db.batch.findUnique({ where: { id }, include: { yields: true } });
  if (!existing) return { error: "That batch no longer exists." };

  let lines: { varietyId: string; weightOz: number }[];
  try {
    lines = readYields(formData);
  } catch {
    return { error: "Enter each weight like 38 or 38.5 lb, or 12 oz." };
  }

  const varieties = await db.variety.findMany({
    where: { id: { in: lines.map((l) => l.varietyId) } },
  });
  const byId = new Map(varieties.map((v) => [v.id, v]));
  if (lines.some((l) => !byId.has(l.varietyId))) {
    return { error: "One of those kimchi types no longer exists." };
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
  await db.$transaction([
    db.batchYield.deleteMany({ where: { batchId: id } }),
    db.batchCost.deleteMany({ where: { batchId: id } }),
    db.batch.update({
      where: { id },
      data: {
        label: String(formData.get("label") ?? "").trim() || existing.label,
        madeOn: parseDate(formData.get("madeOn")) ?? existing.madeOn,
        readyOn: parseDate(formData.get("readyOn")),
        notes: String(formData.get("notes") ?? "").trim() || null,
        yields: {
          create: lines.map((line) => {
            const variety = byId.get(line.varietyId)!;
            return { varietyId: variety.id, name: variety.name, weightOz: line.weightOz };
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
  const db = await getDb();
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.batch.delete({ where: { id } });
  revalidateAll();
  redirect("/batches");
}

/**
 * Point order lines at the batch that filled them. Only lines whose product the
 * batch actually made are touched, so a radish line can never be attributed to
 * a napa cook.
 */
export async function fillOrdersFromBatch(formData: FormData): Promise<void> {
  const db = await getDb();
  await requireUser();
  const batchId = String(formData.get("batchId") ?? "");
  const orderIds = formData.getAll("orderId").map(String).filter(Boolean);
  if (!batchId || orderIds.length === 0) return;

  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: { yields: { select: { varietyId: true } } },
  });
  if (!batch) return;

  await db.orderItem.updateMany({
    where: {
      orderId: { in: orderIds },
      varietyId: { in: batch.yields.map((y) => y.varietyId) },
    },
    data: { batchId },
  });

  for (const orderId of orderIds) revalidatePath(`/orders/${orderId}`);
  revalidateAll(batchId);
}

/** Attribute every line of one order to a batch, or clear them all. */
export async function fillOrderFromBatch(formData: FormData): Promise<void> {
  const db = await getDb();
  await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!orderId) return;

  if (!batchId) {
    await db.orderItem.updateMany({ where: { orderId }, data: { batchId: null } });
  } else {
    const batch = await db.batch.findUnique({
      where: { id: batchId },
      include: { yields: { select: { varietyId: true } } },
    });
    if (!batch) return;

    await db.orderItem.updateMany({
      where: { orderId, varietyId: { in: batch.yields.map((y) => y.varietyId) } },
      data: { batchId },
    });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidateAll(batchId || undefined);
}
