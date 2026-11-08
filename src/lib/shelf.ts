import { splitOldestFirst, type BatchStock } from "./allocate-fifo";

/**
 * What is physically left in each batch, and therefore how old the oldest jar
 * of a product on the shelf is. That age is the one worth seeing: the total
 * tells you how much there is, this tells you what to move first.
 */

export type BatchLike = {
  id: string;
  code: string;
  madeOn: Date;
  items: { productId: string; name: string; quantity: number }[];
  orderItems: { productId: string; quantity: number }[];
  allocations: { productId: string; quantity: number }[];
};

export type ShelfEntry = {
  productId: string;
  name: string;
  remaining: number;
  /** The oldest batch still holding one of these. */
  oldest: { code: string; madeOn: Date } | null;
};

const sumFor = (rows: { productId: string; quantity: number }[], productId: string) =>
  rows.filter((r) => r.productId === productId).reduce((sum, r) => sum + r.quantity, 0);

/** Jars of one product still sitting in each batch, oldest batch first. */
export function batchStockFor(batches: BatchLike[], productId: string): BatchStock[] {
  return batches
    .map((batch) => ({
      batchId: batch.id,
      code: batch.code,
      madeOn: batch.madeOn,
      remaining: Math.max(
        sumFor(batch.items, productId) -
          sumFor(batch.orderItems, productId) -
          sumFor(batch.allocations, productId),
        0,
      ),
    }))
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.madeOn.getTime() - b.madeOn.getTime() || a.code.localeCompare(b.code));
}

export function shelfByProduct(batches: BatchLike[]): ShelfEntry[] {
  const names = new Map<string, string>();
  for (const batch of batches) {
    for (const item of batch.items) names.set(item.productId, item.name);
  }

  const entries: ShelfEntry[] = [];

  for (const [productId, name] of names) {
    const stock = batchStockFor(batches, productId);
    const remaining = stock.reduce((sum, b) => sum + b.remaining, 0);
    entries.push({
      productId,
      name,
      remaining,
      oldest: stock.length > 0 ? { code: stock[0].code, madeOn: stock[0].madeOn } : null,
    });
  }

  return entries.sort((a, b) => {
    // Oldest stock first: that is what wants selling.
    if (a.oldest && b.oldest) return a.oldest.madeOn.getTime() - b.oldest.madeOn.getTime();
    if (a.oldest) return -1;
    if (b.oldest) return 1;
    return a.name.localeCompare(b.name);
  });
}

export { splitOldestFirst };
