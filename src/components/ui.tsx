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
  // A soft wash fading into the card, so a row of tiles reads as colourful
  // without any one of them shouting over the figure it holds.
  const tones = {
    neutral: "border-line bg-gradient-to-br from-surface-2/70 to-surface",
    rose: "border-danger-line bg-gradient-to-br from-danger-soft to-surface",
    violet: "border-info-line bg-gradient-to-br from-info-soft to-surface",
    emerald: "border-success-line bg-gradient-to-br from-success-soft to-surface",
    amber: "border-warn-line bg-gradient-to-br from-warn-soft to-surface",
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
    <Link href={href} className="lift block">
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
    <div className="card border-dashed p-6 text-center text-sm text-fg-muted">{children}</div>
  );
}
