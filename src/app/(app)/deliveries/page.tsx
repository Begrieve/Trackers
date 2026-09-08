import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrders } from "@/lib/queries";
import { buildRun } from "@/lib/deliveries";
import { stockByProduct } from "@/lib/stock";
import { formatDate, formatMoney } from "@/lib/money";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { setOrderStatus } from "@/actions/orders";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const [orders, batchItems] = await Promise.all([
    getOrders(),
    prisma.batchItem.findMany({ select: { productId: true, name: true, quantity: true } }),
  ]);

  const stock = stockByProduct(
    batchItems,
    orders.flatMap((order) =>
      order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        batchId: i.batchId,
        status: order.status,
      })),
    ),
  );

  const spare = new Map(stock.map((row) => [row.productId, row.spare]));
  const run = buildRun(orders, spare);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Delivery run</h1>
        <p className="text-sm text-fg-muted">
          What can go out now, who is still waiting, and what the next cook needs.
        </p>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Stops" value={String(run.stops)} hint="Ready to hand over" />
        <StatCard label="Jars" value={String(run.jars)} hint="On this run" />
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
            run.toMakeJars > 0
              ? `${run.toMakeJars} ${run.toMakeJars === 1 ? "jar" : "jars"} to cover open orders`
              : undefined
          }
        />
        {run.toMake.length === 0 ? (
          <EmptyState>Nothing outstanding — every open order is covered by jars you have.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {run.toMake.map((row) => (
              <div key={row.productId} className="flex items-center justify-between gap-3 p-4">
                <p className="min-w-0 truncate font-semibold text-fg">{row.name}</p>
                <p className="shrink-0 text-lg font-bold tabular-nums text-brand">{row.quantity}</p>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-surface-2/60 p-4">
              <span className="text-sm font-semibold text-fg-muted">Total jars to make</span>
              <span className="text-lg font-bold tabular-nums text-fg">{run.toMakeJars}</span>
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
