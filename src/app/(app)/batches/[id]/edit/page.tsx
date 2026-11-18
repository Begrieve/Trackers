import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/scope";
import { toDateInputValue } from "@/lib/money";
import { BatchForm } from "@/components/batch-form";
import { updateBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const { id } = await params;

  const [batch, varieties] = await Promise.all([
    db.batch.findUnique({ where: { id }, include: { yields: true, costs: true } }),
    db.variety.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!batch) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/batches/${batch.id}`} className="text-sm font-medium text-fg-muted hover:text-fg">
          ← {batch.code}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">Edit batch</h1>
        <p className="text-sm text-fg-muted">
          Change the details, costs or weights as often as you need. The code {batch.code} stays
          the same, so anything already traced to it stays traced.
        </p>
      </div>

      <BatchForm
        varieties={varieties}
        action={updateBatch}
        defaultMadeOn={toDateInputValue(new Date())}
        submitLabel="Save changes"
        cancelHref={`/batches/${batch.id}`}
        initial={{
          id: batch.id,
          label: batch.label,
          madeOn: batch.madeOn,
          readyOn: batch.readyOn,
          notes: batch.notes,
          yields: batch.yields.map((y) => ({ varietyId: y.varietyId, weightOz: y.weightOz })),
          costs: batch.costs.map((c) => ({ label: c.label, amount: c.amount })),
        }}
      />
    </div>
  );
}
