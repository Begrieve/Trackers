import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/money";
import { BatchForm } from "@/components/batch-form";
import { updateBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [batch, products] = await Promise.all([
    prisma.batch.findUnique({ where: { id }, include: { items: true, costs: true } }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unitLabel: true },
    }),
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
          Change the details, costs or jar counts as often as you need. The code {batch.code} stays
          the same, so anything already traced to it stays traced.
        </p>
      </div>

      <BatchForm
        products={products}
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
          items: batch.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          costs: batch.costs.map((c) => ({ label: c.label, amount: c.amount })),
        }}
      />
    </div>
  );
}
