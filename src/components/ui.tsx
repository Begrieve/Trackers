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
    neutral: "border-line",
    rose: "border-danger-line bg-danger-soft/50",
    violet: "border-info-line bg-info-soft/50",
    emerald: "border-success-line bg-success-soft/50",
    amber: "border-warn-line bg-warn-soft/50",
  } as const;

  const valueTone = {
    neutral: "text-fg",
    rose: "text-danger-fg",
    violet: "text-info-fg",
    emerald: "text-success-fg",
    amber: "text-warn-fg",
  } as const;

  const body = (
    <div className={`card h-full p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${valueTone[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
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
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        {subtitle ? <p className="text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-6 text-center text-sm text-fg-muted">{children}</div>
  );
}
