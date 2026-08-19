"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/auth";
import { parseMoney } from "@/lib/money";
import type { ActionState } from "./customers";
import { PAYMENT_METHODS, isPaymentMethod, type PaymentMethodValue } from "@/lib/payment-methods";



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

function revalidateAll(orderId?: string) {
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/orders/new");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  let customerId = String(formData.get("customerId") ?? "").trim();
  const newCustomerName = String(formData.get("newCustomerName") ?? "").trim();

  if (!customerId) {
    if (!newCustomerName) return { error: "Pick a person or type a new name." };
    const created = await prisma.customer.create({ data: { name: newCustomerName } });
    customerId = created.id;
  }

  const lines = readLineItems(formData);
  if (lines.length === 0) return { error: "Add at least one item with a quantity." };

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (lines.some((l) => !byId.has(l.productId))) return { error: "One of those products no longer exists." };

  const prepaidRaw = String(formData.get("prepaidAmount") ?? "").trim();
  let prepaid = 0;
  if (prepaidRaw) {
    try {
      prepaid = parseMoney(prepaidRaw);
    } catch {
      return { error: "Enter the amount paid like 25.00" };
    }
    if (prepaid < 0) return { error: "Payment can't be negative." };
  }

  const methodRaw = String(formData.get("prepaidMethod") ?? "CASH");
  const method: PaymentMethodValue = isPaymentMethod(methodRaw) ? methodRaw : "CASH";

  const delivered = formData.get("delivered") === "on";
  const orderedAt = parseDate(formData.get("orderedAt")) ?? new Date();

  const order = await prisma.order.create({
    data: {
      customerId,
      createdById: user.id,
      orderedAt,
      dueAt: parseDate(formData.get("dueAt")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      status: delivered ? "DELIVERED" : "PENDING",
      deliveredAt: delivered ? new Date() : null,
      items: {
        create: lines.map((line) => {
          const product = byId.get(line.productId)!;
          return {
            productId: product.id,
            name: product.name,
            quantity: line.quantity,
            unitPrice: product.unitPrice,
          };
        }),
      },
      ...(prepaid > 0
        ? {
            payments: {
              create: {
                customerId,
                amount: prepaid,
                method,
                recordedById: user.id,
                note: delivered ? "Paid at delivery" : "Prepaid at order",
              },
            },
          }
        : {}),
    },
  });

  revalidateAll(order.id);
  redirect(`/orders/${order.id}`);
}

export async function updateOrder(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.order.update({
    where: { id },
    data: {
      orderedAt: parseDate(formData.get("orderedAt")) ?? undefined,
      dueAt: parseDate(formData.get("dueAt")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidateAll(id);
}

export async function setOrderStatus(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["PENDING", "DELIVERED", "CANCELLED"].includes(status)) return;

  await prisma.order.update({
    where: { id },
    data: {
      status: status as "PENDING" | "DELIVERED" | "CANCELLED",
      deliveredAt: status === "DELIVERED" ? new Date() : null,
    },
  });

  revalidateAll(id);
}

export async function deleteOrder(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.order.delete({ where: { id } });
  revalidateAll();
  redirect("/orders");
}

const paymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.string().trim().min(1, "Enter an amount"),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

export async function addPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    method: String(formData.get("method") ?? "CASH"),
    paidAt: String(formData.get("paidAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let amount: number;
  try {
    amount = parseMoney(parsed.data.amount);
  } catch {
    return { error: "Enter an amount like 25.00" };
  }
  if (amount === 0) return { error: "Amount can't be zero." };

  const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order) return { error: "That order no longer exists." };

  await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      amount,
      method: parsed.data.method,
      paidAt: parseDate(formData.get("paidAt")) ?? new Date(),
      note: parsed.data.note || null,
      recordedById: user.id,
    },
  });

  revalidateAll(order.id);
  return { ok: true };
}

export async function markPaidInFull(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!order) return;

  const total = order.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - paid;
  if (balance <= 0) return;

  await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      amount: balance,
      method: "CASH",
      recordedById: user.id,
      note: "Balance settled",
    },
  });

  revalidateAll(id);
}

export async function deletePayment(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("paymentId") ?? "");
  if (!id) return;
  const payment = await prisma.payment.delete({ where: { id } });
  revalidateAll(payment.orderId);
}
