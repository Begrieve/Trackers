/**
 * Batch codes look like B-260907-2: the second batch recorded for 7 Sept 2026.
 *
 * Short enough to write on a jar lid, and it carries the date on its face, so a
 * complaint months later can be traced without opening the app.
 */

export function batchCodePrefix(madeOn: Date): string {
  const yy = String(madeOn.getFullYear()).slice(-2);
  const mm = String(madeOn.getMonth() + 1).padStart(2, "0");
  const dd = String(madeOn.getDate()).padStart(2, "0");
  return `B-${yy}${mm}${dd}`;
}

/**
 * Next free code for a day, given the codes already used with that prefix.
 * Counts from the highest number in use rather than the number of codes, so
 * deleting a batch never causes the next one to reuse a retired code.
 */
export function nextBatchCode(madeOn: Date, existing: string[]): string {
  const prefix = batchCodePrefix(madeOn);
  let highest = 0;

  for (const code of existing) {
    if (!code.startsWith(`${prefix}-`)) continue;
    const suffix = Number(code.slice(prefix.length + 1));
    if (Number.isInteger(suffix) && suffix > highest) highest = suffix;
  }

  return `${prefix}-${highest + 1}`;
}
