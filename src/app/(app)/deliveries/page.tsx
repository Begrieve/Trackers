import Link from "next/link";
import { getDb } from "@/lib/scope";
import { getOrders } from "@/lib/queries";
import { buildRun } from "@/lib/deliveries";
import { stockByVariety } from "@/lib/stock";
import { formatWeight } from "@/lib/weight";
import { formatDate, formatMoney } from "@/lib/money";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { setOrderStatus } from "@/actions/orders";
import { markHandedOver } from "@/actions/allocations";
import { ALLOCATION_LABEL, type AllocationKindValue } from "@/lib/allocations";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const db = await getDb();
  const [orders, yields, allocations] = await Promise.all([
    getOrders(),
    db.batchYield.findMany({ select: { varietyId: true, name: true, weightOz: true } }),
    db.batchAllocation.findMany({
      select: {
        id: true,
        varietyId: true,
        name: true,
        quantity: true,
        jarWeightOz: true,
        kind: true,
        note: true,
        wentOutOn: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        batch: { select: { code: true } },
      },
    }),
  ]);

  // Samples and gifts that are spoken for but still here. They are off the
  // shelf already, so the run only has to say they need carrying.
  const toHandOver = allocations
    .filter((a) => a.wentOutOn === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const handOverJars = toHandOver.reduce((sum, a) => sum + a.quantity, 0);

  const stock = stockByVariety(
    yields,
    orders.flatMap((order) =>
      order.items
        .filter((i) => i.varietyId)
        .map((i) => ({
          varietyId: i.varietyId!,
          name: i.name,
          quantity: i.quantity,
          jarWeightOz: i.jarWeightOz ?? 16,
          batchId: i.batchId,
          status: order.status,
        })),
    ),
    allocations
      .filter((a) => a.varietyId)
      .map((a) => ({
        varietyId: a.varietyId!,
        name: a.name,
        quantity: a.quantity,
        jarWeightOz: a.jarWeightOz,
      })),
  );

  const spare = new Map(stock.map((row) => [row.varietyId, row.spare]));
  const run = buildRun(orders, spare);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Delivery run</h1>
        <p className="text-sm text-fg-muted">
          What can go out now, who is still waiting, and what the next cook needs.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stops" value={String(run.stops)} hint="Orders ready to hand over" />
        <StatCard
          label="Jars"
          value={String(run.jars + handOverJars)}
          hint={handOverJars > 0 ? `${handOverJars} of them given, not sold` : "On this run"}
        />
        <StatCard
          label="To hand over"
          value={String(handOverJars)}
          hint="Samples and gifts"
          tone={handOverJars > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="To collect"
          value={formatMoney(run.collect)}
          hint="Cash at the door"
          tone={run.collect > 0 ? "emerald" : "neutral"}
        />
      </section>

      <section className="print-block">
        <SectionHeading
          title="Ready to go"
          subtitle={run.stops > 0 ? "Longest wait first" : undefined}
        />
        {run.ready.length === 0 ? (
          <EmptyState>
            Nothing is set aside yet. Record a batch, then attach it to the orders it fills —
            those orders show up here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {run.ready.map((stop) => (
              <li key={stop.orderId} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${stop.orderId}`}
                      className="font-semibold text-fg hover:underline"
                    >
                      {stop.customerName}
                    </Link>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      Ordered {formatDate(stop.orderedAt)}
                      {stop.phone ? (
                        <>
                          {" · "}
                          <a href={`tel:${stop.phone}`} className="font-medium text-brand hover:underline">
                            {stop.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {stop.prepaid ? (
                      <p className="font-bold text-success">Prepaid</p>
                    ) : (
                      <p className="text-lg font-bold tabular-nums text-fg">
                        {formatMoney(stop.collect)}
                      </p>
                    )}
                    <p className="text-xs text-fg-muted">
                      {stop.prepaid ? "collect nothing" : "collect on delivery"}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {stop.items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-fg">
                        <span className="font-semibold tabular-nums">{item.quantity} ×</span>{" "}
                        {item.name}
                      </span>
                      {item.batchCode ? (
                        <span className="pill shrink-0 bg-surface-2 font-mono text-[11px] text-fg-muted ring-line">
                          {item.batchCode}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <form action={setOrderStatus} className="no-print mt-3 border-t border-line pt-3">
                  <input type="hidden" name="id" value={stop.orderId} />
                  <input type="hidden" name="status" value="DELIVERED" />
                  <button type="submit" className="btn-secondary w-full sm:w-auto">
                    Mark delivered
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toHandOver.length > 0 ? (
        <section className="print-block">
          <SectionHeading
            title="Samples and gifts to hand over"
            subtitle={`${handOverJars} ${handOverJars === 1 ? "jar" : "jars"} already set aside, no money to collect`}
            action={
              <Link href="/set-aside" className="no-print text-sm font-semibold text-brand hover:underline">
                Edit →
              </Link>
            }
          />
          <ul className="space-y-3">
            {toHandOver.map((a) => (
              <li key={a.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">
                      {a.customer ? (
                        <Link href={`/customers/${a.customer.id}`} className="hover:underline">
                          {a.customer.name}
                        </Link>
                      ) : (
                        <span className="text-fg-muted">No name on it yet</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {ALLOCATION_LABEL[a.kind as AllocationKindValue]}
                      {a.note ? ` · ${a.note}` : ""}
                      {a.customer?.phone ? (
                        <>
                          {" · "}
                          <a
                            href={`tel:${a.customer.phone}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {a.customer.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-success">Free</p>
                    <p className="text-xs text-fg-muted">collect nothing</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  <li className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-fg">
                      <span className="font-semibold tabular-nums">{a.quantity} ×</span> {a.name}
                    </span>
                    <span className="pill shrink-0 bg-surface-2 font-mono text-[11px] text-fg-muted ring-line">
                      {a.batch.code}
                    </span>
                  </li>
                </ul>

                <form action={markHandedOver} className="no-print mt-3 border-t border-line pt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="btn-secondary w-full sm:w-auto">
                    Mark handed over
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="print-block">
        <SectionHeading
          title="Samples and gifts to hand over"
          subtitle={
            toHandOver.length > 0
              ? `${handOverJars} ${handOverJars === 1 ? "jar" : "jars"} already set aside, no money to collect`
              : "Jars promised to someone but not yet handed over"
          }
          action={
            <Link href="/set-aside" className="no-print text-sm font-semibold text-brand hover:underline">
              {toHandOver.length > 0 ? "Edit →" : "Out without money →"}
            </Link>
          }
        />
        {toHandOver.length === 0 ? (
          <EmptyState>
            Nothing waiting. A sample lands here when you tick{" "}
            <strong className="font-semibold text-fg">
              I still have to hand these over
            </strong>{" "}
            while recording it — on the dashboard, or on a batch. Already recorded it as
            gone?{" "}
            <Link href="/set-aside" className="font-semibold text-danger underline">
              Open it on Out without money
            </Link>{" "}
            and tick the same box.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {toHandOver.map((a) => (
              <li key={a.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">
                      {a.customer ? (
                        <Link href={`/customers/${a.customer.id}`} className="hover:underline">
                          {a.customer.name}
                        </Link>
                      ) : (
                        <span className="text-fg-muted">No name on it yet</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {ALLOCATION_LABEL[a.kind as AllocationKindValue]}
                      {a.note ? ` · ${a.note}` : ""}
                      {a.customer?.phone ? (
                        <>
                          {" · "}
                          <a
                            href={`tel:${a.customer.phone}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {a.customer.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-success">Free</p>
                    <p className="text-xs text-fg-muted">collect nothing</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  <li className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-fg">
                      <span className="font-semibold tabular-nums">{a.quantity} ×</span> {a.name}
                    </span>
                    <span className="pill shrink-0 bg-surface-2 font-mono text-[11px] text-fg-muted ring-line">
                      {a.batch.code}
                    </span>
                  </li>
                </ul>

                <form action={markHandedOver} className="no-print mt-3 border-t border-line pt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="btn-secondary w-full sm:w-auto">
                    Mark handed over
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="print-block">
        <SectionHeading
          title="Waiting on a cook"
          subtitle="Ordered, but no jars set aside for them yet"
        />
        {run.waiting.length === 0 ? (
          <EmptyState>Everyone with an open order has their jars set aside.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {run.waiting.map((stop) => (
              <Link
                key={stop.orderId}
                href={`/orders/${stop.orderId}`}
                className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{stop.customerName}</p>
                  <p className="mt-0.5 truncate text-sm text-fg-muted">
                    {stop.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-fg-muted">
                  since {formatDate(stop.orderedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="print-block">
        <SectionHeading
          title="Make next"
          subtitle={
            run.toMakeWeightOz > 0
              ? `${formatWeight(run.toMakeWeightOz)} to cover open orders`
              : undefined
          }
        />
        {run.toMake.length === 0 ? (
          <EmptyState>Nothing outstanding — every open order is covered by jars you have.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {run.toMake.map((row) => (
              <div key={row.varietyId} className="flex items-center justify-between gap-3 p-4">
                <p className="min-w-0 truncate font-semibold text-fg">{row.name}</p>
                <p className="shrink-0 text-lg font-bold tabular-nums text-brand">
                  {formatWeight(row.weightOz)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-surface-2/60 p-4">
              <span className="text-sm font-semibold text-fg-muted">Total to make</span>
              <span className="text-lg font-bold tabular-nums text-fg">
                {formatWeight(run.toMakeWeightOz)}
              </span>
            </div>
          </div>
        )}
        {run.toMake.length > 0 ? (
          <p className="no-print mt-3 text-sm text-fg-muted">
            Cooked these?{" "}
            <Link href="/batches/new" className="font-semibold text-brand hover:underline">
              Record the batch
            </Link>{" "}
            and attach it to the orders it fills.
          </p>
        ) : null}
      </section>
    </div>
  );
}
