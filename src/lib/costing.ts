/**
 * Turning batch spend into a cost per ounce, and from there per jar.
 *
 * A batch costs what it costs and makes a weight, so cost per ounce is the
 * honest unit: a 32 oz jar then costs exactly twice what a 16 oz jar does,
 * which an even split across jars could never express.
 *
 * Across batches a kimchi's cost per ounce is the weighted average of every
 * ounce ever made, so a cheaper cook moves the average in proportion to how
 * much it produced, not merely because it came later.
 */

export type CostedBatch = {
  yields: { varietyId: string; weightOz: number }[];
  costs: { amount: number }[];
};

export type UnitCost = {
  varietyId: string;
  ouncesMade: number;
  totalCost: number;
  /** Cents per ounce, carried unrounded so a jar's cost stays accurate. */
  perOz: number;
};

export function batchTotalCost(batch: { costs: { amount: number }[] }): number {
  return batch.costs.reduce((sum, c) => sum + c.amount, 0);
}

export function batchWeight(batch: { yields: { weightOz: number }[] }): number {
  return batch.yields.reduce((sum, y) => sum + y.weightOz, 0);
}

/** Weighted-average cost per ounce for every kimchi that has been made. */
export function unitCosts(batches: CostedBatch[]): Map<string, UnitCost> {
  const totals = new Map<string, UnitCost>();

  for (const batch of batches) {
    const weight = batchWeight(batch);
    if (weight === 0) continue;

    const cost = batchTotalCost(batch);
    for (const y of batch.yields) {
      const row =
        totals.get(y.varietyId) ??
        { varietyId: y.varietyId, ouncesMade: 0, totalCost: 0, perOz: 0 };
      row.ouncesMade += y.weightOz;
      // This kimchi's share of a cook that made several.
      row.totalCost += (cost / weight) * y.weightOz;
      totals.set(y.varietyId, row);
    }
  }

  for (const row of totals.values()) {
    row.totalCost = Math.round(row.totalCost);
    row.perOz = row.ouncesMade > 0 ? row.totalCost / row.ouncesMade : 0;
  }

  return totals;
}

/** What one jar of this kimchi cost to make, in cents. */
export function costOfJar(unit: UnitCost | undefined, jarWeightOz: number): number {
  if (!unit || unit.perOz <= 0) return 0;
  return Math.round(unit.perOz * jarWeightOz);
}

export type CogsResult = {
  cost: number;
  /** Jars sold whose kimchi has a recorded cost. */
  costedJars: number;
  /** Jars sold with no batch cost behind them — profit for these is overstated. */
  uncostedJars: number;
};

export function costOfGoodsSold(
  soldJars: { varietyId: string; quantity: number; jarWeightOz: number }[],
  costs: Map<string, UnitCost>,
): CogsResult {
  let cost = 0;
  let costedJars = 0;
  let uncostedJars = 0;

  for (const jar of soldJars) {
    const unit = costs.get(jar.varietyId);
    if (unit && unit.perOz > 0) {
      cost += costOfJar(unit, jar.jarWeightOz) * jar.quantity;
      costedJars += jar.quantity;
    } else {
      uncostedJars += jar.quantity;
    }
  }

  return { cost, costedJars, uncostedJars };
}

/** Margin as a percentage of revenue, to one decimal place. */
export function marginPercent(revenue: number, profit: number): number | null {
  if (revenue <= 0) return null;
  return Math.round((profit / revenue) * 1000) / 10;
}
