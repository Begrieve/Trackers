import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/queries";
import { BUCKET_CLASS, BUCKET_LABEL, bucketOf, orderMath } from "@/lib/ledger";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/money";
import { deleteOrder, deletePayment, markPaidInFull, setOrderStatus, updateOrder } from "@/actions/orders";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  VENMO: "Venmo",
  ZELLE: "Zelle",
  CASHAPP: "Cash App",
  PAYPAL: "PayPal",
  CHECK: "Check",
  OTHER: "Other",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const math = orderMath(order);
  const bucket = bucketOf(order, math);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-sm font-medium text-stone-500 hover:text-stone-800">
          ← Orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">{order.customer.name}</h1>
          <span className={`pill ${BUCKET_CLASS[bucket]}`}>{BUCKET_LABEL[bucket]}</span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Ordered {formatDate(order.orderedAt)}
          {order.deliveredAt ? ` · delivered ${formatDate(order.deliveredAt)}` : ""}
          {order.dueAt && !order.deliveredAt ? ` · due ${formatDate(order.dueAt)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-stone-900">{formatMoney(math.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase">Paid</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">{formatMoney(math.paid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase">
            {math.balance < 0 ? "Credit" : "Balance"}
          </p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              math.balance > 0 ? "text-rose-700" : math.balance < 0 ? "text-violet-700" : "text-emerald-700"
            }`}
          >
            {formatMoney(Math.abs(math.balance))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.status !== "DELIVERED" ? (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="DELIVERED" />
            <button className="btn-primary" type="submit">
              Mark delivered
            </button>
          </form>
        ) : (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="PENDING" />
            <button className="btn-secondary" type="submit">
              Undo delivery
            </button>
          </form>
        )}

        {math.balance > 0 ? (
          <form action={markPaidInFull}>
            <input type="hidden" name="id" value={order.id} />
            <button className="btn-secondary" type="submit">
              Paid in full ({formatMoney(math.balance)})
            </button>
          </form>
        ) : null}

        {order.status !== "CANCELLED" ? (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <button className="btn-ghost" type="submit">
              Cancel order
            </button>
          </form>
        ) : (
          <form action={setOrderStatus}>
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="status" value="PENDING" />
            <button className="btn-secondary" type="submit">
              Reopen order
            </button>
          </form>
        )}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-stone-900">Items</h2>
        <ul className="divide-y divide-stone-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-500">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold tabular-nums text-stone-900">
                {formatMoney(item.quantity * item.unitPrice)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-stone-900">Payments</h2>

        {order.payments.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">Nothing received yet.</p>
        ) : (
          <ul className="mb-4 divide-y divide-stone-100">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">
                    {formatMoney(payment.amount)}{" "}
                    <span className="font-normal text-stone-500">
                      · {METHOD_LABEL[payment.method] ?? payment.method}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatDate(payment.paidAt)}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <form action={deletePayment}>
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <PaymentForm orderId={order.id} suggested={Math.max(math.balance, 0)} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold text-stone-900">Details</h2>
        <form action={updateOrder} className="space-y-3">
          <input type="hidden" name="id" value={order.id} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="orderedAt">
                Order date
              </label>
              <input
                id="orderedAt"
                name="orderedAt"
                type="date"
                className="field"
                defaultValue={toDateInputValue(order.orderedAt)}
              />
            </div>
            <div>
              <label className="label" htmlFor="dueAt">
                Deliver by
              </label>
              <input
                id="dueAt"
                name="dueAt"
                type="date"
                className="field"
                defaultValue={toDateInputValue(order.dueAt)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={2} className="field" defaultValue={order.notes ?? ""} />
          </div>
          <button type="submit" className="btn-secondary">
            Save details
          </button>
        </form>
      </section>

      <form action={deleteOrder}>
        <input type="hidden" name="id" value={order.id} />
        <button
          type="submit"
          className="text-sm font-semibold text-stone-400 hover:text-rose-700"
        >
          Delete this order permanently
        </button>
      </form>
    </div>
  );
}
