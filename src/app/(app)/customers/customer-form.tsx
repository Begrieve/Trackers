"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCustomer, type ActionState } from "@/actions/customers";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function AddCustomer() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createCustomer, {});
  const ref = useRef<HTMLFormElement>(null);

  // Keyed on the whole state object rather than state.ok: every submission
  // returns a fresh object, whereas ok stays true from one save to the next and
  // so would never re-fire — leaving the form open with the last values in it.
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Add person
      </button>
    );
  }

  return (
    <form ref={ref} action={formAction} className="card w-full space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required className="field" placeholder="Name" autoFocus />
        <input name="phone" className="field" placeholder="Phone (optional)" />
        <input name="email" className="field" placeholder="Email (optional)" />
        <input name="notes" className="field" placeholder="Notes (optional)" />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit label="Save person" />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
