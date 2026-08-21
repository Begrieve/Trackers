"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProduct, updateProduct } from "@/actions/products";
import type { ActionState } from "@/actions/customers";

type Product = {
  id: string;
  name: string;
  unitLabel: string;
  unitPrice: number;
  active: boolean;
};

function Submit({ label, variant = "primary" }: { label: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={variant === "primary" ? "btn-primary" : "btn-secondary"}
      disabled={pending}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function AddProduct() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createProduct, {});
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
        + Add product
      </button>
    );
  }

  return (
    <form ref={ref} action={formAction} className="card w-full space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input name="name" required className="field sm:col-span-1" placeholder="Napa kimchi — 32 oz" autoFocus />
        <input name="price" required inputMode="decimal" className="field" placeholder="25.00" />
        <input name="unitLabel" className="field" placeholder="jar" defaultValue="jar" />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit label="Save product" />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EditProduct({ product }: { product: Product }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateProduct, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={product.id} />
      <input name="name" required className="field flex-1 sm:min-w-[16rem]" defaultValue={product.name} />
      <input
        name="price"
        required
        inputMode="decimal"
        className="field w-24"
        defaultValue={(product.unitPrice / 100).toFixed(2)}
      />
      <input name="unitLabel" className="field w-24" defaultValue={product.unitLabel} />
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" name="active" defaultChecked={product.active} className="h-4 w-4 accent-brand" />
        Active
      </label>
      <Submit label="Save" variant="secondary" />
      {state.error ? <span className="text-sm text-danger">{state.error}</span> : null}
    </form>
  );
}
