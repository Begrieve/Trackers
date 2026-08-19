import Link from "next/link";
import { prisma } from "@/lib/db";
import { BatchForm } from "./batch-form";

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
      </div>

      <BatchForm products={products} />
    </div>
  );
}
