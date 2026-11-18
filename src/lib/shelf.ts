import type { BatchStock } from "./allocate-fifo";

/**
 * What weight of each kimchi is physically left in each batch, and therefore
 * how old the oldest kimchi on the shelf is. The total says how much there is;
 * this says what to move first.
 */

export type BatchLike = {
  id: string;
  code: string;
  madeOn: Date;
  yields: { varietyId: string; name: string; weightOz: number }[];
  /** Jars that left on orders, with what each jar weighed. */
  orderItems: { varietyId: string | null; quantity: number; jarWeightOz: number }[];
  allocations: { varietyId: string | null; quantity: number; jarWeightOz: number }[];
};

export type ShelfEntry = {
  varietyId: string;
  name: string;
  /** Ounces still in the kitchen. */
  remaining: number;
  oldest: { code: string; madeOn: Date } | null;
};

const weightFor = (
  rows: { varietyId: string | null; quantity: number; jarWeightOz: number }[],
  varietyId: string,
) =>
  rows
    .filter((r) => r.varietyId === varietyId)
    .reduce((sum, r) => sum + r.quantity * r.jarWeightOz, 0);

/** Weight of one kimchi still sitting in each batch, oldest batch first. */
export function batchStockFor(batches: BatchLike[], varietyId: string): BatchStock[] {
  return batches
    .map((batch) => ({
      batchId: batch.id,
      code: batch.code,
      madeOn: batch.madeOn,
      remaining: Math.max(
        batch.yields
          .filter((y) => y.varietyId === varietyId)
          .reduce((sum, y) => sum + y.weightOz, 0) -
          weightFor(batch.orderItems, varietyId) -
          weightFor(batch.allocations, varietyId),
        0,
      ),
    }))
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.madeOn.getTime() - b.madeOn.getTime() || a.code.localeCompare(b.code));
}

export function shelfByVariety(batches: BatchLike[]): ShelfEntry[] {
  const names = new Map<string, string>();
  for (const batch of batches) {
    for (const y of batch.yields) names.set(y.varietyId, y.name);
  }

  const entries: ShelfEntry[] = [];

  for (const [varietyId, name] of names) {
    const stock = batchStockFor(batches, varietyId);
    entries.push({
      varietyId,
      name,
      remaining: stock.reduce((sum, b) => sum + b.remaining, 0),
      oldest: stock.length > 0 ? { code: stock[0].code, madeOn: stock[0].madeOn } : null,
    });
  }

  return entries.sort((a, b) => {
    // Oldest stock first: that is what wants using.
    if (a.oldest && b.oldest) return a.oldest.madeOn.getTime() - b.oldest.madeOn.getTime();
    if (a.oldest) return -1;
    if (b.oldest) return 1;
    return a.name.localeCompare(b.name);
  });
}
