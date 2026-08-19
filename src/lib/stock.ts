export type StockRow = {
  productId: string;
  name: string;
  made: number;
  delivered: number;
  committed: number;
  /** Jars made that are neither handed over nor promised to an open order. */
  spare: number;
  /** Jars promised beyond what has been made. Positive means you need to cook. */
  short: number;
};

type BatchLine = { productId: string; name: string; quantity: number };
type OrderLine = { productId: string; name: string; quantity: number; status: string };

export function stockByProduct(batchLines: BatchLine[], orderLines: OrderLine[]): StockRow[] {
  const rows = new Map<string, StockRow>();

  const row = (productId: string, name: string) => {
    let existing = rows.get(productId);
    if (!existing) {
      existing = { productId, name, made: 0, delivered: 0, committed: 0, spare: 0, short: 0 };
      rows.set(productId, existing);
    }
    return existing;
  };

  for (const line of batchLines) {
    row(line.productId, line.name).made += line.quantity;
  }

  for (const line of orderLines) {
    if (line.status === "CANCELLED") continue;
    const target = row(line.productId, line.name);
    if (line.status === "DELIVERED") target.delivered += line.quantity;
    else target.committed += line.quantity;
  }

  for (const value of rows.values()) {
    const remaining = value.made - value.delivered - value.committed;
    value.spare = Math.max(remaining, 0);
    value.short = Math.max(-remaining, 0);
  }

  return [...rows.values()].sort((a, b) => b.short - a.short || a.name.localeCompare(b.name));
}
