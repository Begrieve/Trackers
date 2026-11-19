import { getDb } from "@/lib/scope";
import { EmptyState } from "@/components/ui";
import { formatJarSize } from "@/lib/weight";
import { AddProduct, EditProduct } from "./product-forms";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const db = await getDb();
  const [products, varieties] = await Promise.all([
    db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.variety.findMany({ orderBy: { name: "asc" } }),
  ]);

  // A jar is a size of some kimchi, so the sizes are shown under the kimchi
  // they belong to — largest first, which is the order they get offered in.
  const groups = varieties
    .map((variety) => ({
      variety,
      jars: products
        .filter((p) => p.varietyId === variety.id)
        .sort((a, b) => b.jarWeightOz - a.jarWeightOz),
    }))
    .filter((group) => group.jars.length > 0);

  const unassigned = products.filter(
    (p) => !p.varietyId || !varieties.some((v) => v.id === p.varietyId),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Products</h1>
          <p className="text-sm text-fg-muted">
            Each jar is a size of some kimchi and holds a weight. Batches are weighed against the
            kimchi, and jars of any size are filled from that weight — so adding a size never
            means restating a cook. Prices fill in new orders; changing one never rewrites an
            order already placed.
          </p>
        </div>
        <AddProduct varieties={varieties} />
      </div>

      {products.length === 0 ? (
        <EmptyState>No jars yet. Add your first size and price.</EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(({ variety, jars }) => (
            <section key={variety.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
                <h2 className="font-bold text-fg">
                  <span aria-hidden="true">🥬</span> {variety.name}
                </h2>
                <p className="text-sm text-fg-muted">
                  {jars.length} {jars.length === 1 ? "size" : "sizes"} ·{" "}
                  {jars.map((j) => formatJarSize(j.jarWeightOz)).join(" · ")}
                </p>
              </div>
              <div className="card divide-y divide-line">
                {jars.map((product) => (
                  <div key={product.id} className={`p-4 ${product.active ? "" : "opacity-60"}`}>
                    <EditProduct product={product} varieties={varieties} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {unassigned.length > 0 ? (
            <section className="space-y-2">
              <div className="px-1">
                <h2 className="font-bold text-fg">No kimchi type set</h2>
                <p className="text-sm text-fg-muted">
                  These jars can be ordered, but nothing ties them to a cook. Set a type and they
                  start drawing from batches.
                </p>
              </div>
              <div className="card divide-y divide-line">
                {unassigned.map((product) => (
                  <div key={product.id} className={`p-4 ${product.active ? "" : "opacity-60"}`}>
                    <EditProduct product={product} varieties={varieties} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
