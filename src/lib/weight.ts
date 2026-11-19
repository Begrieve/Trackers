/**
 * Kimchi is made by weight and sold by the jar.
 *
 * Weight is stored as whole ounces, for the same reason money is stored as
 * whole cents: a batch gets added to, drawn down and divided repeatedly, and
 * fractions of a pound would drift. A pound is exactly 16 ounces, so nothing
 * is lost by it.
 */

export const OZ_PER_LB = 16;

/** "38 lb", "2 lb 4 oz", "12 oz". */
export function formatWeight(oz: number): string {
  if (!Number.isFinite(oz)) return "—";
  const sign = oz < 0 ? "-" : "";
  const total = Math.abs(Math.round(oz));

  const lb = Math.floor(total / OZ_PER_LB);
  const rest = total % OZ_PER_LB;

  if (lb === 0) return `${sign}${rest} oz`;
  if (rest === 0) return `${sign}${lb} lb`;
  return `${sign}${lb} lb ${rest} oz`;
}

/** Just the pounds, for a tight space: "38 lb", "2.5 lb". */
export function formatPounds(oz: number): string {
  if (!Number.isFinite(oz)) return "—";
  const lb = oz / OZ_PER_LB;
  return `${Number.isInteger(lb) ? lb : lb.toFixed(1)} lb`;
}

/**
 * Reads what someone would type into a weight box. A bare number is pounds,
 * because that is how a batch is weighed; "12 oz" is respected when given.
 * Throws on anything it cannot read, rather than guessing a number.
 */
export function parseWeight(input: string): number {
  const text = input.trim().toLowerCase();
  if (!text) throw new Error("empty");

  // "2 lb 4 oz"
  const both = text.match(/^(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\s+(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)$/);
  if (both) return Math.round(Number(both[1]) * OZ_PER_LB + Number(both[2]));

  const single = text.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!single) throw new Error("unreadable");

  const amount = Number(single[1]);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("unreadable");

  const unit = single[2];
  if (unit === "oz" || unit === "ounce" || unit === "ounces") return Math.round(amount);
  if (unit === "" || unit === "lb" || unit === "lbs" || unit === "pound" || unit === "pounds") {
    return Math.round(amount * OZ_PER_LB);
  }
  throw new Error("unknown unit");
}

/** Whole jars a weight could fill. A part-full jar is not a jar. */
export function jarsFrom(weightOz: number, jarWeightOz: number): number {
  if (jarWeightOz <= 0) return 0;
  return Math.max(Math.floor(weightOz / jarWeightOz), 0);
}

/** What a number of jars weighs. */
export function weightOfJars(jars: number, jarWeightOz: number): number {
  return Math.max(jars, 0) * Math.max(jarWeightOz, 0);
}

/**
 * Reads the jar-size box, which is labelled in ounces.
 *
 * A bare number here means ounces — the opposite of a batch weight box, where
 * a bare number means pounds. The two read differently because a jar is
 * described in ounces ("a 16 oz jar") and a cook is weighed in pounds. Spell
 * out a unit and it is honoured either way, so "1 lb" and "16 oz" both work.
 */
export function parseJarWeight(input: string): number {
  const text = input.trim();
  if (!text) throw new Error("empty");
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const oz = Math.round(Number(text));
    if (oz <= 0) throw new Error("not a size");
    return oz;
  }
  const oz = parseWeight(text);
  if (oz <= 0) throw new Error("not a size");
  return oz;
}

/**
 * A jar size, always in ounces: "11 oz", "32 oz".
 *
 * A jar is named by its ounces even when it holds more than a pound — nobody
 * asks for a 2 lb jar — so sizes are not folded into pounds the way a cook's
 * weight is.
 */
export function formatJarSize(oz: number): string {
  return `${Math.round(oz)} oz`;
}
