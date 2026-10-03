"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { useCommand } from "@/ui/pro/Command";

export function AssignDriver({ orderId, drivers }: { orderId: string; drivers: Array<{ id: string; label: string }> }) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const { send, busy } = useCommand("admin");
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`d-${orderId}`}>
        Livreur
      </label>
      <select id={`d-${orderId}`} value={driverId} onChange={(e) => setDriverId(e.target.value)} className="h-9 rounded-lg border border-gris-300 bg-white px-2 text-sm">
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <Button size="sm" loading={busy} onClick={() => send({ type: "logistics.assignDriver", orderId, driverId }, "Mission envoyée")}>
        Attribuer
      </Button>
    </div>
  );
}
