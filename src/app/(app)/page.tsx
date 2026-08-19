import Link from "next/link";
import { getOrders } from "@/lib/queries";
import { bucketOf, orderMath, rollUp } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { OrderCard } from "@/components/order-card";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const orders = await getOrders();
  const totals = rollUp(orders);

  const withMath = orders.map((order) => ({ order, math: orderMath(order) }));
  const owesMoney = withMath.filter(({ order, math }) => bucketOf(order, math) === "UNPAID_RECEIVABLE");
  const owePr = withMath.filter(({ order, math }) => bucketOf(order, math) === "PREPAID_OWE_PRODUCT");
  const awaiting = withMath.filter(({ order, math }) => bucketOf(order, math) === "AWAITING_DELIVERY");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h1>
          <p className="text-sm text-stone-500">Where every jar and every dollar stands right now.</p>
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
        <StatCard label="Customer credit" value={formatMoney(totals.credit)} hint="Overpayments on file" />
      </section>

      <section>
        <SectionHeading
          title="They owe you money"
          subtitle="Delivered, not paid in full"
          action={
            owesMoney.length > 0 ? (
              <span className="text-sm font-semibold tabular-nums text-rose-700">
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
              <span className="text-sm font-semibold tabular-nums text-violet-700">
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
              <span className="text-sm font-semibold tabular-nums text-amber-700">
                {formatMoney(awaiting.reduce((sum, { math }) => sum + math.collectOnDelivery, 0))}
              </span>
            ) : null
          }
        />
        {awaiting.length === 0 ? (
          <EmptyState>
            No open orders.{" "}
            <Link href="/orders/new" className="font-semibold text-rose-700 underline">
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
