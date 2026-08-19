"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCustomer, type ActionState } from "@/actions/customers";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? "Saving…" : "Save contact"}
    </button>
  );
}

export function EditCustomer({ customer }: { customer: Customer }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateCustomer, {});

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-bold text-stone-900">Contact details</h2>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={customer.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required className="field" defaultValue={customer.name} />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className="field" defaultValue={customer.phone ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" className="field" defaultValue={customer.email ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <input id="notes" name="notes" className="field" defaultValue={customer.notes ?? ""} />
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

        <Submit />
      </form>
    </section>
  );
}
