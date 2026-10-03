import { requireRole } from "@/lib/session";
import { ProShell } from "@/ui/pro/ProShell";

export const metadata = { title: { default: "Point relais", template: "%s · Point relais Sesam-Market" } };

export default async function PickupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["PICKUP_POINT"], "/point-relais");
  return (
    <ProShell title="Point Sesam" user={user.firstName} nav={[{ href: "/point-relais", label: "Mon point", emoji: "📍" }]}>
      <div className="mx-auto max-w-2xl">{children}</div>
    </ProShell>
  );
}
