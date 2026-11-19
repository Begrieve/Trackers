"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import type { ActionState } from "@/actions/customers";
import { formatMoney, toDateInputValue } from "@/lib/money";
import { formatWeight, OZ_PER_LB, parseWeight } from "@/lib/weight";

type Variety = { id: string; name: string };

export type BatchInitial = {
  id: string;
  label: string;
  madeOn: Date;
  readyOn: Date | null;
  notes: string | null;
  yields: { varietyId: string; weightOz: number }[];
  costs: { label: string; amount: number }[];
};

const COST_ROWS = ["Ingredients", "Jars & packaging", "Other"];

function toCents(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Puts a saved weight back in its box so it reads the way it was meant.
 * Whole pounds show as a bare number, since that is what the box expects;
 * anything else keeps its units ("11 oz", "2 lb 4 oz") rather than becoming
 * a fraction like 0.6875, and parses back to the very same ounces.
 */
function weightBoxValue(oz: number) {
  return oz % OZ_PER_LB === 0 ? String(oz / OZ_PER_LB) : formatWeight(oz);
}

/** Reads a weight box the same way the server will, so the running total
 *  below always agrees with what gets saved. */
function toOunces(value: string) {
  if (!value.trim()) return 0;
  try {
    return parseWeight(value);
  } catch {
    return 0;
  }
}

/**
 * What sits beside a weight box: "lb", because a bare number is pounds — or,
 * once a unit is typed, the weight as it will be recorded. A small sample
 * cook is easier to enter as "11 oz" than as a fraction of a pound.
 */
function WeightUnit({ value }: { value: string }) {
  const text = value.trim();
  const plain = text === "" || /^\d+(?:\.\d+)?$/.test(text);
  const oz = plain ? 0 : toOunces(text);

  if (plain) return <span className="w-24 text-sm text-fg-muted">lb</span>;
  if (oz > 0) return <span className="w-24 text-sm font-medium text-fg-muted">{formatWeight(oz)}</span>;
  return (
    <span className="w-24 text-sm font-semibold text-danger" role="status">
      can&apos;t read
    </span>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function BatchForm({
  varieties,
  action,
  defaultMadeOn,
  initial,
  submitLabel = "Save batch",
  cancelHref = "/batches",
}: {
  varieties: Variety[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Today, formatted on the server: computing it here would differ between
   *  server and client near midnight and break hydration. */
  defaultMadeOn: string;
  initial?: BatchInitial;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.yields ?? []).map((y) => [y.varietyId, weightBoxValue(y.weightOz)])),
  );

  const initialCostRows = initial
    ? [
        ...initial.costs.map((c) => ({ label: c.label, value: (c.amount / 100).toFixed(2) })),
        ...COST_ROWS.slice(0, 2).map((label) => ({ label, value: "" })),
      ]
    : COST_ROWS.map((label) => ({ label, value: "" }));

  const [costs, setCosts] = useState<string[]>(() => initialCostRows.map((r) => r.value));

  const totalOz = useMemo(
    () => Object.values(weights).reduce((sum, w) => sum + toOunces(w), 0),
    [weights],
  );
  const totalCost = useMemo(() => costs.reduce((sum, c) => sum + toCents(c), 0), [costs]);
  const perLb = totalOz > 0 ? Math.round((totalCost / totalOz) * OZ_PER_LB) : 0;

  return (
    <form action={formAction} className="space-y-6">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <p className="text-sm text-fg-muted">
        {initial
          ? "Everything here can be changed as often as you like. The batch keeps its code, so anything already traced to it stays traced."
          : "Nothing here is final — you can come back and change the details, costs and weights on this batch at any time."}
      </p>

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
            defaultValue={initial?.label ?? ""}
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
              defaultValue={initial ? toDateInputValue(initial.madeOn) : defaultMadeOn}
            />
          </div>
          <div>
            <label className="label" htmlFor="readyOn">
              Ready on (optional)
            </label>
            <input
              id="readyOn"
              name="readyOn"
              type="date"
              className="field"
              defaultValue={initial?.readyOn ? toDateInputValue(initial.readyOn) : ""}
            />
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
            defaultValue={initial?.notes ?? ""}
            placeholder="Salt ratio, cabbage source, how it tasted…"
          />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-bold text-fg">What did it cost to make?</h2>
        <p className="mb-3 text-sm text-fg-muted">
          Optional, but it&apos;s what turns Reports into profit rather than takings.
        </p>

        <ul className="space-y-2">
          {initialCostRows.map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex gap-2">
              <input name="costLabel" defaultValue={row.label} className="field min-w-0 flex-1" />
              <input
                name="costAmount"
                inputMode="decimal"
                placeholder="0.00"
                aria-label={`Cost ${index + 1} amount`}
                value={costs[index]}
                onChange={(e) =>
                  setCosts((prev) => prev.map((c, i) => (i === index ? e.target.value : c)))
                }
                className="field w-28"
              />
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-fg-muted">Batch cost</span>
          <span className="text-xl font-bold tabular-nums text-fg">{formatMoney(totalCost)}</span>
        </div>

        {totalCost > 0 && totalOz > 0 ? (
          <p className="mt-1 text-right text-sm text-fg-muted">
            {formatMoney(perLb)} per pound across {formatWeight(totalOz)}
          </p>
        ) : null}
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-bold text-fg">How much did it make?</h2>
        <p className="mb-3 text-sm text-fg-muted">
          Weigh each kimchi in pounds — or type the unit yourself for a small cook, like{" "}
          <span className="font-semibold text-fg">11 oz</span> or{" "}
          <span className="font-semibold text-fg">2 lb 4 oz</span>. Leave them blank if it
          isn&apos;t weighed yet — the batch saves either way. Jars are filled from this weight
          when you assign orders.
        </p>

        {varieties.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No kimchi types yet —{" "}
            <Link href="/products" className="font-semibold text-danger underline">
              add a jar first
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {varieties.map((variety) => (
              <li key={variety.id} className="flex items-center gap-3 py-3">
                <label
                  className="min-w-0 flex-1 text-sm font-medium text-fg"
                  htmlFor={`w-${variety.id}`}
                >
                  {variety.name}
                </label>
                <input type="hidden" name="varietyId" value={variety.id} />
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    id={`w-${variety.id}`}
                    name="weight"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Weight of ${variety.name}, in pounds unless you give a unit`}
                    value={weights[variety.id] ?? ""}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [variety.id]: e.target.value }))
                    }
                    className="h-10 w-24 rounded-lg border border-line-strong bg-surface text-center text-sm tabular-nums text-fg"
                  />
                  <WeightUnit value={weights[variety.id] ?? ""} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-fg-muted">Made in this batch</span>
          <span className="text-xl font-bold tabular-nums text-fg">{formatWeight(totalOz)}</span>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Submit label={submitLabel} />
        <Link href={cancelHref} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
