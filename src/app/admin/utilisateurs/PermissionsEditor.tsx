"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useCommand } from "@/ui/pro/Command";
import { ADMIN_PERMISSION_LABELS, type AdminPermission } from "@/domain/permissions";

export function PermissionsEditor({ userId, current }: { userId: string; current: AdminPermission[] }) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<AdminPermission[]>(current);
  const { send, busy } = useCommand("admin");
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Permissions
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Permissions administratives">
        <div className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto">
          {(Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermission[]).map((p) => (
            <Checkbox key={p} label={ADMIN_PERMISSION_LABELS[p]} checked={perms.includes(p)} onChange={(e) => setPerms(e.target.checked ? [...perms, p] : perms.filter((x) => x !== p))} />
          ))}
        </div>
        <Button className="mt-3" block loading={busy} onClick={async () => { if (await send({ type: "user.permissions", userId, permissions: perms }, "Permissions mises à jour")) setOpen(false); }}>
          Enregistrer
        </Button>
      </Modal>
    </>
  );
}
