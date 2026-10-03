import { requireRole } from "@/lib/session";
import { ProShell } from "@/ui/pro/ProShell";

export const metadata = { title: { default: "Espace livreur", template: "%s · Livreur Sesam-Market" } };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["DRIVER"], "/livreur");
  return (
    <ProShell title="Espace livreur" user={user.firstName} nav={[{ href: "/livreur", label: "Mes missions", emoji: "🛵" }]}>
      <div className="mx-auto max-w-lg">{children}</div>
    </ProShell>
  );
}
