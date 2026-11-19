import Link from "next/link";
import { getDb } from "@/lib/scope";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { ALLOCATION_KINDS, type AllocationKindValue } from "@/lib/allocations";
import { formatWeight } from "@/lib/weight";
import { formatMoney } from "@/lib/money";
import { unitCosts, costOfJar } from "@/lib/costing";
import { AllocationEntryRow, type AllocationEntry } from "@/components/allocation-entry";

export const dynamic = "force-dynamic";

/** Newest first, because correcting an entry usually means a recent one. */
export default async function SetAsidePage() {
  const db = await getDb();

  const [rows, people, batches] = await Promise.all([
    db.batchAllocation.findMany({
      orderBy: [{ wentOutOn: "desc" }, { createdAt: "desc" }],
      include: {
        batch: { select: { id: true, code: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.batch.findMany({
      select: {
        yields: { select: { varietyId: true, weightOz: true } },
        costs: { select: { amount: true } },
      },
    }),
  ]);

  const entries: AllocationEntry[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    jarWeightOz: row.jarWeightOz,
    kind: row.kind as AllocationKindValue,
    note: row.note,
    wentOutOn: row.wentOutOn.toISOString(),
    customerId: row.customerId,
    customerName: row.customer?.name ?? null,
    batchId: row.batch.id,
    batchCode: row.batch.code,
  }));

  const jars = rows.reduce((sum, r) => sum + r.quantity, 0);
  const weight = rows.reduce((sum, r) => sum + r.quantity * r.jarWeightOz, 0);

  // What it cost to make, so a year of giving has a number against it.
  const costs = unitCosts(batches);
  const spent = rows.reduce((sum, r) => {
    const unit = r.varietyId ? costs.get(r.varietyId) : undefined;
    return sum + (unit ? costOfJar(unit, r.jarWeightOz) * r.quantity : 0);
  }, 0);

  const byKind = ALLOCATION_KINDS.map((kind) => ({
    ...kind,
    jars: rows.filter((r) => r.kind === kind.value).reduce((sum, r) => sum + r.quantity, 0),
  })).filter((k) => k.jars > 0);

  const named = rows.filter((r) => r.customerId).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">
          <span aria-hidden="true">🎁</span> Out without money
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Every jar that left without a sale. Tap one to say who got it, which day it went, and
          what it was for — none of it has to be right the moment you record it.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          Nothing set aside yet. Use{" "}
          <Link href="/" className="font-semibold text-danger underline">
            Keep or give away
          </Link>{" "}
          on the dashboard.
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Jars" value={String(jars)} hint="Never became revenue" />
            <StatCard label="Weight" value={formatWeight(weight)} />
            <StatCard
              label="Cost to make"
              value={formatMoney(spent)}
              hint="Spent, with no sale against it"
              tone="amber"
            />
            <StatCard
              label="Named to a person"
              value={`${named} of ${rows.length}`}
              hint={named === rows.length ? "All accounted for" : "Tap an entry to add a name"}
            />
          </section>

          {byKind.length > 0 ? (
            <section className="card divide-y divide-line">
              {byKind.map((kind) => (
                <div key={kind.value} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{kind.label}</p>
                    <p className="truncate text-xs text-fg-muted">{kind.hint}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-fg">{kind.jars}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section>
            <SectionHeading
              title="Every entry"
              subtitle={`${rows.length} ${rows.length === 1 ? "record" : "records"}, newest first`}
            />
            <div className="card divide-y divide-line px-4">
              {entries.map((entry) => (
                <AllocationEntryRow key={entry.id} entry={entry} people={people} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
