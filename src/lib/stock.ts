/**
 * Stock, in weight.
 *
 * A batch is a weight of one kimchi type. Jars are filled from it when orders
 * are assigned, so every jar that leaves is converted to the weight it took
 * with it. Totals are per variety, because a 16 oz and a 32 oz jar of the same
 * kimchi come out of the same cook.
 */

export type StockRow = {
  varietyId: string;
  name: string;
  /** Ounces made across every batch of this kimchi. */
  made: number;
  /** Weight handed over on delivered orders. */
  delivered: number;
  /** Weight promised on orders not yet delivered. */
  committed: number;
  /** Made and still held. Never negative. */
  onHand: number;
  /** On hand beyond what open orders have claimed. */
  spare: number;
  /** Promised beyond what is on hand — what still has to be made. */
  short: number;
  /** Delivered weight that named the batch it came from. */
  drawnDown: number;
  /** Weight set aside without a sale: kept, given away, shipped, lost. */
  allocated: number;
  /**
   * Delivered without a batch attached: cooks from before this was recorded.
   * Reported rather than treated as a shortfall, and it draws nothing down,
   * because that kimchi was never in these books.
   */
  untracked: number;
};

type YieldLine = { varietyId: string; name: string; weightOz: number };

/** Jars leaving: a count, plus what one jar weighs. */
type JarLine = {
  varietyId: string;
  name: string;
  quantity: number;
  jarWeightOz: number;
  status: string;
  batchId?: string | null;
};

type AllocationLine = {
  varietyId: string;
  name: string;
  quantity: number;
  jarWeightOz: number;
};

export function stockByVariety(
  yieldLines: YieldLine[],
  jarLines: JarLine[],
  allocationLines: AllocationLine[] = [],
): StockRow[] {
  const rows = new Map<string, StockRow>();

  const row = (varietyId: string, name: string) => {
    let existing = rows.get(varietyId);
    if (!existing) {
      existing = {
        varietyId,
        name,
        made: 0,
        delivered: 0,
        committed: 0,
        onHand: 0,
        spare: 0,
        short: 0,
        drawnDown: 0,
        allocated: 0,
        untracked: 0,
      };
      rows.set(varietyId, existing);
    }
    return existing;
  };

  for (const line of yieldLines) {
    row(line.varietyId, line.name).made += line.weightOz;
  }

  for (const line of jarLines) {
    if (line.status === "CANCELLED") continue;
    const target = row(line.varietyId, line.name);
    const weight = line.quantity * line.jarWeightOz;

    if (line.status !== "DELIVERED") {
      target.committed += weight;
    } else {
      target.delivered += weight;
      if (line.batchId) target.drawnDown += weight;
      else target.untracked += weight;
    }
  }

  for (const line of allocationLines) {
    row(line.varietyId, line.name).allocated += line.quantity * line.jarWeightOz;
  }

  for (const value of rows.values()) {
    // Floored at zero: kimchi that has left the kitchen can reduce what is on
    // hand but never create a future shortfall. Only undelivered promises do.
    value.onHand = Math.max(value.made - value.drawnDown - value.allocated, 0);
    value.spare = Math.max(value.onHand - value.committed, 0);
    value.short = Math.max(value.committed - value.onHand, 0);
  }

  return [...rows.values()].sort((a, b) => b.short - a.short || a.name.localeCompare(b.name));
}
