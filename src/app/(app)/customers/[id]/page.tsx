import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/scope";
import { getOrders } from "@/lib/queries";
import { rollUp } from "@/lib/ledger";
import { formatDate, formatMoney } from "@/lib/money";
import { formatWeight } from "@/lib/weight";
import { ALLOCATION_LABEL, type AllocationKindValue } from "@/lib/allocations";
import { OrderCard } from "@/components/order-card";
import { EmptyState, StatCard } from "@/components/ui";
import { deleteCustomer } from "@/actions/customers";
import { EditCustomer } from "./edit-customer";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [orders, gifts] = await Promise.all([
    getOrders({ customerId: id }),
    db.batchAllocation.findMany({
      where: { customerId: id },
      orderBy: [{ wentOutOn: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      include: { batch: { select: { id: true, code: true } } },
    }),
  ]);
  const totals = rollUp(orders);
  const giftJars = gifts.reduce((sum, g) => sum + g.quantity, 0);
  const giftsOwed = gifts.filter((g) => !g.wentOutOn).reduce((sum, g) => sum + g.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← People
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">{customer.name}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info on file"}
        </p>
        {customer.notes ? <p className="mt-2 text-sm text-fg-muted">{customer.notes}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Owes you" value={formatMoney(totals.outstanding)} tone="rose" />
        <StatCard label="Prepaid" value={formatMoney(totals.prepaid)} tone="violet" hint="You owe kimchi" />
        <StatCard label="Paid to date" value={formatMoney(totals.collected)} tone="emerald" />
        <StatCard label="Ordered to date" value={formatMoney(totals.orderedValue)} />
      </div>

      {gifts.length > 0 ? (
        <section>
          <h2 className="mb-1 text-lg font-bold text-fg">
            <span aria-hidden="true">🎁</span> Given, not sold
          </h2>
          <p className="mb-3 text-sm text-fg-muted">
            {giftJars} {giftJars === 1 ? "jar" : "jars"} with no money against it
            {giftsOwed > 0 ? `, ${giftsOwed} still to hand over` : ""}. Edit these on{" "}
            <Link href="/set-aside" className="font-semibold text-brand hover:underline">
              Out without money
            </Link>
            .
          </p>
          <ul className="card divide-y divide-line">
            {gifts.map((gift) => (
              <li key={gift.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">
                    <span className="font-semibold tabular-nums">{gift.quantity} ×</span>{" "}
                    {gift.name}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {ALLOCATION_LABEL[gift.kind as AllocationKindValue]} ·{" "}
                    {formatWeight(gift.quantity * gift.jarWeightOz)} ·{" "}
                    {gift.wentOutOn ? (
                      formatDate(gift.wentOutOn)
                    ) : (
                      <span className="font-semibold text-warn-fg">still to hand over</span>
                    )}
                    {gift.note ? ` · ${gift.note}` : ""}
                  </p>
                </div>
                <Link
                  href={`/batches/${gift.batch.id}`}
                  className="shrink-0 text-xs font-semibold text-fg-muted hover:text-fg"
                >
                  {gift.batch.code} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold text-fg">Orders</h2>
        {orders.length === 0 ? (
          <EmptyState>
            No orders yet.{" "}
            <Link href="/orders/new" className="font-semibold text-danger underline">
              Start one
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <EditCustomer customer={customer} />

      {orders.length === 0 ? (
        <form action={deleteCustomer}>
          <input type="hidden" name="id" value={customer.id} />
          <button type="submit" className="text-sm font-semibold text-fg-subtle hover:text-danger">
            Delete this person
          </button>
        </form>
      ) : null}
    </div>
  );
}
