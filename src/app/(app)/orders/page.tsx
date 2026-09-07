import Link from "next/link";
import { getOrders } from "@/lib/queries";
import { bucketOf, orderMath } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { OrderCard } from "@/components/order-card";
import { EmptyState } from "@/components/ui";
import { readinessOf } from "@/lib/readiness";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "owed", label: "Owes money" },
  { key: "receivable", label: "Delivered, unpaid" },
  { key: "prepaid", label: "Prepaid" },
  { key: "pending", label: "Not delivered" },
  { key: "ready", label: "Ready to hand over" },
  { key: "settled", label: "Settled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter: filterParam, q } = await searchParams;
  const filter: FilterKey = (FILTERS.find((f) => f.key === filterParam)?.key ?? "all") as FilterKey;
  const search = (q ?? "").trim().toLowerCase();

  const all = await getOrders();

  const rows = all
    .map((order) => ({ order, math: orderMath(order), bucket: bucketOf(order, orderMath(order)) }))
    .filter(({ order, math, bucket }) => {
      if (search && !order.customer.name.toLowerCase().includes(search)) return false;
      switch (filter) {
        case "owed":
          return math.balance > 0 && order.status !== "CANCELLED";
        case "receivable":
          return bucket === "UNPAID_RECEIVABLE";
        case "prepaid":
          return bucket === "PREPAID_OWE_PRODUCT";
        case "pending":
          return order.status === "PENDING";
        case "ready":
          return readinessOf(order).ready;
        case "settled":
          return bucket === "SETTLED";
        default:
          return true;
      }
    });

  const due = rows.reduce((sum, { math }) => sum + Math.max(math.balance, 0), 0);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Orders</h1>
          <p className="text-sm text-fg-muted">
            {rows.length} {rows.length === 1 ? "order" : "orders"}
            {due > 0 ? ` · ${formatMoney(due)} outstanding` : ""}
          </p>
        </div>
        <Link href="/orders/new" className="btn-primary">
          + New order
        </Link>
      </div>

      <form className="flex gap-2" action="/orders">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q ?? ""}
          className="field min-w-0"
          placeholder="Search by name…"
          aria-label="Search orders by customer name"
        />
        <button className="btn-secondary" type="submit">
          Search
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/orders?filter=${f.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition ${
              f.key === filter
                ? "bg-fg text-bg ring-fg"
                : "bg-surface text-fg-muted ring-line hover:bg-surface-2"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState>No orders match this view.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ order }) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
