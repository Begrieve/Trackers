import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/scope";
import { formatDate, formatMoney } from "@/lib/money";
import { batchJars, batchTotalCost } from "@/lib/costing";
import { EmptyState, SectionHeading } from "@/components/ui";
import { deleteBatch } from "@/actions/batches";
import { FillOrders, type FillableOrder } from "./fill-orders";
import { AllocateJars, type Allocatable } from "./allocate";
import { removeAllocation } from "@/actions/allocations";
import { ALLOCATION_LABEL } from "@/lib/allocations";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;

  const batch = await db.batch.findUnique({
    where: { id },
    include: {
      items: { orderBy: { name: "asc" } },
      costs: true,
      orderItems: {
        include: { order: { include: { customer: true } } },
        orderBy: { name: "asc" },
      },
      allocations: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!batch) notFound();

  const madeProductIds = batch.items.map((i) => i.productId);

  // Orders that could plausibly have come from this batch: open, or delivered
  // recently, and containing at least one product the batch actually made.
  const candidates = await db.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      items: { some: { productId: { in: madeProductIds } } },
    },
    include: { customer: true, items: true },
    orderBy: [{ status: "asc" }, { orderedAt: "desc" }],
    take: 25,
  });

  const fillable: FillableOrder[] = candidates.map((order) => {
    const relevant = order.items.filter((i) => madeProductIds.includes(i.productId));
    return {
      id: order.id,
      customerName: order.customer.name,
      orderedAt: order.orderedAt,
      jars: relevant.reduce((sum, i) => sum + i.quantity, 0),
      lines: relevant.map((i) => `${i.quantity} × ${i.name}`).join(", "),
      alreadyAssigned: relevant.every((i) => i.batchId === batch.id),
    };
  });

  const jars = batchJars(batch);
  const cost = batchTotalCost(batch);
  const jarsOut = batch.orderItems.reduce((sum, i) => sum + i.quantity, 0);
  const setAside = batch.allocations.reduce((sum, a) => sum + a.quantity, 0);

  // What this batch still holds, per product: made, less what orders took and
  // what was set aside. That is the ceiling on anything further set aside.
  const allocatable: Allocatable[] = batch.items.map((item) => {
    const toOrders = batch.orderItems
      .filter((o) => o.productId === item.productId)
      .reduce((sum, o) => sum + o.quantity, 0);
    const aside = batch.allocations
      .filter((a) => a.productId === item.productId)
      .reduce((sum, a) => sum + a.quantity, 0);
    return {
      productId: item.productId,
      name: item.name,
      remaining: Math.max(item.quantity - toOrders - aside, 0),
    };
  });

  const unaccounted = allocatable.reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/batches" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← Batches
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-fg">{batch.label}</h1>
          <span className="pill bg-surface-2 font-mono text-fg-muted ring-line">{batch.code}</span>
        </div>
        <p className="mt-1 text-sm text-fg-muted">
          Made {formatDate(batch.madeOn)}
          {batch.readyOn ? ` · ready ${formatDate(batch.readyOn)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/batches/${batch.id}/edit`}
          className={batch.items.length === 0 ? "btn-primary" : "btn-secondary"}
        >
          {batch.items.length === 0 ? "Record the yield" : "Edit batch"}
        </Link>
      </div>

      {batch.items.length > 0 ? (
        <AllocateJars batchId={batch.id} rows={allocatable} />
      ) : null}

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-fg">Where the jars went</h2>
        <ul className="divide-y divide-line">
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-fg">To orders</span>
            <span className="font-semibold tabular-nums text-fg">{jarsOut}</span>
          </li>
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-fg">Set aside</span>
            <span className="font-semibold tabular-nums text-fg">{setAside}</span>
          </li>
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-fg">Still in this batch</span>
            <span className="font-semibold tabular-nums text-fg">{unaccounted}</span>
          </li>
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-fg-muted">
            {unaccounted === 0 && jars > 0 ? "Fully accounted for" : "Made"}
          </span>
          <span className="text-lg font-bold tabular-nums text-fg">{jars}</span>
        </div>
      </section>

      {batch.allocations.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-bold text-fg">Set aside</h2>
          <ul className="divide-y divide-line">
            {batch.allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">
                    <span className="font-semibold tabular-nums">{a.quantity} ×</span> {a.name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {ALLOCATION_LABEL[a.kind]}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
                <form action={removeAllocation} className="shrink-0">
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    Undo
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-fg">What it made</h2>
        {batch.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-warn-line bg-warn-soft/40 p-4 text-sm text-warn-fg">
            <p className="font-semibold">Yield not recorded yet.</p>
            <p className="mt-1">
              This cook is logged but not counted as stock until you enter how many jars came out
              of it.
            </p>
            <Link href={`/batches/${batch.id}/edit`} className="btn-primary mt-3">
              Record the yield
            </Link>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {batch.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <p className="truncate text-sm font-medium text-fg">{item.name}</p>
              <p className="font-semibold tabular-nums text-fg">{item.quantity}</p>
            </li>
          ))}
        </ul>
        {batch.items.length > 0 ? (
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-fg-muted">Total jars</span>
            <span className="text-lg font-bold tabular-nums text-fg">{jars}</span>
          </div>
        ) : null}
      </section>

      {batch.costs.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-bold text-fg">What it cost</h2>
          <ul className="divide-y divide-line">
            {batch.costs.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <p className="truncate text-sm text-fg">{row.label}</p>
                <p className="tabular-nums text-fg">{formatMoney(row.amount)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-fg-muted">Total</span>
            <span className="text-lg font-bold tabular-nums text-fg">
              {formatMoney(cost)}
              {jars > 0 ? (
                <span className="ml-2 text-sm font-normal text-fg-muted">
                  {formatMoney(Math.round(cost / jars))}/jar
                </span>
              ) : null}
            </span>
          </div>
        </section>
      ) : null}

      <FillOrders batchId={batch.id} code={batch.code} orders={fillable} />

      <section>
        <SectionHeading
          title="Who got jars from this batch"
          subtitle={
            jarsOut > 0
              ? `${jarsOut} of ${jars} jars traced to an order`
              : "Assign this batch on an order to trace it"
          }
        />
        {batch.orderItems.length === 0 ? (
          <EmptyState>
            No orders point at this batch yet. Open an order and pick {batch.code} beside a line to
            record which cook it came from.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {batch.orderItems.map((item) => (
              <Link
                key={item.id}
                href={`/orders/${item.orderId}`}
                className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{item.order.customer.name}</p>
                  <p className="mt-0.5 truncate text-sm text-fg-muted">
                    {item.quantity} × {item.name} · ordered {formatDate(item.order.orderedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-fg-muted">View →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {batch.notes ? (
        <section className="card p-4">
          <h2 className="mb-2 font-bold text-fg">Notes</h2>
          <p className="text-sm whitespace-pre-wrap text-fg-muted">{batch.notes}</p>
        </section>
      ) : null}

      <form action={deleteBatch} className="pt-2">
        <input type="hidden" name="id" value={batch.id} />
        <button type="submit" className="text-sm font-semibold text-fg-subtle hover:text-danger">
          Delete this batch
        </button>
      </form>
    </div>
  );
}
