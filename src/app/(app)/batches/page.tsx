import Link from "next/link";
import { prisma } from "@/lib/db";
import { stockByProduct } from "@/lib/stock";
import { formatDate, formatMoney } from "@/lib/money";
import { batchJars, batchTotalCost, unitCosts } from "@/lib/costing";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const [batches, batchItems, orderItems] = await Promise.all([
    prisma.batch.findMany({
      include: { items: { orderBy: { name: "asc" } }, costs: true },
      orderBy: [{ madeOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.batchItem.findMany({ select: { productId: true, name: true, quantity: true } }),
    prisma.orderItem.findMany({
      select: {
        productId: true,
        name: true,
        quantity: true,
        batchId: true,
        order: { select: { status: true } },
      },
    }),
  ]);

  const stock = stockByProduct(
    batchItems,
    orderItems.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      batchId: i.batchId,
      status: i.order.status,
    })),
  );

  const costPerJar = unitCosts(
    batches.map((b) => ({
      items: b.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      costs: b.costs,
    })),
  );
  const totalSpend = batches.reduce((sum, b) => sum + batchTotalCost(b), 0);

  const totalMade = stock.reduce((sum, r) => sum + r.made, 0);
  const totalSpare = stock.reduce((sum, r) => sum + r.spare, 0);
  const totalShort = stock.reduce((sum, r) => sum + r.short, 0);
  const totalCommitted = stock.reduce((sum, r) => sum + r.committed, 0);
  const totalUntracked = stock.reduce((sum, r) => sum + r.untracked, 0);
  const awaitingYield = batches.filter((b) => b.items.length === 0);

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
        <StatCard
          label="Jars made"
          value={String(totalMade)}
          hint={totalSpend > 0 ? `${formatMoney(totalSpend)} spent making them` : "Across every batch"}
        />
        <StatCard
          label="Promised"
          value={String(totalCommitted)}
          hint="On orders not yet delivered"
          tone="violet"
        />
        <StatCard label="Spare" value={String(totalSpare)} hint="On hand, unclaimed" tone="emerald" />
        <StatCard
          label="Short"
          value={String(totalShort)}
          hint={totalShort > 0 ? "Still to make for open orders" : "Every open order is covered"}
          tone={totalShort > 0 ? "rose" : "neutral"}
        />
      </section>

      {awaitingYield.length > 0 ? (
        <p className="card border-warn-line bg-warn-soft/50 p-4 text-sm text-warn-fg">
          {awaitingYield.length} {awaitingYield.length === 1 ? "batch has" : "batches have"} no
          yield recorded yet, so {awaitingYield.length === 1 ? "it does" : "they do"} not count as
          stock.{" "}
          {awaitingYield.map((b, i) => (
            <span key={b.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/batches/${b.id}/edit`} className="font-semibold underline">
                {b.code}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}

      {totalUntracked > 0 ? (
        <p className="card border-warn-line bg-warn-soft/50 p-4 text-sm text-warn-fg">
          {totalUntracked} {totalUntracked === 1 ? "jar has" : "jars have"} been delivered from
          stock with no batch behind{" "}
          {totalUntracked === 1 ? "it" : "them"} — cooks from before you started recording
          batches. They are not counted as short, because they have already been handed over. To
          account for them, record a batch dated when you made them.
        </p>
      ) : null}

      <section>
        <SectionHeading title="Where each product stands" subtitle="On hand is what you made and still hold" />
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
                  {row.untracked > 0 ? (
                    <p className="mt-0.5 text-sm text-warn">
                      {row.untracked} delivered with no batch recorded
                    </p>
                  ) : null}
                  {(costPerJar.get(row.productId)?.perJar ?? 0) > 0 ? (
                    <p className="mt-0.5 text-sm text-fg-subtle">
                      {formatMoney(costPerJar.get(row.productId)!.perJar)} per jar to make
                    </p>
                  ) : null}
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
              const jars = batchJars(batch);
              return (
                <div key={batch.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/batches/${batch.id}`}
                        className="flex flex-wrap items-center gap-2 font-semibold text-fg hover:underline"
                      >
                        {batch.label}
                        <span className="pill bg-surface-2 font-mono text-xs text-fg-muted ring-line">
                          {batch.code}
                        </span>
                      </Link>
                      <p className="mt-0.5 text-sm text-fg-muted">
                        Made {formatDate(batch.madeOn)}
                        {batch.readyOn ? ` · ready ${formatDate(batch.readyOn)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {batch.items.length === 0 ? (
                        <p className="font-semibold text-warn">Yield not recorded</p>
                      ) : (
                        <p className="font-bold tabular-nums text-fg">
                          {jars} {jars === 1 ? "jar" : "jars"}
                        </p>
                      )}
                      {batchTotalCost(batch) > 0 ? (
                        <p className="text-sm tabular-nums text-fg-muted">
                          {formatMoney(batchTotalCost(batch))}
                          {jars > 0 ? ` · ${formatMoney(Math.round(batchTotalCost(batch) / jars))}/jar` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {batch.items.map((item) => (
                      <li key={item.id} className="pill bg-surface-2 text-fg-muted ring-line">
                        {item.quantity} × {item.name}
                      </li>
                    ))}
                  </ul>

                  {batch.costs.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {batch.costs.map((cost) => (
                        <li key={cost.id} className="text-xs text-fg-subtle">
                          {cost.label} {formatMoney(cost.amount)}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {batch.notes ? (
                    <p className="mt-3 text-sm text-fg-muted">{batch.notes}</p>
                  ) : null}

                  <div className="mt-3 flex gap-4">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="text-xs font-semibold text-fg-muted hover:text-fg"
                    >
                      Who got it
                    </Link>
                    <Link
                      href={`/batches/${batch.id}/edit`}
                      className="text-xs font-semibold text-fg-muted hover:text-fg"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
