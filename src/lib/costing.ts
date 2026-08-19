/**
 * Turning batch spend into a cost per jar.
 *
 * Within one batch the cost is split evenly across the jars it produced, so a
 * £120 cook that yields 30 jars puts £4 behind each of them. That is arithmetic
 * you can check in your head, which matters more here than pretending to a
 * precision the inputs don't support. Record sizes as separate batches when the
 * difference between a 32 oz and a 16 oz jar is worth accounting for.
 *
 * Across batches a product's unit cost is the weighted average of every jar of
 * it ever made — so a cheaper cook pulls the average down in proportion to how
 * many jars it produced, not merely because it happened later.
 */

export type CostedBatch = {
  items: { productId: string; quantity: number }[];
  costs: { amount: number }[];
};

export type UnitCost = { productId: string; jarsMade: number; totalCost: number; perJar: number };

export function batchTotalCost(batch: { costs: { amount: number }[] }): number {
  return batch.costs.reduce((sum, c) => sum + c.amount, 0);
}

export function batchJars(batch: { items: { quantity: number }[] }): number {
  return batch.items.reduce((sum, i) => sum + i.quantity, 0);
}

/** Weighted-average cost per jar for every product that has ever been batched. */
export function unitCosts(batches: CostedBatch[]): Map<string, UnitCost> {
  const totals = new Map<string, UnitCost>();

  for (const batch of batches) {
    const jars = batchJars(batch);
    if (jars === 0) continue;

    const cost = batchTotalCost(batch);
    for (const item of batch.items) {
      const row =
        totals.get(item.productId) ??
        { productId: item.productId, jarsMade: 0, totalCost: 0, perJar: 0 };
      row.jarsMade += item.quantity;
      // Even split within the batch, then apportioned by this product's share.
      row.totalCost += Math.round((cost / jars) * item.quantity);
      totals.set(item.productId, row);
    }
  }

  for (const row of totals.values()) {
    row.perJar = row.jarsMade > 0 ? Math.round(row.totalCost / row.jarsMade) : 0;
  }

  return totals;
}

export type CogsResult = {
  /** Cost of the jars sold, for products that have batch costs recorded. */
  cost: number;
  /** Jars sold whose product has a recorded cost. */
  costedJars: number;
  /** Jars sold with no batch cost behind them — profit for these is overstated. */
  uncostedJars: number;
};

export function costOfGoodsSold(
  soldItems: { productId: string; quantity: number }[],
  costs: Map<string, UnitCost>,
): CogsResult {
  let cost = 0;
  let costedJars = 0;
  let uncostedJars = 0;

  for (const item of soldItems) {
    const unit = costs.get(item.productId);
    if (unit && unit.perJar > 0) {
      cost += unit.perJar * item.quantity;
      costedJars += item.quantity;
    } else {
      uncostedJars += item.quantity;
    }
  }

  return { cost, costedJars, uncostedJars };
}

/** Margin as a percentage of revenue, rounded to one decimal place. */
export function marginPercent(revenue: number, profit: number): number | null {
  if (revenue <= 0) return null;
  return Math.round((profit / revenue) * 1000) / 10;
}
