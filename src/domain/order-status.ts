/**
 * Cycle de vie des commandes.
 * Chaque ligne a son propre statut (une commande peut mêler plusieurs achats
 * groupés et du stock) ; le statut de la commande est dérivé de ses lignes,
 * puis piloté par la livraison une fois tout prêt.
 */
import { DomainError } from "./errors";

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "GROUP_PENDING",
  "GROUP_CONFIRMED",
  "SUPPLIER_ORDERED",
  "SUPPLIER_CONFIRMED",
  "RECEIVED_WAREHOUSE",
  "PACKING",
  "READY",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const RANK: Record<OrderStatus, number> = {
  DRAFT: 0,
  PENDING_PAYMENT: 1,
  PAID: 2,
  GROUP_PENDING: 3,
  GROUP_CONFIRMED: 4,
  SUPPLIER_ORDERED: 5,
  SUPPLIER_CONFIRMED: 6,
  RECEIVED_WAREHOUSE: 7,
  PACKING: 8,
  READY: 9,
  OUT_FOR_DELIVERY: 10,
  READY_FOR_PICKUP: 10,
  DELIVERED: 11,
  CANCELLED: -1,
  REFUNDED: -1,
};

export function statusRank(s: OrderStatus): number {
  return RANK[s];
}

export function isTerminal(s: OrderStatus): boolean {
  return s === "DELIVERED" || s === "CANCELLED" || s === "REFUNDED";
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "GROUP_PENDING", "RECEIVED_WAREHOUSE", "CANCELLED"],
  PAID: ["GROUP_PENDING", "RECEIVED_WAREHOUSE", "PACKING", "CANCELLED", "REFUNDED"],
  GROUP_PENDING: ["GROUP_CONFIRMED", "REFUNDED", "CANCELLED"],
  GROUP_CONFIRMED: ["SUPPLIER_ORDERED", "REFUNDED"],
  SUPPLIER_ORDERED: ["SUPPLIER_CONFIRMED", "GROUP_CONFIRMED", "REFUNDED"],
  SUPPLIER_CONFIRMED: ["RECEIVED_WAREHOUSE", "REFUNDED"],
  RECEIVED_WAREHOUSE: ["PACKING", "REFUNDED"],
  PACKING: ["READY", "REFUNDED"],
  READY: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "REFUNDED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "READY", "READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["DELIVERED", "READY"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_STATE", `Transition de commande interdite : ${from} → ${to}.`);
  }
}

/**
 * Statut de commande dérivé des lignes : la ligne la moins avancée l'emporte
 * (on ne livre que lorsque tout est prêt). Les lignes annulées/remboursées
 * sont ignorées tant qu'il reste une ligne active.
 */
export function deriveOrderStatus(itemStatuses: readonly OrderStatus[]): OrderStatus {
  if (itemStatuses.length === 0) return "DRAFT";
  const active = itemStatuses.filter((s) => s !== "CANCELLED" && s !== "REFUNDED");
  if (active.length === 0) {
    return itemStatuses.every((s) => s === "CANCELLED") ? "CANCELLED" : "REFUNDED";
  }
  return active.reduce((min, s) => (RANK[s] < RANK[min] ? s : min));
}

// ─── Libellés & frise chronologique ────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Brouillon",
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  GROUP_PENDING: "Achat groupé en cours",
  GROUP_CONFIRMED: "Achat groupé confirmé",
  SUPPLIER_ORDERED: "Commandée au fournisseur",
  SUPPLIER_CONFIRMED: "Confirmée par le fournisseur",
  RECEIVED_WAREHOUSE: "Reçue à l'entrepôt",
  PACKING: "En préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En cours de livraison",
  READY_FOR_PICKUP: "Disponible au point relais",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export interface TimelineStep {
  status: OrderStatus;
  label: string;
  state: "done" | "current" | "upcoming";
}

/** Étapes affichées dans le suivi, adaptées au mode et au contenu de la commande. */
export function buildTimeline(
  current: OrderStatus,
  opts: { mode: "PICKUP" | "HOME_DELIVERY"; hasGroupItems: boolean },
): TimelineStep[] {
  const steps: OrderStatus[] = ["PENDING_PAYMENT", "PAID"];
  if (opts.hasGroupItems) {
    steps.push("GROUP_PENDING", "GROUP_CONFIRMED", "SUPPLIER_ORDERED", "SUPPLIER_CONFIRMED");
  }
  steps.push("RECEIVED_WAREHOUSE", "PACKING", "READY");
  steps.push(opts.mode === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY", "DELIVERED");

  if (current === "CANCELLED" || current === "REFUNDED") {
    return [
      ...steps.slice(0, 1).map((s) => ({ status: s, label: ORDER_STATUS_LABELS[s], state: "done" as const })),
      { status: current, label: ORDER_STATUS_LABELS[current], state: "current" as const },
    ];
  }

  const rank = RANK[current];
  return steps.map((s) => {
    const r = RANK[s];
    let state: TimelineStep["state"] = r < rank ? "done" : r === rank ? "current" : "upcoming";
    if (current === "DELIVERED" && s === "DELIVERED") state = "done";
    return { status: s, label: ORDER_STATUS_LABELS[s], state };
  });
}
