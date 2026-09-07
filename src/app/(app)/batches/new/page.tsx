import Link from "next/link";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/money";
import { BatchForm } from "@/components/batch-form";
import { createBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unitLabel: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/batches" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← Batches
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">Record a batch</h1>
        <p className="text-sm text-fg-muted">
          It gets a code like B-260907-1 so you can trace a jar back here later.
        </p>
      </div>

      <BatchForm products={products} action={createBatch}
        defaultMadeOn={toDateInputValue(new Date())} />
    </div>
  );
}
