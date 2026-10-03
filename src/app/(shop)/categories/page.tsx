import Link from "next/link";
import { listCategories } from "@/application/catalog.service";
import { PageHeader } from "@/ui/Card";

export const metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const cats = await listCategories();
  return (
    <div>
      <PageHeader title="Catégories" />
      <ul className="grid grid-cols-2 gap-3">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/categories/${c.slug}`} className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
              <span className="text-4xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="font-bold">{c.name}</span>
              <span className="text-xs text-anthracite-600">{c._count.products} produits</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
