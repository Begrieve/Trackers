import { getDb } from "@/lib/scope";
import type { FullOrder } from "@/lib/ledger";

const include = {
  customer: true,
  items: { orderBy: { name: "asc" }, include: { batch: { select: { code: true } } } },
  payments: { orderBy: { paidAt: "desc" } },
} as const;

export async function getOrders(where: Record<string, unknown> = {}): Promise<FullOrder[]> {
  const db = await getDb();
  return db.order.findMany({
    where,
    include,
    orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getOrder(id: string): Promise<FullOrder | null> {
  const db = await getDb();
  return db.order.findUnique({ where: { id }, include });
}
