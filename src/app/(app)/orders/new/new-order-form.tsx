"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createOrder } from "@/actions/orders";
import type { ActionState } from "@/actions/customers";
import { formatMoney, toDateInputValue } from "@/lib/money";
import { MethodOptions } from "@/components/method-select";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; unitLabel: string; unitPrice: number };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : "Save order"}
    </button>
  );
}

export function NewOrderForm({
  customers,
  products,
}: {
  customers: Customer[];
  products: Product[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createOrder, {});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isNewCustomer, setIsNewCustomer] = useState(customers.length === 0);
  const [prepaid, setPrepaid] = useState("");

  const total = useMemo(
    () =>
      products.reduce((sum, p) => sum + (quantities[p.id] ?? 0) * p.unitPrice, 0),
    [products, quantities],
  );

  const prepaidCents = Math.round((Number(prepaid.replace(/[$,\s]/g, "")) || 0) * 100);
  const balance = total - prepaidCents;

  function setQty(id: string, value: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, value) }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <section className="card p-4">
        <h2 className="mb-3 font-bold text-fg">Who is this for?</h2>

        {customers.length > 0 && !isNewCustomer ? (
          <>
            <select name="customerId" className="field" required defaultValue="">
              <option value="" disabled>
                Choose a person…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost mt-2 px-0 text-sm"
              onClick={() => setIsNewCustomer(true)}
            >
              + Someone new
            </button>
          </>
        ) : (
          <>
            <input
              name="newCustomerName"
              className="field"
              placeholder="New person's name"
              required
              autoFocus={customers.length > 0}
            />
            {customers.length > 0 ? (
              <button
                type="button"
                className="btn-ghost mt-2 px-0 text-sm"
                onClick={() => setIsNewCustomer(false)}
              >
                ← Pick an existing person
              </button>
            ) : null}
          </>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-bold text-fg">What did they order?</h2>
        <p className="mb-3 text-sm text-fg-muted">Set a quantity for each item they want.</p>

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
                    <p className="text-xs text-fg-muted">
                      {formatMoney(p.unitPrice)} / {p.unitLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Remove one ${p.name}`}
                      className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-fg-muted hover:bg-surface-2"
                      onClick={() => setQty(p.id, qty - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      aria-label={`Quantity of ${p.name}`}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="h-9 w-14 rounded-lg border border-line-strong text-center text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label={`Add one ${p.name}`}
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
          <span className="text-sm font-semibold text-fg-muted">Order total</span>
          <span className="text-xl font-bold tabular-nums text-fg">{formatMoney(total)}</span>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold text-fg">Money & dates</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="prepaidAmount">
              Paid now (optional)
            </label>
            <input
              id="prepaidAmount"
              name="prepaidAmount"
              inputMode="decimal"
              className="field"
              placeholder="0.00"
              value={prepaid}
              onChange={(e) => setPrepaid(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="prepaidMethod">
              How they paid
            </label>
            <select id="prepaidMethod" name="prepaidMethod" className="field" defaultValue="CASH">
              <MethodOptions />
            </select>
          </div>
          <div>
            <label className="label" htmlFor="orderedAt">
              Order date
            </label>
            <input
              id="orderedAt"
              name="orderedAt"
              type="date"
              className="field"
              defaultValue={toDateInputValue(new Date())}
            />
          </div>
          <div>
            <label className="label" htmlFor="dueAt">
              Deliver by (optional)
            </label>
            <input id="dueAt" name="dueAt" type="date" className="field" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea id="notes" name="notes" rows={2} className="field" placeholder="Extra spicy, porch pickup…" />
        </div>

        <label className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
          <input type="checkbox" name="delivered" className="h-5 w-5 rounded accent-brand" />
          <span className="text-sm font-medium text-fg-muted">Already handed over</span>
        </label>

        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="font-semibold text-fg-muted">
            {balance > 0 ? "Still owed" : balance < 0 ? "Credit" : "Fully paid"}
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${
              balance > 0 ? "text-danger" : balance < 0 ? "text-info" : "text-success"
            }`}
          >
            {formatMoney(Math.abs(balance))}
          </span>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Submit />
        <Link href="/orders" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
