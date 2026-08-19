import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrders } from "@/lib/queries";
import { buildReport, parseRange, PRESETS, type PresetKey } from "@/lib/reports";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/money";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

function isPreset(value: string | undefined): value is PresetKey {
  return PRESETS.some((p) => p.key === value);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const preset: PresetKey = isPreset(params.preset) ? params.preset : "this-month";
  const range = parseRange(params.from, params.to, preset);

  const [orders, batches] = await Promise.all([
    getOrders(),
    prisma.batch.findMany({
      select: {
        madeOn: true,
        items: { select: { productId: true, quantity: true } },
        costs: { select: { amount: true } },
      },
    }),
  ]);

  const report = buildReport(orders, batches, range);
  const csvHref = `/reports/export?from=${toDateInputValue(range.from)}&to=${toDateInputValue(range.to)}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Reports</h1>
          <p className="text-sm text-fg-muted">
            {preset === "all" && !params.from
              ? "All time"
              : `${formatDate(range.from)} — ${formatDate(range.to)}`}
          </p>
        </div>
        <a href={csvHref} className="btn-secondary">
          Download CSV
        </a>
      </div>

      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <Link
              key={p.key}
              href={`/reports?preset=${p.key}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition ${
                p.key === preset && !params.from
                  ? "bg-fg text-bg ring-fg"
                  : "bg-surface text-fg-muted ring-line hover:bg-surface-2"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form action="/reports" className="card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              className="field"
              defaultValue={params.from ?? toDateInputValue(range.from)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              className="field"
              defaultValue={params.to ?? toDateInputValue(range.to)}
            />
          </div>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders" value={String(report.orderCount)} hint="Placed in this period" />
        <StatCard label="Jars ordered" value={String(report.jars)} hint="Across those orders" />
        <StatCard label="Billed" value={formatMoney(report.billed)} hint="Value of those orders" />
        <StatCard
          label="Collected"
          value={formatMoney(report.collected)}
          hint="Payments received in this period"
          tone="emerald"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Still owed"
          value={formatMoney(report.outstanding)}
          hint="On orders from this period"
          tone="rose"
        />
        <StatCard label="Jars made" value={String(report.jarsMade)} hint={`${report.batchCount} ${report.batchCount === 1 ? "batch" : "batches"}`} />
        <StatCard label="People served" value={String(report.people.length)} />
        <StatCard
          label="Avg order"
          value={formatMoney(report.orderCount > 0 ? Math.round(report.billed / report.orderCount) : 0)}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Cost of jars sold"
          value={formatMoney(report.cogs)}
          hint="At average cost to make"
        />
        <StatCard
          label="Gross profit"
          value={formatMoney(report.profit)}
          hint="Billed minus cost of jars sold"
          tone={report.profit >= 0 ? "emerald" : "rose"}
        />
        <StatCard
          label="Margin"
          value={report.marginPct === null ? "—" : `${report.marginPct}%`}
          hint="Share of billing kept"
          tone={report.marginPct !== null && report.marginPct < 0 ? "rose" : "neutral"}
        />
        <StatCard
          label="Batch spend"
          value={formatMoney(report.batchSpend)}
          hint="Cash out on cooking this period"
          tone="amber"
        />
      </section>

      {report.uncostedJars > 0 ? (
        <p className="card border-warn-line bg-warn-soft/50 p-4 text-sm text-warn-fg">
          {report.uncostedJars} {report.uncostedJars === 1 ? "jar" : "jars"} sold in this period
          {" "}
          {report.uncostedJars === 1 ? "has" : "have"} no batch cost recorded, so profit and margin
          are optimistic. Record a batch with its costs for those products to fix this.
        </p>
      ) : null}

      <section>
        <SectionHeading title="By product" subtitle="Quantity, value, and what it cost to make" />
        {report.products.length === 0 ? (
          <EmptyState>No orders in this period.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {report.products.map((row) => (
              <div key={row.name} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{row.name}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    {row.quantity} {row.quantity === 1 ? "jar" : "jars"}
                    {row.cost > 0 ? ` · ${formatMoney(row.cost)} to make` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums text-fg">{formatMoney(row.revenue)}</p>
                  {row.cost > 0 ? (
                    <p className="text-sm font-semibold tabular-nums text-success">
                      {formatMoney(row.profit)} profit
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="By person" subtitle="What each person ordered and paid" />
        {report.people.length === 0 ? (
          <EmptyState>No orders in this period.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {report.people.map((row) => (
              <Link
                key={row.id}
                href={`/customers/${row.id}`}
                className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">{row.name}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    {row.orders} {row.orders === 1 ? "order" : "orders"} · {row.jars}{" "}
                    {row.jars === 1 ? "jar" : "jars"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums text-fg">{formatMoney(row.billed)}</p>
                  {row.owed > 0 ? (
                    <p className="text-sm font-semibold tabular-nums text-danger">
                      {formatMoney(row.owed)} owed
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-success">paid</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="How they paid" subtitle="Payments received in this period" />
        {report.methods.length === 0 ? (
          <EmptyState>No payments received in this period.</EmptyState>
        ) : (
          <div className="card divide-y divide-line">
            {report.methods.map((row) => (
              <div key={row.method} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-fg">{row.label}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    {row.count} {row.count === 1 ? "payment" : "payments"}
                  </p>
                </div>
                <p className="shrink-0 font-bold tabular-nums text-success">{formatMoney(row.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
