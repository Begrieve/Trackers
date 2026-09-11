import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrders } from "@/lib/queries";
import { bucketOf, orderMath, rollUp } from "@/lib/ledger";
import { stockByProduct } from "@/lib/stock";
import { formatDate, formatMoney } from "@/lib/money";
import { OrderCard } from "@/components/order-card";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { readyCount } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [orders, batches] = await Promise.all([
    getOrders(),
    prisma.batch.findMany({
      include: { items: true },
      orderBy: [{ madeOn: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const totals = rollUp(orders);
  const ready = readyCount(orders);

  const stock = stockByProduct(
    batches.flatMap((b) => b.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity }))),
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

  const jars = {
    onHand: stock.reduce((sum, r) => sum + r.onHand, 0),
    spare: stock.reduce((sum, r) => sum + r.spare, 0),
    promised: stock.reduce((sum, r) => sum + r.committed, 0),
    short: stock.reduce((sum, r) => sum + r.short, 0),
  };

  // Only the products actually worth acting on: something to cook, or jars free
  // to sell.
  const needsAttention = stock.filter((row) => row.short > 0 || row.spare > 0).slice(0, 5);
  const awaitingYield = batches.filter((b) => b.items.length === 0);
  const latest = batches[0];

  const withMath = orders.map((order) => ({ order, math: orderMath(order) }));
  const owesMoney = withMath.filter(({ order, math }) => bucketOf(order, math) === "UNPAID_RECEIVABLE");
  const owePr = withMath.filter(({ order, math }) => bucketOf(order, math) === "PREPAID_OWE_PRODUCT");
  const awaiting = withMath.filter(({ order, math }) => bucketOf(order, math) === "AWAITING_DELIVERY");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Dashboard</h1>
          <p className="text-sm text-fg-muted">Where every jar and every dollar stands right now.</p>
        </div>
        <Link href="/orders/new" className="btn-primary">
          + New order
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Cash to collect"
          value={formatMoney(totals.outstanding)}
          hint="Everything still owed to you"
          tone="rose"
          href="/orders?filter=owed"
        />
        <StatCard
          label="Owed on delivery"
          value={formatMoney(totals.collectOnDelivery)}
          hint="Undelivered orders, unpaid"
          tone="amber"
          href="/orders?filter=pending"
        />
        <StatCard
          label="Delivered, unpaid"
          value={formatMoney(totals.receivable)}
          hint="Receivables to chase"
          tone="rose"
          href="/orders?filter=receivable"
        />
        <StatCard
          label="Prepaid — you owe kimchi"
          value={formatMoney(totals.prepaid)}
          hint={`${totals.jarsOwed} ${totals.jarsOwed === 1 ? "jar" : "jars"} still to deliver`}
          tone="violet"
          href="/orders?filter=prepaid"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(totals.collected)} tone="emerald" hint="All payments received" />
        <StatCard label="Total ordered" value={formatMoney(totals.orderedValue)} hint="Lifetime order value" />
        <StatCard label="Open orders" value={String(totals.ordersOpen)} hint="Not yet delivered" />
        <StatCard
          label="Ready to hand over"
          value={String(ready)}
          hint={ready > 0 ? "Jars made and set aside" : "Nothing set aside yet"}
          tone={ready > 0 ? "emerald" : "neutral"}
          href="/orders?filter=ready"
        />
        <StatCard label="Customer credit" value={formatMoney(totals.credit)} hint="Overpayments on file" />
      </section>

      <section>
        <SectionHeading
          title="Jars and batches"
          subtitle={
            latest
              ? `Last cook ${latest.code} · ${formatDate(latest.madeOn)}`
              : "No batches recorded yet"
          }
          action={
            <Link href="/batches" className="text-sm font-semibold text-brand hover:underline">
              All batches →
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="On hand"
            value={String(jars.onHand)}
            hint="Made and still held"
            href="/batches"
          />
          <StatCard
            label="Spare"
            value={String(jars.spare)}
            hint="Free to sell"
            tone={jars.spare > 0 ? "emerald" : "neutral"}
            href="/batches"
          />
          <StatCard
            label="Promised"
            value={String(jars.promised)}
            hint="Claimed by open orders"
            tone="violet"
            href="/orders?filter=pending"
          />
          <StatCard
            label="Short"
            value={String(jars.short)}
            hint={jars.short > 0 ? "Still to cook" : "Every order covered"}
            tone={jars.short > 0 ? "rose" : "neutral"}
            href="/deliveries"
          />
        </div>

        {awaitingYield.length > 0 ? (
          <p className="card mt-3 border-warn-line bg-warn-soft/50 p-4 text-sm text-warn-fg">
            {awaitingYield.length} {awaitingYield.length === 1 ? "batch is" : "batches are"} waiting
            on a jar count, so {awaitingYield.length === 1 ? "it doesn't" : "they don't"} count as
            stock yet.{" "}
            {awaitingYield.map((b, i) => (
              <span key={b.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/batches/${b.id}/edit`} className="font-semibold underline">
                  {b.code}
                </Link>
              </span>
            ))}
          </p>
        ) : null}

        {needsAttention.length > 0 ? (
          <div className="card mt-3 divide-y divide-line">
            {needsAttention.map((row) => (
              <div key={row.productId} className="flex items-center justify-between gap-3 p-3">
                <p className="min-w-0 truncate text-sm font-medium text-fg">{row.name}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {row.short > 0 ? (
                    <span className="text-danger">{row.short} short</span>
                  ) : (
                    <span className="text-success">{row.spare} spare</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading
          title="They owe you money"
          subtitle="Delivered, not paid in full"
          action={
            owesMoney.length > 0 ? (
              <span className="text-sm font-semibold tabular-nums text-danger">
                {formatMoney(totals.receivable)}
              </span>
            ) : null
          }
        />
        {owesMoney.length === 0 ? (
          <EmptyState>Nothing outstanding on delivered orders. Nice.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {owesMoney.map(({ order }) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="You owe them kimchi"
          subtitle="Paid up front, not delivered yet"
          action={
            owePr.length > 0 ? (
              <span className="text-sm font-semibold tabular-nums text-info">
                {formatMoney(totals.prepaid)}
              </span>
            ) : null
          }
        />
        {owePr.length === 0 ? (
          <EmptyState>No prepaid orders waiting on delivery.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {owePr.map(({ order }) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Ordered — collect on delivery"
          subtitle="No money taken yet"
          action={
            awaiting.length > 0 ? (
              <span className="text-sm font-semibold tabular-nums text-warn">
                {formatMoney(awaiting.reduce((sum, { math }) => sum + math.collectOnDelivery, 0))}
              </span>
            ) : null
          }
        />
        {awaiting.length === 0 ? (
          <EmptyState>
            No open orders.{" "}
            <Link href="/orders/new" className="font-semibold text-danger underline">
              Add one
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {awaiting.map(({ order }) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
