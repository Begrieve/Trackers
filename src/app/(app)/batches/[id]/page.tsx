import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/scope";
import { formatDate, formatMoney } from "@/lib/money";
import { formatAge } from "@/lib/age";
import { formatWeight, jarsFrom, OZ_PER_LB } from "@/lib/weight";
import { batchTotalCost, batchWeight } from "@/lib/costing";
import { EmptyState, SectionHeading } from "@/components/ui";
import { deleteBatch } from "@/actions/batches";
import { FillOrders, type FillableOrder } from "./fill-orders";
import { AllocateJars, type Allocatable } from "./allocate";
import { type AllocationKindValue } from "@/lib/allocations";
import { AllocationEntryRow } from "@/components/allocation-entry";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;

  const batch = await db.batch.findUnique({
    where: { id },
    include: {
      yields: { orderBy: { name: "asc" } },
      costs: true,
      orderItems: {
        include: { order: { include: { customer: true } } },
        orderBy: { name: "asc" },
      },
      allocations: {
        orderBy: [{ wentOutOn: "desc" }, { createdAt: "desc" }],
        include: { customer: { select: { id: true, name: true } } },
      },
    },
  });

  if (!batch) notFound();

  const madeVarietyIds = batch.yields.map((y) => y.varietyId);

  const [candidates, products, people] = await Promise.all([
    db.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        items: { some: { varietyId: { in: madeVarietyIds } } },
      },
      include: { customer: true, items: true },
      orderBy: [{ status: "asc" }, { orderedAt: "desc" }],
      take: 25,
    }),
    db.product.findMany({
      where: { active: true, varietyId: { in: madeVarietyIds } },
      orderBy: { name: "asc" },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const fillable: FillableOrder[] = candidates.map((order) => {
    const relevant = order.items.filter(
      (i) => i.varietyId && madeVarietyIds.includes(i.varietyId),
    );
    return {
      id: order.id,
      customerName: order.customer.name,
      orderedAt: order.orderedAt,
      jars: relevant.reduce((sum, i) => sum + i.quantity, 0),
      lines: relevant.map((i) => `${i.quantity} × ${i.name}`).join(", "),
      alreadyAssigned: relevant.every((i) => i.batchId === batch.id),
    };
  });

  const totalMade = batchWeight(batch);
  const cost = batchTotalCost(batch);

  const weightOut = batch.orderItems.reduce((sum, i) => sum + i.quantity * i.jarWeightOz, 0);
  const weightAside = batch.allocations.reduce((sum, a) => sum + a.quantity * a.jarWeightOz, 0);

  // What is left of each kimchi this batch made, and the jars it could fill.
  const remainingByVariety = batch.yields.map((y) => {
    const out = batch.orderItems
      .filter((i) => i.varietyId === y.varietyId)
      .reduce((sum, i) => sum + i.quantity * i.jarWeightOz, 0);
    const aside = batch.allocations
      .filter((a) => a.varietyId === y.varietyId)
      .reduce((sum, a) => sum + a.quantity * a.jarWeightOz, 0);
    return { ...y, remainingOz: Math.max(y.weightOz - out - aside, 0) };
  });

  const unaccounted = remainingByVariety.reduce((sum, r) => sum + r.remainingOz, 0);

  // Jars of each size the leftovers could still fill.
  const allocatable: Allocatable[] = products
    .map((product) => {
      const left =
        remainingByVariety.find((r) => r.varietyId === product.varietyId)?.remainingOz ?? 0;
      return {
        productId: product.id,
        name: product.name,
        remaining: jarsFrom(left, product.jarWeightOz),
      };
    })
    .filter((row) => row.remaining > 0);

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
          Made {formatDate(batch.madeOn)} · {formatAge(batch.madeOn)}
          {batch.readyOn ? ` · ready ${formatDate(batch.readyOn)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/batches/${batch.id}/edit`}
          className={batch.yields.length === 0 ? "btn-primary" : "btn-secondary"}
        >
          {batch.yields.length === 0 ? "Record the weight" : "Edit batch"}
        </Link>
      </div>

      {batch.yields.length > 0 ? (
        <AllocateJars batchId={batch.id} rows={allocatable} />
      ) : null}

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-fg">What it made</h2>
        {batch.yields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-warn-line bg-warn-soft/40 p-4 text-sm text-warn-fg">
            <p className="font-semibold">Not weighed yet.</p>
            <p className="mt-1">
              This cook is logged but counts as no stock until you record how much it made.
            </p>
            <Link href={`/batches/${batch.id}/edit`} className="btn-primary mt-3">
              Record the weight
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {remainingByVariety.map((y) => (
                <li key={y.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{y.name}</p>
                    <p className="text-xs text-fg-muted">
                      {formatWeight(y.remainingOz)} left
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-fg">{formatWeight(y.weightOz)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-semibold text-fg-muted">Total made</span>
              <span className="text-lg font-bold tabular-nums text-fg">
                {formatWeight(totalMade)}
              </span>
            </div>
          </>
        )}
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
              {totalMade > 0 ? (
                <span className="ml-2 text-sm font-normal text-fg-muted">
                  {formatMoney(Math.round((cost / totalMade) * OZ_PER_LB))}/lb
                </span>
              ) : null}
            </span>
          </div>
        </section>
      ) : null}

      {batch.yields.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-bold text-fg">Where it went</h2>
          <ul className="divide-y divide-line">
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-fg">Filled into orders</span>
              <span className="font-semibold tabular-nums text-fg">{formatWeight(weightOut)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-fg">Set aside</span>
              <span className="font-semibold tabular-nums text-fg">
                {formatWeight(weightAside)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-fg">Still in this batch</span>
              <span className="font-semibold tabular-nums text-fg">
                {formatWeight(unaccounted)}
              </span>
            </li>
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-fg-muted">
              {unaccounted === 0 && totalMade > 0 ? "Fully accounted for" : "Made"}
            </span>
            <span className="text-lg font-bold tabular-nums text-fg">
              {formatWeight(totalMade)}
            </span>
          </div>
        </section>
      ) : null}

      {batch.allocations.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-bold text-fg">Set aside</h2>
          <div className="divide-y divide-line">
            {batch.allocations.map((a) => (
              <AllocationEntryRow
                key={a.id}
                showBatch={false}
                people={people}
                entry={{
                  id: a.id,
                  name: a.name,
                  quantity: a.quantity,
                  jarWeightOz: a.jarWeightOz,
                  kind: a.kind as AllocationKindValue,
                  note: a.note,
                  wentOutOn: a.wentOutOn.toISOString(),
                  customerId: a.customerId,
                  customerName: a.customer?.name ?? null,
                  batchId: batch.id,
                  batchCode: batch.code,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <FillOrders batchId={batch.id} code={batch.code} orders={fillable} />

      <section>
        <SectionHeading
          title="Who got jars from this batch"
          subtitle={
            weightOut > 0
              ? `${formatWeight(weightOut)} of ${formatWeight(totalMade)} traced to an order`
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
                    {item.quantity} × {item.name} · {formatWeight(item.quantity * item.jarWeightOz)}
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
