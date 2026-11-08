"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { setAsideFromStock } from "@/actions/allocations";
import type { ActionState } from "@/actions/customers";
import { ALLOCATION_KINDS, type AllocationKindValue } from "@/lib/allocations";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count <= 0}>
      {pending ? "Saving…" : `Set aside ${count} ${count === 1 ? "jar" : "jars"}`}
    </button>
  );
}

export type ShelfRow = { productId: string; name: string; spare: number };

/**
 * Set jars aside from anywhere, without first finding the batch they are in.
 * Only products with jars on the shelf are offered, so the form can't ask for
 * something that isn't there.
 */
export function SetAsideJars({ rows }: { rows: ShelfRow[] }) {
  const onShelf = rows.filter((r) => r.spare > 0);

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(onShelf[0]?.productId ?? "");
  const [kind, setKind] = useState<AllocationKindValue>("KEPT");
  const [quantity, setQuantity] = useState(1);
  const [state, formAction] = useActionState<ActionState, FormData>(setAsideFromStock, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setQuantity(1);
    }
  }, [state.ok]);

  if (onShelf.length === 0) return null;

  const selected = onShelf.find((r) => r.productId === productId) ?? onShelf[0];
  const max = selected?.spare ?? 0;

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary w-full sm:w-auto"
        >
          Keep or give away a jar
        </button>
        {state.ok && state.message ? (
          <p className="mt-2 text-sm font-medium text-success">Set aside · {state.message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="card mt-3 space-y-4 p-4">
      <input type="hidden" name="kind" value={kind} />

      <div>
        <h3 className="font-bold text-fg">Keep or give away a jar</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Taken from the oldest batch that still has some, so you don&apos;t have to go
          looking for it.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="setaside-product">
          Which kimchi
        </label>
        <select
          id="setaside-product"
          name="productId"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setQuantity(1);
          }}
          className="field"
        >
          {onShelf.map((row) => (
            <option key={row.productId} value={row.productId}>
              {row.name} — {row.spare} on the shelf
            </option>
          ))}
        </select>
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

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-fg-muted">How many</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="One fewer"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
          >
            −
          </button>
          <input
            type="number"
            name="quantity"
            min={1}
            max={max}
            value={quantity}
            aria-label="Jars to set aside"
            onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value), max)))}
            className="h-9 w-16 rounded-lg border border-line-strong bg-surface text-center text-sm tabular-nums text-fg"
          />
          <button
            type="button"
            aria-label="One more"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => setQuantity(max)}
          className="text-sm font-semibold text-brand hover:underline"
        >
          All {max}
        </button>
      </div>

      <div>
        <label className="label" htmlFor="setaside-note">
          Note (optional)
        </label>
        <input
          id="setaside-note"
          name="note"
          className="field"
          placeholder="For us, sent to Mum, church fundraiser…"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit count={quantity} />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
