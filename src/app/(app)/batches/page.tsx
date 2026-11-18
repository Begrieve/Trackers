import Link from "next/link";
import { getDb } from "@/lib/scope";
import { stockByVariety } from "@/lib/stock";
import { shelfByVariety } from "@/lib/shelf";
import { formatDate, formatMoney } from "@/lib/money";
import { formatAge, shortAge } from "@/lib/age";
import { formatWeight, jarsFrom, OZ_PER_LB } from "@/lib/weight";
import { batchTotalCost, batchWeight, unitCosts } from "@/lib/costing";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { SetAsideJars } from "@/components/set-aside-jars";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const db = await getDb();

  const [batches, orderItems, allocations, products] = await Promise.all([
    db.batch.findMany({
      include: {
        yields: { orderBy: { name: "asc" } },
        costs: true,
        allocations: true,
        orderItems: { select: { varietyId: true, quantity: true, jarWeightOz: true } },
      },
      orderBy: [{ madeOn: "desc" }, { createdAt: "desc" }],
    }),
    db.orderItem.findMany({
      select: {
        varietyId: true,
        name: true,
        quantity: true,
        jarWeightOz: true,
        batchId: true,
        order: { select: { status: true } },
      },
    }),
    db.batchAllocation.findMany({
      select: { varietyId: true, name: true, quantity: true, jarWeightOz: true },
    }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const stock = stockByVariety(
    batches.flatMap((b) => b.yields),
    orderItems
      .filter((i) => i.varietyId)
      .map((i) => ({
        varietyId: i.varietyId!,
        name: i.name,
        quantity: i.quantity,
        jarWeightOz: i.jarWeightOz,
        batchId: i.batchId,
        status: i.order.status,
      })),
    allocations
      .filter((a) => a.varietyId)
      .map((a) => ({
        varietyId: a.varietyId!,
        name: a.name,
        quantity: a.quantity,
        jarWeightOz: a.jarWeightOz,
      })),
  );

  const costPerOz = unitCosts(batches);
  const shelf = new Map(shelfByVariety(batches).map((row) => [row.varietyId, row]));

  const totalSpend = batches.reduce((sum, b) => sum + batchTotalCost(b), 0);
  const totalMade = stock.reduce((sum, r) => sum + r.made, 0);
  const totalSpare = stock.reduce((sum, r) => sum + r.spare, 0);
  const totalShort = stock.reduce((sum, r) => sum + r.short, 0);
  const totalCommitted = stock.reduce((sum, r) => sum + r.committed, 0);
  const totalUntracked = stock.reduce((sum, r) => sum + r.untracked, 0);
  const totalAllocated = stock.reduce((sum, r) => sum + r.allocated, 0);

  const awaitingWeight = batches.filter((b) => b.yields.length === 0);

  // Jars the spare weight of each kimchi could fill, per jar size.
  const jarsFromSpare = (varietyId: string) =>
    products
      .filter((p) => p.varietyId === varietyId)
      .map((p) => ({
        name: p.name,
        jars: jarsFrom(stock.find((s) => s.varietyId === varietyId)?.spare ?? 0, p.jarWeightOz),
      }))
      .filter((row) => row.jars > 0);

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
          label="Made"
          value={formatWeight(totalMade)}
          hint={totalSpend > 0 ? `${formatMoney(totalSpend)} spent making it` : "Across every batch"}
        />
        <StatCard
          label="Promised"
          value={formatWeight(totalCommitted)}
          hint="On orders not yet delivered"
          tone="violet"
        />
        <StatCard
          label="Spare"
          value={formatWeight(totalSpare)}
          hint={
            totalAllocated > 0
              ? `${formatWeight(totalAllocated)} set aside, not counted`
              : "On hand, unclaimed"
          }
          tone="emerald"
        />
        <StatCard
          label="Short"
          value={formatWeight(totalShort)}
          hint={totalShort > 0 ? "Still to make for open orders" : "Every open order is covered"}
          tone={totalShort > 0 ? "rose" : "neutral"}
        />
      </section>

      {awaitingWeight.length > 0 ? (
        <p className="card border-warn-line bg-warn-soft/50 p-4 text-sm text-warn-fg">
          {awaitingWeight.length} {awaitingWeight.length === 1 ? "batch has" : "batches have"} no
          weight recorded yet, so {awaitingWeight.length === 1 ? "it does" : "they do"} not count as
          stock.{" "}
          {awaitingWeight.map((b, i) => (
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
          {formatWeight(totalUntracked)} has been delivered from stock with no batch behind it —
          cooks from before you started recording batches. It is not counted as short, because it
          has already been handed over. To account for it, record a batch dated when you made it.
        </p>
      ) : null}

      <SetAsideJars
        rows={products
          .filter((p) => p.varietyId)
          .map((p) => ({
            productId: p.id,
            name: p.name,
            spare: jarsFrom(
              stock.find((s) => s.varietyId === p.varietyId)?.spare ?? 0,
              p.jarWeightOz,
            ),
          }))}
      />

      <section>
        <SectionHeading
          title="Where each kimchi stands"
          subtitle="On hand is what you made and still hold"
        />
        {stock.length === 0 ? (
          <EmptyState>Record a batch or two and this fills in.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {stock.map((row) => {
              const perOz = costPerOz.get(row.varietyId)?.perOz ?? 0;
              return (
                <div key={row.varietyId} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{row.name}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {formatWeight(row.made)} made · {formatWeight(row.delivered)} delivered ·{" "}
                      {formatWeight(row.committed)} promised
                    </p>
                    {shelf.get(row.varietyId)?.oldest ? (
                      <p className="mt-0.5 text-sm text-fg-muted">
                        Oldest on the shelf: {formatAge(shelf.get(row.varietyId)!.oldest!.madeOn)} ·{" "}
                        <span className="font-mono text-xs">
                          {shelf.get(row.varietyId)!.oldest!.code}
                        </span>
                      </p>
                    ) : null}
                    {jarsFromSpare(row.varietyId).length > 0 ? (
                      <p className="mt-0.5 text-sm text-fg-subtle">
                        Spare fills{" "}
                        {jarsFromSpare(row.varietyId)
                          .map((j) => `${j.jars} × ${j.name}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {row.untracked > 0 ? (
                      <p className="mt-0.5 text-sm text-warn">
                        {formatWeight(row.untracked)} delivered with no batch recorded
                      </p>
                    ) : null}
                    {perOz > 0 ? (
                      <p className="mt-0.5 text-sm text-fg-subtle">
                        {formatMoney(Math.round(perOz * OZ_PER_LB))} per pound to make
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {row.short > 0 ? (
                      <p className="font-bold tabular-nums text-danger">
                        {formatWeight(row.short)} short
                      </p>
                    ) : (
                      <p className="font-bold tabular-nums text-success">
                        {formatWeight(row.spare)} spare
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
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
              const made = batchWeight(batch);
              const cost = batchTotalCost(batch);
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
                        <span className="pill bg-surface-2 text-xs font-semibold text-fg-muted ring-line">
                          {shortAge(batch.madeOn)}
                        </span>
                      </Link>
                      <p className="mt-0.5 text-sm text-fg-muted">
                        Made {formatDate(batch.madeOn)} · {formatAge(batch.madeOn)}
                        {batch.readyOn ? ` · ready ${formatDate(batch.readyOn)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {batch.yields.length === 0 ? (
                        <p className="font-semibold text-warn">Not weighed</p>
                      ) : (
                        <p className="font-bold tabular-nums text-fg">{formatWeight(made)}</p>
                      )}
                      {cost > 0 ? (
                        <p className="text-sm tabular-nums text-fg-muted">
                          {formatMoney(cost)}
                          {made > 0
                            ? ` · ${formatMoney(Math.round((cost / made) * OZ_PER_LB))}/lb`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {batch.yields.map((y) => (
                      <li key={y.id} className="pill bg-surface-2 text-fg-muted ring-line">
                        {formatWeight(y.weightOz)} {y.name}
                      </li>
                    ))}
                  </ul>

                  {batch.costs.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {batch.costs.map((c) => (
                        <li key={c.id} className="text-xs text-fg-subtle">
                          {c.label} {formatMoney(c.amount)}
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
