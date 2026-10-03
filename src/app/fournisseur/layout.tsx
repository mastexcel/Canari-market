import { requireRole } from "@/lib/session";
import { ProShell } from "@/ui/pro/ProShell";

export const metadata = { title: { default: "Espace fournisseur", template: "%s · Fournisseur Sesam-Market" } };

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["SUPPLIER"], "/fournisseur");
  return (
    <ProShell
      title="Espace fournisseur"
      user={user.firstName}
      nav={[
        { href: "/fournisseur", label: "Tableau de bord", emoji: "📊" },
        { href: "/fournisseur/commandes", label: "Bons de commande", emoji: "📦" },
        { href: "/fournisseur/produits", label: "Produits & tarifs", emoji: "🏷️" },
      ]}
    >
      {children}
    </ProShell>
  );
}
