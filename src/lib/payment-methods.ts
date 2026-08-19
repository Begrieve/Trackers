export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export function methodLabel(value: string): string {
  return PAYMENT_METHOD_LABEL[value as PaymentMethodValue] ?? value;
}

export function isPaymentMethod(value: string): value is PaymentMethodValue {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
