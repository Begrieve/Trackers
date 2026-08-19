"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addPayment } from "@/actions/orders";
import type { ActionState } from "@/actions/customers";
import { toDateInputValue } from "@/lib/money";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Record payment"}
    </button>
  );
}

export function PaymentForm({ orderId, suggested }: { orderId: string; suggested: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addPayment, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="amount">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            required
            className="field"
            defaultValue={suggested > 0 ? (suggested / 100).toFixed(2) : ""}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label" htmlFor="method">
            Method
          </label>
          <select id="method" name="method" className="field" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="VENMO">Venmo</option>
            <option value="ZELLE">Zelle</option>
            <option value="CASHAPP">Cash App</option>
            <option value="PAYPAL">PayPal</option>
            <option value="CHECK">Check</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paidAt">
            Date
          </label>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            className="field"
            defaultValue={toDateInputValue(new Date())}
          />
        </div>
      </div>

      <input name="note" className="field" placeholder="Note (optional)" />

      {state.error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
