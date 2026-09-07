import Link from "next/link";
import { BUCKET_CLASS, BUCKET_LABEL, bucketOf, orderMath, type FullOrder } from "@/lib/ledger";
import { readinessOf } from "@/lib/readiness";
import { formatDate, formatMoney } from "@/lib/money";

export function OrderCard({ order }: { order: FullOrder }) {
  const math = orderMath(order);
  const bucket = bucketOf(order, math);
  const jars = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const readiness = readinessOf(order);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="card block p-4 transition hover:border-line-strong hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{order.customer.name}</p>
          <p className="mt-0.5 truncate text-sm text-fg-muted">
            {jars} {jars === 1 ? "jar" : "jars"} · ordered {formatDate(order.orderedAt)}
            {order.status === "DELIVERED" && order.deliveredAt
              ? ` · delivered ${formatDate(order.deliveredAt)}`
              : order.dueAt
                ? ` · due ${formatDate(order.dueAt)}`
                : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-bold tabular-nums text-fg">{formatMoney(math.total)}</p>
          {math.balance > 0 ? (
            <p className="text-sm font-semibold tabular-nums text-danger">
              {formatMoney(math.balance)} due
            </p>
          ) : math.credit > 0 ? (
            <p className="text-sm font-semibold tabular-nums text-info">
              {formatMoney(math.credit)} credit
            </p>
          ) : (
            <p className="text-sm font-medium text-success">paid</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`pill ${BUCKET_CLASS[bucket]}`}>{BUCKET_LABEL[bucket]}</span>
        {readiness.ready ? (
          <span className="pill bg-success-soft text-success-fg ring-success-line">
            {readiness.label}
          </span>
        ) : null}
        {math.prepaid > 0 && order.status === "PENDING" ? (
          <span className="pill bg-surface-2 text-fg-muted ring-line">
            {formatMoney(math.prepaid)} prepaid
          </span>
        ) : null}
      </div>
    </Link>
  );
}
