/**
 * Dates au format français. Abidjan = UTC+0 toute l'année.
 */
const TZ = "Africa/Abidjan";

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
}

export function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

export function formatWeekday(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d);
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export function weekdayName(i: number): string {
  return WEEKDAYS[((i % 7) + 7) % 7];
}

/** « dans 3 jours », « dans 5 h », « terminé » */
export function timeLeft(until: Date, now: Date): string {
  const ms = until.getTime() - now.getTime();
  if (ms <= 0) return "terminé";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `dans ${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (h < 48) return `dans ${h} h`;
  return `dans ${Math.floor(h / 24)} jours`;
}

/** Prochaine date (≥ aujourd'hui) tombant sur le jour de semaine donné. */
export function nextWeekday(weekday: number, from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const diff = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}
