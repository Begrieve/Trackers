import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "rose" | "violet" | "emerald" | "amber";
  href?: string;
}) {
  const tones = {
    neutral: "border-stone-200",
    rose: "border-rose-200 bg-rose-50/60",
    violet: "border-violet-200 bg-violet-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    amber: "border-amber-200 bg-amber-50/60",
  } as const;

  const valueTone = {
    neutral: "text-stone-900",
    rose: "text-rose-800",
    violet: "text-violet-800",
    emerald: "text-emerald-800",
    amber: "text-amber-800",
  } as const;

  const body = (
    <div className={`card h-full p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${valueTone[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-stone-900">{title}</h2>
        {subtitle ? <p className="text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-6 text-center text-sm text-stone-500">{children}</div>
  );
}
