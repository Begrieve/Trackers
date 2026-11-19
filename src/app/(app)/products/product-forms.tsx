"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProduct, updateProduct } from "@/actions/products";
import { formatMoney } from "@/lib/money";
import { formatJarSize } from "@/lib/weight";
import type { ActionState } from "@/actions/customers";

type Product = {
  id: string;
  name: string;
  unitLabel: string;
  unitPrice: number;
  active: boolean;
  jarWeightOz: number;
  varietyId: string | null;
};

export type Variety = { id: string; name: string };

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

/** A jar is a size of some kimchi; batches are weighed against that kimchi. */
function VarietyField({
  varieties,
  varietyId,
}: {
  varieties: Variety[];
  varietyId?: string | null;
}) {
  return (
    <Field label="Which kimchi">
      <input
        name="variety"
        required
        list="variety-options"
        className="field"
        defaultValue={varieties.find((v) => v.id === varietyId)?.name ?? ""}
        placeholder="Napa cabbage kimchi"
      />
      <datalist id="variety-options">
        {varieties.map((v) => (
          <option key={v.id} value={v.name} />
        ))}
      </datalist>
    </Field>
  );
}

function JarSizeField({ jarWeightOz }: { jarWeightOz?: number }) {
  return (
    <Field label="Jar holds">
      <div className="relative min-w-0">
        <input
          name="jarWeightOz"
          required
          inputMode="decimal"
          className="field pr-9"
          defaultValue={jarWeightOz ?? 16}
          placeholder="16"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-fg-subtle"
        >
          oz
        </span>
      </div>
    </Field>
  );
}

function PriceField({ unitPrice }: { unitPrice?: number }) {
  return (
    <Field label="Price">
      <div className="relative min-w-0">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-subtle"
        >
          $
        </span>
        <input
          name="price"
          required
          inputMode="decimal"
          className="field pl-7"
          defaultValue={unitPrice === undefined ? undefined : (unitPrice / 100).toFixed(2)}
          placeholder="25.00"
        />
      </div>
    </Field>
  );
}

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

const SIZE_HELP =
  "How much kimchi the jar holds, in ounces — a 16 oz jar takes about a pound, a 300 mL sample jar about 11. Any size works, and one kimchi can have as many sizes as you like. Leave the price at 0 for a size you only ever give away.";

export function AddProduct({ varieties }: { varieties: Variety[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createProduct, {});
  const ref = useRef<HTMLFormElement>(null);

  // Keyed on the whole state object rather than state.ok: every save returns a
  // fresh object, whereas ok stays true from one save to the next and so would
  // never re-fire — leaving the form open with the last values in it.
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Add a jar size
      </button>
    );
  }

  return (
    <form ref={ref} action={formAction} className="card w-full space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What to call it" className="sm:col-span-2">
          <input
            name="name"
            required
            className="field"
            placeholder="Napa cabbage kimchi — 300 mL sample"
            autoFocus
          />
        </Field>
        <VarietyField varieties={varieties} />
        <JarSizeField />
        <PriceField />
      </div>
      <p className="text-xs text-fg-subtle">{SIZE_HELP}</p>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit label="Save jar size" />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A jar reads as one line until you open it.
 *
 * One kimchi can carry several sizes, so the list has to stay scannable on a
 * phone — five edit boxes per jar would bury it.
 */
export function EditProduct({ product, varieties }: { product: Product; varieties: Variety[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(updateProduct, {});

  // See the note in AddProduct: keyed on the object so a second save closes
  // the row too, rather than leaving it open as though nothing happened.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-fg">{product.name}</span>
          <span className="mt-0.5 block text-sm text-fg-muted">
            {formatJarSize(product.jarWeightOz)} · {formatMoney(product.unitPrice)}
            {product.unitPrice === 0 ? " — giveaway" : ""}
            {product.active ? "" : " · hidden from new orders"}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-brand">Edit</span>
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={product.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What to call it" className="sm:col-span-2">
          <input name="name" required className="field" defaultValue={product.name} autoFocus />
        </Field>
        <VarietyField varieties={varieties} varietyId={product.varietyId} />
        <JarSizeField jarWeightOz={product.jarWeightOz} />
        <PriceField unitPrice={product.unitPrice} />
        <Field label="Called a" hint="Shows on orders: jar, tub, bag…">
          <input name="unitLabel" className="field" defaultValue={product.unitLabel} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          name="active"
          defaultChecked={product.active}
          className="h-4 w-4 accent-brand"
        />
        Offer this size on new orders
      </label>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Submit label="Save" />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
