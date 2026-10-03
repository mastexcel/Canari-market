export const GB_STATUS: Record<string, { label: string; tone: "neutral" | "economie" | "accent" | "alerte" | "brand" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  OPEN: { label: "Ouvert", tone: "economie" },
  CLOSED_SUCCESS: { label: "Seuil atteint", tone: "brand" },
  CLOSED_FAILED: { label: "Non abouti", tone: "alerte" },
  CANCELLED: { label: "Annulé", tone: "alerte" },
  COMPLETED: { label: "Terminé", tone: "accent" },
};
