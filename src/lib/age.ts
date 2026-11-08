/**
 * How old something is, in the words you'd actually use.
 *
 * Kimchi keeps changing in the jar, so age is a thing you want to read at a
 * glance rather than work out from a date. Deliberately plain: this reports
 * age, it does not judge whether something is still good — that is the cook's
 * call, not the ledger's.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Whole days between two dates, counted by calendar day rather than by hours. */
export function ageInDays(made: Date | string, now: Date = new Date()): number {
  const then = new Date(made);
  const a = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / DAY);
}

export function formatAge(made: Date | string, now: Date = new Date()): string {
  const days = ageInDays(made, now);

  if (days < 0) return "not yet made";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days old`;

  const weeks = Math.floor(days / 7);
  if (days < 60) return `${weeks} weeks old`;

  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months old`;

  return `${Math.floor(days / 365)} years old`;
}

/** Short form for a pill beside a heading: 3d, 2w, 5mo. */
export function shortAge(made: Date | string, now: Date = new Date()): string {
  const days = ageInDays(made, now);
  if (days < 0) return "—";
  if (days === 0) return "today";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  if (days < 730) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
