import Link from "next/link";
import { getDb } from "@/lib/scope";
import { toDateInputValue } from "@/lib/money";
import { BatchForm } from "@/components/batch-form";
import { createBatch } from "@/actions/batches";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const db = await getDb();
  const varieties = await db.variety.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/batches" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← Batches
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">Record a batch</h1>
        <p className="text-sm text-fg-muted">
          It gets a code like B-260907-1 so you can trace a jar back here later. Fill in what you
          know now — the weight can wait until it&apos;s weighed, and everything stays editable.
        </p>
      </div>

      <BatchForm
        varieties={varieties}
        action={createBatch}
        defaultMadeOn={toDateInputValue(new Date())}
      />
    </div>
  );
}
