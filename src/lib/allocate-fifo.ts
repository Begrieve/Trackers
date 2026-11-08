/**
 * Picking which batch a jar comes from.
 *
 * Setting a jar aside is something you think about by product — "I'm keeping a
 * napa for us" — not by batch. The batch still has to be recorded, or the
 * traceability is worthless, so it's chosen here rather than asked for: oldest
 * stock first, which is both the honest answer for food and what anyone would
 * do reaching into the fridge.
 */

export type BatchStock = {
  batchId: string;
  code: string;
  madeOn: Date;
  /** Jars of this product the batch still holds. */
  remaining: number;
};

export type Split = { batchId: string; code: string; quantity: number };

export type SplitResult = {
  splits: Split[];
  /** Jars that could not be covered by any batch. */
  short: number;
};

export function splitOldestFirst(batches: BatchStock[], wanted: number): SplitResult {
  if (wanted <= 0) return { splits: [], short: 0 };

  const ordered = [...batches]
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.madeOn.getTime() - b.madeOn.getTime() || a.code.localeCompare(b.code));

  const splits: Split[] = [];
  let left = wanted;

  for (const batch of ordered) {
    if (left === 0) break;
    const take = Math.min(left, batch.remaining);
    splits.push({ batchId: batch.batchId, code: batch.code, quantity: take });
    left -= take;
  }

  return { splits, short: left };
}

/** How many jars of a product are actually available across every batch. */
export function totalRemaining(batches: BatchStock[]): number {
  return batches.reduce((sum, b) => sum + Math.max(b.remaining, 0), 0);
}
