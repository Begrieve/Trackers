export type StockRow = {
  productId: string;
  name: string;
  made: number;
  delivered: number;
  committed: number;
  /** Jars made and not yet handed over. Never negative. */
  onHand: number;
  /** On hand beyond what open orders have claimed. */
  spare: number;
  /** Open orders beyond what is on hand — what still has to be made. */
  short: number;
  /** Delivered jars that named the batch they came from. */
  drawnDown: number;
  /** Jars set aside without a sale: given away, kept, shipped, or lost. */
  allocated: number;
  /**
   * Jars delivered without a batch attached: cooks from before batch tracking,
   * or a batch never written down. They are reported rather than treated as a
   * shortfall, and they consume no recorded stock, because the jars came from
   * kimchi this ledger never knew about.
   */
  untracked: number;
};

type BatchLine = { productId: string; name: string; quantity: number };
type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  status: string;
  batchId?: string | null;
};

type AllocationLine = { productId: string; name: string; quantity: number };

export function stockByProduct(
  batchLines: BatchLine[],
  orderLines: OrderLine[],
  allocationLines: AllocationLine[] = [],
): StockRow[] {
  const rows = new Map<string, StockRow>();

  const row = (productId: string, name: string) => {
    let existing = rows.get(productId);
    if (!existing) {
      existing = {
        productId,
        name,
        made: 0,
        delivered: 0,
        committed: 0,
        onHand: 0,
        spare: 0,
        short: 0,
        untracked: 0,
        drawnDown: 0,
        allocated: 0,
      };
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
    if (line.status !== "DELIVERED") {
      target.committed += line.quantity;
    } else {
      target.delivered += line.quantity;
      // A delivery only draws down recorded stock when it says which batch it
      // came from. An unattributed one came from kimchi made before any of this
      // was written down, so it must not eat into a batch recorded later.
      if (line.batchId) target.drawnDown += line.quantity;
      else target.untracked += line.quantity;
    }
  }

  for (const line of allocationLines) {
    row(line.productId, line.name).allocated += line.quantity;
  }

  for (const value of rows.values()) {
    // Floored at zero: a jar that has left the kitchen — handed over, given
    // away or kept — can reduce what is on hand but never create a future
    // shortfall. Only undelivered promises do that.
    value.onHand = Math.max(value.made - value.drawnDown - value.allocated, 0);
    value.spare = Math.max(value.onHand - value.committed, 0);
    value.short = Math.max(value.committed - value.onHand, 0);
  }

  return [...rows.values()].sort((a, b) => b.short - a.short || a.name.localeCompare(b.name));
}
