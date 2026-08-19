import Link from "next/link";
import { getOrders } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { rollUp } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui";
import { AddCustomer } from "./customer-form";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, orders] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    getOrders(),
  ]);

  const rows = customers
    .map((customer) => {
      const theirs = orders.filter((o) => o.customerId === customer.id);
      return { customer, totals: rollUp(theirs), orderCount: theirs.length };
    })
    .sort((a, b) => b.totals.outstanding - a.totals.outstanding || a.customer.name.localeCompare(b.customer.name));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">People</h1>
          <p className="text-sm text-fg-muted">Everyone you distribute to, and where they stand.</p>
        </div>
        <AddCustomer />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No one added yet. Add a person, or just start a new order.</EmptyState>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map(({ customer, totals, orderCount }) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center justify-between gap-3 p-4 transition hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{customer.name}</p>
                <p className="mt-0.5 text-sm text-fg-muted">
                  {orderCount} {orderCount === 1 ? "order" : "orders"}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {totals.outstanding > 0 ? (
                  <p className="font-bold tabular-nums text-danger">
                    {formatMoney(totals.outstanding)} owed
                  </p>
                ) : (
                  <p className="font-medium text-success">settled</p>
                )}
                {totals.prepaid > 0 ? (
                  <p className="text-sm tabular-nums text-info">
                    {formatMoney(totals.prepaid)} prepaid
                  </p>
                ) : null}
                {totals.credit > 0 ? (
                  <p className="text-sm tabular-nums text-fg-muted">
                    {formatMoney(totals.credit)} credit
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
