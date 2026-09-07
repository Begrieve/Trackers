"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { fillOrdersFromBatch } from "@/actions/batches";
import { formatDate } from "@/lib/money";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count === 0}>
      {pending
        ? "Assigning…"
        : count === 0
          ? "Pick an order"
          : `Fill ${count} ${count === 1 ? "order" : "orders"}`}
    </button>
  );
}

export type FillableOrder = {
  id: string;
  customerName: string;
  orderedAt: Date;
  jars: number;
  lines: string;
  alreadyAssigned: boolean;
};

export function FillOrders({ batchId, code, orders }: { batchId: string; code: string; orders: FillableOrder[] }) {
  const [picked, setPicked] = useState<string[]>([]);

  if (orders.length === 0) return null;

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <form action={fillOrdersFromBatch} className="card p-4">
      <h2 className="font-bold text-fg">Fill orders from {code}</h2>
      <p className="mt-1 mb-3 text-sm text-fg-muted">
        Tick who this batch goes to. Only lines for the products this batch made are attached.
      </p>

      <input type="hidden" name="batchId" value={batchId} />

      <ul className="divide-y divide-line">
        {orders.map((order) => (
          <li key={order.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2.5">
              <input
                type="checkbox"
                name="orderId"
                value={order.id}
                checked={picked.includes(order.id)}
                onChange={() => toggle(order.id)}
                className="h-5 w-5 shrink-0 rounded border-line-strong accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {order.customerName}
                  {order.alreadyAssigned ? (
                    <span className="ml-2 text-xs font-normal text-fg-subtle">already attached</span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-fg-muted">
                  {order.lines} · ordered {formatDate(order.orderedAt)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-fg-muted">
                {order.jars}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-3">
        <Submit count={picked.length} />
      </div>
    </form>
  );
}
