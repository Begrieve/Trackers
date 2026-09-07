import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/money";
import { batchJars, batchTotalCost } from "@/lib/costing";
import { EmptyState, SectionHeading } from "@/components/ui";
import { deleteBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      items: { orderBy: { name: "asc" } },
      costs: true,
      orderItems: {
        include: { order: { include: { customer: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!batch) notFound();

  const jars = batchJars(batch);
  const cost = batchTotalCost(batch);
  const jarsOut = batch.orderItems.reduce((sum, i) => sum + i.quantity, 0);

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
        <Link href={`/batches/${batch.id}/edit`} className="btn-secondary">
          Edit batch
        </Link>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-fg">What it made</h2>
        <ul className="divide-y divide-line">
          {batch.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <p className="truncate text-sm font-medium text-fg">{item.name}</p>
              <p className="font-semibold tabular-nums text-fg">{item.quantity}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-fg-muted">Total jars</span>
          <span className="text-lg font-bold tabular-nums text-fg">{jars}</span>
        </div>
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
