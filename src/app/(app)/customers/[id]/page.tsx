import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOrders } from "@/lib/queries";
import { rollUp } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { OrderCard } from "@/components/order-card";
import { EmptyState, StatCard } from "@/components/ui";
import { deleteCustomer } from "@/actions/customers";
import { EditCustomer } from "./edit-customer";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const orders = await getOrders({ customerId: id });
  const totals = rollUp(orders);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← People
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info on file"}
        </p>
        {customer.notes ? <p className="mt-2 text-sm text-stone-600">{customer.notes}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Owes you" value={formatMoney(totals.outstanding)} tone="rose" />
        <StatCard label="Prepaid" value={formatMoney(totals.prepaid)} tone="violet" hint="You owe kimchi" />
        <StatCard label="Paid to date" value={formatMoney(totals.collected)} tone="emerald" />
        <StatCard label="Ordered to date" value={formatMoney(totals.orderedValue)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-stone-900">Orders</h2>
        {orders.length === 0 ? (
          <EmptyState>
            No orders yet.{" "}
            <Link href="/orders/new" className="font-semibold text-rose-700 underline">
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
          <button type="submit" className="text-sm font-semibold text-stone-400 hover:text-rose-700">
            Delete this person
          </button>
        </form>
      ) : null}
    </div>
  );
}
