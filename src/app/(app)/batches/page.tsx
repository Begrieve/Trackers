import Link from "next/link";
import { prisma } from "@/lib/db";
import { stockByProduct } from "@/lib/stock";
import { formatDate } from "@/lib/money";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { deleteBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const [batches, batchItems, orderItems] = await Promise.all([
    prisma.batch.findMany({
      include: { items: { orderBy: { name: "asc" } } },
      orderBy: [{ madeOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.batchItem.findMany({ select: { productId: true, name: true, quantity: true } }),
    prisma.orderItem.findMany({
      select: { productId: true, name: true, quantity: true, order: { select: { status: true } } },
    }),
  ]);

  const stock = stockByProduct(
    batchItems,
    orderItems.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      status: i.order.status,
    })),
  );

  const totalMade = stock.reduce((sum, r) => sum + r.made, 0);
  const totalSpare = stock.reduce((sum, r) => sum + r.spare, 0);
  const totalShort = stock.reduce((sum, r) => sum + r.short, 0);
  const totalCommitted = stock.reduce((sum, r) => sum + r.committed, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Batches</h1>
          <p className="text-sm text-fg-muted">What you made, against what you owe.</p>
        </div>
        <Link href="/batches/new" className="btn-primary">
          + Record batch
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jars made" value={String(totalMade)} hint="Across every batch" />
        <StatCard
          label="Promised"
          value={String(totalCommitted)}
          hint="On orders not yet delivered"
          tone="violet"
        />
        <StatCard label="Spare" value={String(totalSpare)} hint="Made, unclaimed" tone="emerald" />
        <StatCard
          label="Short"
          value={String(totalShort)}
          hint={totalShort > 0 ? "Need to make these" : "Everything is covered"}
          tone={totalShort > 0 ? "rose" : "neutral"}
        />
      </section>

      <section>
        <SectionHeading title="Where each product stands" subtitle="Made, minus delivered and promised" />
        {stock.length === 0 ? (
          <EmptyState>Record a batch or two and this fills in.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {stock.map((row) => (
              <div key={row.productId} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{row.name}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    {row.made} made · {row.delivered} delivered · {row.committed} promised
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {row.short > 0 ? (
                    <p className="font-bold tabular-nums text-danger">{row.short} short</p>
                  ) : (
                    <p className="font-bold tabular-nums text-success">{row.spare} spare</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Every batch" />
        {batches.length === 0 ? (
          <EmptyState>
            No batches yet.{" "}
            <Link href="/batches/new" className="font-semibold text-danger underline">
              Record your first
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => {
              const jars = batch.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <div key={batch.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{batch.label}</p>
                      <p className="mt-0.5 text-sm text-fg-muted">
                        Made {formatDate(batch.madeOn)}
                        {batch.readyOn ? ` · ready ${formatDate(batch.readyOn)}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-fg">
                      {jars} {jars === 1 ? "jar" : "jars"}
                    </p>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {batch.items.map((item) => (
                      <li key={item.id} className="pill bg-surface-2 text-fg-muted ring-line">
                        {item.quantity} × {item.name}
                      </li>
                    ))}
                  </ul>

                  {batch.notes ? (
                    <p className="mt-3 text-sm text-fg-muted">{batch.notes}</p>
                  ) : null}

                  <form action={deleteBatch} className="mt-3">
                    <input type="hidden" name="id" value={batch.id} />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-fg-subtle hover:text-danger"
                    >
                      Delete batch
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
