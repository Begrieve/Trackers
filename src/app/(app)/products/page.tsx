import { getDb } from "@/lib/scope";
import { EmptyState } from "@/components/ui";
import { AddProduct, EditProduct } from "./product-forms";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const db = await getDb();
  const [products, varieties] = await Promise.all([
    db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.variety.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Products</h1>
          <p className="text-sm text-fg-muted">
            Each jar belongs to a kimchi type and holds a weight. Batches are weighed against the
            type, and jars are filled from that weight. Prices fill in new orders; changing one
            never rewrites an order already placed.
          </p>
        </div>
        <AddProduct varieties={varieties} />
      </div>

      {products.length === 0 ? (
        <EmptyState>No products yet. Add your first jar size and price.</EmptyState>
      ) : (
        <div className="card divide-y divide-line">
          {products.map((product) => (
            <div key={product.id} className={`p-4 ${product.active ? "" : "opacity-60"}`}>
              <EditProduct product={product} varieties={varieties} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
