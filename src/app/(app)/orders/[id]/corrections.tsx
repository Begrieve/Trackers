"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateOrderItems, updatePayment } from "@/actions/orders";
import type { ActionState } from "@/actions/customers";
import { MethodOptions } from "@/components/method-select";
import { formatMoney, toDateInputValue } from "@/lib/money";

function Save({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

type Product = { id: string; name: string; unitLabel: string; unitPrice: number };
type Item = { id: string; productId: string; name: string; quantity: number; unitPrice: number };

/** Fix a wrong quantity, drop a line, or add one that was missed. */
export function EditItems({ orderId, items, products }: { orderId: string; items: Item[]; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateOrderItems, {});

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.productId, i.quantity])),
  );

  // Products already on the order first, so corrections stay near the top.
  const ordered = useMemo(() => {
    const onOrder = new Set(items.map((i) => i.productId));
    return [...products].sort(
      (a, b) => Number(onOrder.has(b.id)) - Number(onOrder.has(a.id)) || a.name.localeCompare(b.name),
    );
  }, [items, products]);

  const priceOf = (productId: string) =>
    items.find((i) => i.productId === productId)?.unitPrice ??
    products.find((p) => p.id === productId)?.unitPrice ??
    0;

  const total = Object.entries(quantities).reduce(
    (sum, [productId, qty]) => sum + priceOf(productId) * (qty || 0),
    0,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-fg-muted hover:text-fg"
      >
        Correct items
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-line pt-3">
      <input type="hidden" name="orderId" value={orderId} />

      <ul className="divide-y divide-line">
        {ordered.map((product) => {
          const qty = quantities[product.id] ?? 0;
          const price = priceOf(product.id);
          return (
            <li key={product.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{product.name}</p>
                <p className="text-xs text-fg-muted">{formatMoney(price)} each</p>
              </div>
              <input
                type="number"
                min={0}
                value={qty}
                aria-label={`Quantity of ${product.name}`}
                onChange={(e) =>
                  setQuantities((q) => ({ ...q, [product.id]: Math.max(0, Number(e.target.value)) }))
                }
                className="h-9 w-16 rounded-lg border border-line-strong bg-surface text-center text-sm tabular-nums text-fg"
              />
              {qty > 0 ? (
                <>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="quantity" value={qty} />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-line pt-2">
        <span className="text-sm font-semibold text-fg-muted">New order total</span>
        <span className="text-lg font-bold tabular-nums text-fg">{formatMoney(total)}</span>
      </div>

      <p className="text-xs text-fg-subtle">
        Lines already on this order keep the price they were sold at. Setting a quantity to zero
        removes the line.
      </p>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Save label="Save items" />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type Payment = { id: string; amount: number; method: string; paidAt: Date; note: string | null };

/** Correct a payment entered wrongly, rather than deleting and re-adding it. */
export function EditPayment({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updatePayment, {});

  // Collapse the form once the save lands, so the row shows the corrected values.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-fg-subtle hover:bg-surface-2 hover:text-fg"
      >
        Edit
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 w-full space-y-3 rounded-xl bg-surface-2 p-3">
      <input type="hidden" name="paymentId" value={payment.id} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`amount-${payment.id}`}>
            Amount
          </label>
          <input
            id={`amount-${payment.id}`}
            name="amount"
            inputMode="decimal"
            defaultValue={(payment.amount / 100).toFixed(2)}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`method-${payment.id}`}>
            How
          </label>
          <select
            id={`method-${payment.id}`}
            name="method"
            defaultValue={payment.method}
            className="field"
          >
            <MethodOptions />
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`paidAt-${payment.id}`}>
          Date
        </label>
        <input
          id={`paidAt-${payment.id}`}
          name="paidAt"
          type="date"
          defaultValue={toDateInputValue(payment.paidAt)}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor={`note-${payment.id}`}>
          Note
        </label>
        <input
          id={`note-${payment.id}`}
          name="note"
          defaultValue={payment.note ?? ""}
          className="field"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Save />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
