import { requireUser } from "@/lib/session";
import { listNotifications } from "@/application/notification.service";
import { formatDateTime } from "@/domain/dates";
import { PageHeader } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { MarkRead } from "./MarkRead";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const items = await listNotifications(user.id);
  const unread = items.some((n) => !n.readAt);
  return (
    <div>
      <PageHeader title="Notifications" action={unread ? <MarkRead /> : undefined} />
      {items.length === 0 ? (
        <EmptyState title="Rien de nouveau" emoji="🔔">Vous serez prévenu de l&apos;avancement de vos achats groupés et commandes.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ${n.readAt ? "bg-white" : "border-l-4 border-bordeaux-600 bg-bordeaux-50"}`}>
              <p className="font-bold">{n.title}</p>
              <p className="mt-0.5 text-sm text-anthracite-700">{n.body}</p>
              <p className="mt-1 text-xs text-anthracite-500">{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
