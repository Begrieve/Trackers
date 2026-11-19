"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { updateAllocation, removeAllocation } from "@/actions/allocations";
import {
  ALLOCATION_KINDS,
  ALLOCATION_LABEL,
  type AllocationKindValue,
} from "@/lib/allocations";
import { formatDate, toDateInputValue } from "@/lib/money";
import { formatWeight } from "@/lib/weight";
import type { ActionState } from "@/actions/customers";
import { PersonField, type PersonOption } from "@/components/person-field";

export type AllocationEntry = {
  id: string;
  name: string;
  quantity: number;
  jarWeightOz: number;
  kind: AllocationKindValue;
  note: string | null;
  /** Null until it is actually handed over. */
  wentOutOn: string | null;
  customerId: string | null;
  customerName: string | null;
  batchId: string;
  batchCode: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * One jar that left without money, as a line you can open and correct.
 *
 * These get typed in fast — at the door, at a fair — so the line stays short
 * and the details are there when you come back to them.
 */
export function AllocationEntryRow({
  entry,
  people,
  showBatch = true,
}: {
  entry: AllocationEntry;
  people: PersonOption[];
  showBatch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateAllocation,
    {},
  );

  // Keyed on the whole state object: ok stays true from one save to the next,
  // so keying on it would leave the row open after the second edit.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit ${entry.quantity} × ${entry.name}`}
        >
          <p className="truncate text-sm text-fg">
            <span className="font-semibold tabular-nums">
              {entry.quantity} ×
            </span>{" "}
            {entry.name}
            {entry.customerName ? (
              <span className="font-medium text-fg-muted">
                {" "}
                → {entry.customerName}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {ALLOCATION_LABEL[entry.kind]} ·{" "}
            {formatWeight(entry.quantity * entry.jarWeightOz)} ·{" "}
            {entry.wentOutOn ? (
              formatDate(entry.wentOutOn)
            ) : (
              <span className="font-semibold text-warn-fg">still to hand over</span>
            )}
            {showBatch ? ` · ${entry.batchCode}` : ""}
            {entry.note ? ` · ${entry.note}` : ""}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-surface-2"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="py-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={entry.id} />

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-fg">{entry.name}</p>
          <Link
            href={`/batches/${entry.batchId}`}
            className="text-xs font-semibold text-fg-muted hover:text-fg"
          >
            from {entry.batchCode} →
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALLOCATION_KINDS.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition has-[:checked]:bg-fg has-[:checked]:text-bg has-[:checked]:ring-fg ring-line bg-surface text-fg-muted hover:bg-surface-2"
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                defaultChecked={option.value === entry.kind}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block min-w-0">
            <span className="label">How many</span>
            <input
              name="quantity"
              type="number"
              min={1}
              required
              className="field"
              defaultValue={entry.quantity}
            />
          </label>
          <label className="block min-w-0">
            <span className="label">Day it went</span>
            <input
              name="wentOutOn"
              type="date"
              className="field"
              defaultValue={toDateInputValue(entry.wentOutOn)}
            />
          </label>
        <PersonField
          people={people}
          id={`person-${entry.id}`}
          defaultValue={entry.customerName ?? ""}
          hint="Type a new name and they're added to People."
        />
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            name="pending"
            defaultChecked={entry.wentOutOn === null}
            className="h-4 w-4 accent-brand"
          />
          Still to hand over — keep it on the delivery run
        </label>

        <label className="block">
          <span className="label">What it was for</span>
          <input
            name="note"
            className="field"
            defaultValue={entry.note ?? ""}
            placeholder="Samples for the church fair"
          />
        </label>

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Submit label="Save" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Its own form, since one form cannot sit inside another. */}
      <div className="mt-2 border-t border-line pt-2">
        <RemoveAllocation id={entry.id} label="Delete this entry" />
      </div>
    </div>
  );
}

/** Deleting is its own form so it can't be submitted by the edit form. */
export function RemoveAllocation({
  id,
  label = "Undo",
}: {
  id: string;
  label?: string;
}) {
  return (
    <form action={removeAllocation}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg px-2 py-1 text-xs font-semibold text-fg-subtle hover:bg-danger-soft hover:text-danger"
      >
        {label}
      </button>
    </form>
  );
}
