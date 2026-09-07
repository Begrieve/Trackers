/**
 * An order is "ready" when the jars for it physically exist and are spoken for:
 * it hasn't been handed over yet, and every line says which batch filled it.
 *
 * Nothing extra is stored or maintained. Attaching a batch is what marks an
 * order ready, so the label can never drift from what the batches actually say.
 */

export type Readiness =
  | { ready: false }
  | { ready: true; label: string; codes: string[] };

type ReadinessOrder = {
  status: string;
  items: { batchId: string | null; batch?: { code: string } | null }[];
};

export function readinessOf(order: ReadinessOrder): Readiness {
  if (order.status !== "PENDING") return { ready: false };
  if (order.items.length === 0) return { ready: false };
  if (!order.items.every((item) => item.batchId)) return { ready: false };

  const codes = [...new Set(order.items.map((item) => item.batch?.code).filter(Boolean))] as string[];

  if (codes.length === 0) return { ready: true, label: "Ready to deliver", codes };
  if (codes.length === 1) return { ready: true, label: `Ready · ${codes[0]}`, codes };
  return { ready: true, label: `Ready · ${codes.length} batches`, codes };
}

export function readyCount(orders: ReadinessOrder[]): number {
  return orders.filter((order) => readinessOf(order).ready).length;
}
