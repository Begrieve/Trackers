"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/auth";

export type ActionState = { error?: string; ok?: boolean };

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function fields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = customerSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, phone, email, notes } = parsed.data;
  await prisma.customer.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/orders/new");
  return { ok: true };
}

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = customerSchema.safeParse(fields(formData));
  if (!id) return { error: "Missing customer" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, phone, email, notes } = parsed.data;
  await prisma.customer.update({
    where: { id },
    data: {
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/orders");
  revalidatePath("/");
}
