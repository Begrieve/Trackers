import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewOrderForm } from "./new-order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unitLabel: true, unitPrice: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/orders" className="text-sm font-medium text-fg-muted hover:text-fg">
          ← Orders
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">New order</h1>
      </div>

      <NewOrderForm customers={customers} products={products} />
    </div>
  );
}
