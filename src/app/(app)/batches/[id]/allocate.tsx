"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { allocateJars } from "@/actions/allocations";
import type { ActionState } from "@/actions/customers";
import { ALLOCATION_KINDS, type AllocationKindValue } from "@/lib/allocations";

function Submit({ total, label }: { total: number; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || total === 0}>
      {pending ? "Saving…" : total === 0 ? "Pick some jars" : `${label} ${total} ${total === 1 ? "jar" : "jars"}`}
    </button>
  );
}

export type Allocatable = { productId: string; name: string; remaining: number };

/**
 * Set jars aside from a batch without selling them. Remaining counts are
 * per product, so "all of it" means every jar the batch still holds.
 */
export function AllocateJars({ batchId, rows }: { batchId: string; rows: Allocatable[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AllocationKindValue>("KEPT");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [state, formAction] = useActionState<ActionState, FormData>(allocateJars, {});

  // Close and clear once the jars are recorded, so the same ones can't be set
  // aside twice by submitting again.
  useEffect(() => {
    if (state.ok) {
      setQuantities({});
      setOpen(false);
    }
  }, [state.ok]);

  const total = useMemo(
    () => Object.values(quantities).reduce((sum, n) => sum + (n || 0), 0),
    [quantities],
  );

  const available = rows.filter((r) => r.remaining > 0);
  const kindLabel = ALLOCATION_KINDS.find((k) => k.value === kind)!;

  const setQty = (id: string, value: number, max: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(value, max)) }));

  const takeAll = () =>
    setQuantities(Object.fromEntries(available.map((r) => [r.productId, r.remaining])));

  if (available.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        Keep or give away jars
      </button>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-4">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="kind" value={kind} />

      <div>
        <h2 className="font-bold text-fg">Set jars aside</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Jars that leave this batch without a sale, so the batch still adds up.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALLOCATION_KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKind(option.value)}
            aria-pressed={kind === option.value}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
              kind === option.value
                ? "bg-fg text-bg ring-fg"
                : "bg-surface text-fg-muted ring-line hover:bg-surface-2"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-fg-subtle">{kindLabel.hint}</p>

      <ul className="divide-y divide-line">
        {available.map((row) => {
          const qty = quantities[row.productId] ?? 0;
          return (
            <li key={row.productId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{row.name}</p>
                <p className="text-xs text-fg-muted">{row.remaining} left in this batch</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`One fewer ${row.name}`}
                  onClick={() => setQty(row.productId, qty - 1, row.remaining)}
                  className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={row.remaining}
                  value={qty}
                  aria-label={`Jars of ${row.name} to set aside`}
                  onChange={(e) => setQty(row.productId, Number(e.target.value), row.remaining)}
                  className="h-9 w-16 rounded-lg border border-line-strong bg-surface text-center text-sm tabular-nums text-fg"
                />
                <button
                  type="button"
                  aria-label={`One more ${row.name}`}
                  onClick={() => setQty(row.productId, qty + 1, row.remaining)}
                  className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
                >
                  +
                </button>
              </div>
              {qty > 0 ? (
                <>
                  <input type="hidden" name="productId" value={row.productId} />
                  <input type="hidden" name="quantity" value={qty} />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={takeAll}
        className="text-sm font-semibold text-brand hover:underline"
      >
        Take the whole batch
      </button>

      <div>
        <label className="label" htmlFor="allocation-note">
          Note (optional)
        </label>
        <input
          id="allocation-note"
          name="note"
          className="field"
          placeholder="Church fundraiser, sent to Mum, dropped a jar…"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit total={total} label={kindLabel.label === "Kept for us" ? "Keep" : kindLabel.label} />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
