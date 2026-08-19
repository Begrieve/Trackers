"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createBatch } from "@/actions/batches";
import type { ActionState } from "@/actions/customers";
import { toDateInputValue } from "@/lib/money";

type Product = { id: string; name: string; unitLabel: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : "Save batch"}
    </button>
  );
}

export function BatchForm({ products }: { products: Product[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createBatch, {});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const totalJars = useMemo(
    () => Object.values(quantities).reduce((sum, n) => sum + (n || 0), 0),
    [quantities],
  );

  function setQty(id: string, value: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, value) }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <section className="card p-4">
        <h2 className="mb-1 font-bold text-fg">How many jars did you make?</h2>
        <p className="mb-3 text-sm text-fg-muted">Count what came out of this cook.</p>

        {products.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No products yet —{" "}
            <Link href="/products" className="font-semibold text-danger underline">
              add one first
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const qty = quantities[p.id] ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{p.name}</p>
                    <p className="text-xs text-fg-muted">per {p.unitLabel}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`One fewer ${p.name}`}
                      className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
                      onClick={() => setQty(p.id, qty - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      aria-label={`Jars made of ${p.name}`}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="h-9 w-16 rounded-lg border border-line-strong bg-surface text-center text-sm tabular-nums text-fg"
                    />
                    <button
                      type="button"
                      aria-label={`One more ${p.name}`}
                      className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
                      onClick={() => setQty(p.id, qty + 1)}
                    >
                      +
                    </button>
                  </div>

                  {qty > 0 ? (
                    <>
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="quantity" value={qty} />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-fg-muted">Jars in this batch</span>
          <span className="text-xl font-bold tabular-nums text-fg">{totalJars}</span>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold text-fg">Details</h2>

        <div>
          <label className="label" htmlFor="label">
            Name (optional)
          </label>
          <input
            id="label"
            name="label"
            className="field"
            placeholder="Autumn napa, extra spicy"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="madeOn">
              Made on
            </label>
            <input
              id="madeOn"
              name="madeOn"
              type="date"
              className="field"
              defaultValue={toDateInputValue(new Date())}
            />
          </div>
          <div>
            <label className="label" htmlFor="readyOn">
              Ready on (optional)
            </label>
            <input id="readyOn" name="readyOn" type="date" className="field" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="field"
            placeholder="Salt ratio, cabbage source, how it tasted…"
          />
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Submit />
        <Link href="/batches" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
