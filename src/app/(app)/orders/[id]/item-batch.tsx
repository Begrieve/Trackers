"use client";

import { useRef } from "react";
import { setItemBatch } from "@/actions/orders";
import { fillOrderFromBatch } from "@/actions/batches";

export function ItemBatchPicker({
  itemId,
  batchId,
  batches,
}: {
  itemId: string;
  batchId: string | null;
  batches: { id: string; code: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (batches.length === 0) return null;

  return (
    <form ref={formRef} action={setItemBatch} className="mt-1">
      <input type="hidden" name="itemId" value={itemId} />
      <label className="sr-only" htmlFor={`batch-${itemId}`}>
        Batch this line came from
      </label>
      <select
        // Uncontrolled selects ignore a changed defaultValue, so remount on save.
        key={batchId ?? "none"}
        id={`batch-${itemId}`}
        name="batchId"
        defaultValue={batchId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-fg-muted"
      >
        <option value="">From batch…</option>
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.code} · {batch.label}
          </option>
        ))}
      </select>
    </form>
  );
}

/** Attribute every line of the order to one batch in a single step. */
export function OrderBatchPicker({
  orderId,
  currentBatchId,
  batches,
}: {
  orderId: string;
  currentBatchId: string | null;
  batches: { id: string; code: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (batches.length === 0) return null;

  return (
    <form ref={formRef} action={fillOrderFromBatch} className="flex items-center gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="text-sm text-fg-muted" htmlFor={`order-batch-${orderId}`}>
        Fill from
      </label>
      <select
        key={currentBatchId ?? "none"}
        id={`order-batch-${orderId}`}
        name="batchId"
        defaultValue={currentBatchId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg"
      >
        <option value="">No batch</option>
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.code} · {batch.label}
          </option>
        ))}
      </select>
    </form>
  );
}
