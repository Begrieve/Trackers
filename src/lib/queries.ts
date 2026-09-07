import { prisma } from "@/lib/db";
import type { FullOrder } from "@/lib/ledger";

const include = {
  customer: true,
  items: { orderBy: { name: "asc" }, include: { batch: { select: { code: true } } } },
  payments: { orderBy: { paidAt: "desc" } },
} as const;

export async function getOrders(where: Record<string, unknown> = {}): Promise<FullOrder[]> {
  return prisma.order.findMany({
    where,
    include,
    orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getOrder(id: string): Promise<FullOrder | null> {
  return prisma.order.findUnique({ where: { id }, include });
}
