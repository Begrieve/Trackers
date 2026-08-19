import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/payment-methods";

export function MethodOptions() {
  return (
    <>
      {PAYMENT_METHODS.map((method) => (
        <option key={method} value={method}>
          {PAYMENT_METHOD_LABEL[method]}
        </option>
      ))}
    </>
  );
}
