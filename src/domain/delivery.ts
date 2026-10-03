/**
 * Tarification de la livraison et créneaux.
 * Abidjan est en UTC+0 toute l'année (pas d'heure d'été) : les créneaux sont
 * calculés en UTC sans conversion.
 */
import { applyBps } from "./money";
import { invariant } from "./errors";

export interface ZoneTariff {
  baseFee: number;
  includedWeightKg: number;
  perKgFee: number;
  distanceKm: number;
  perKmFee: number;
  scheduledSurcharge: number;
}

export interface DeliveryBenefits {
  /** Point relais gratuit (avantage communauté) */
  pickupFeeWaived: boolean;
  /** Remise sur la livraison à domicile, en bps */
  homeDiscountBps: number;
}

export const NO_BENEFITS: DeliveryBenefits = { pickupFeeWaived: false, homeDiscountBps: 0 };

/** Article encombrant : au-delà de ce poids, un supplément de manutention s'applique. */
export const BULKY_ITEM_WEIGHT_G = 25_000;
export const BULKY_ITEM_SURCHARGE = 200;

export interface FeeBreakdown {
  base: number;
  weight: number;
  distance: number;
  bulky: number;
  scheduled: number;
  discount: number;
  total: number;
}

export function computeHomeDeliveryFee(
  zone: ZoneTariff,
  input: { weightGrams: number; bulkyItems: number; speed: "STANDARD" | "SCHEDULED" },
  benefits: DeliveryBenefits = NO_BENEFITS,
): FeeBreakdown {
  invariant(input.weightGrams >= 0, "Poids invalide.");
  const kg = Math.ceil(input.weightGrams / 1000);
  const base = zone.baseFee;
  const weight = Math.max(0, kg - zone.includedWeightKg) * zone.perKgFee;
  const distance = zone.distanceKm * zone.perKmFee;
  const bulky = input.bulkyItems * BULKY_ITEM_SURCHARGE;
  const scheduled = input.speed === "SCHEDULED" ? zone.scheduledSurcharge : 0;
  const gross = base + weight + distance + bulky + scheduled;
  const discount = applyBps(gross, benefits.homeDiscountBps);
  return { base, weight, distance, bulky, scheduled, discount, total: gross - discount };
}

export function computePickupFee(customerFee: number, benefits: DeliveryBenefits = NO_BENEFITS): FeeBreakdown {
  const discount = benefits.pickupFeeWaived ? customerFee : 0;
  return { base: customerFee, weight: 0, distance: 0, bulky: 0, scheduled: 0, discount, total: customerFee - discount };
}

/** Rémunération livreur : fixe + part distance (paramétrable). */
export function computeDriverFee(distanceKm: number, weightGrams: number): number {
  return 500 + distanceKm * 50 + Math.max(0, Math.ceil(weightGrams / 1000) - 20) * 10;
}

// ─── Créneaux ───────────────────────────────────────────────

export interface Slot {
  start: Date;
  end: Date;
  label: string;
}

const WINDOWS: Array<[number, number]> = [
  [8, 12],
  [14, 18],
];

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Créneaux disponibles à partir de la date où la commande sera prête.
 * Pas de livraison le dimanche.
 */
export function generateSlots(readyAt: Date, days = 5): Slot[] {
  const slots: Slot[] = [];
  const day = new Date(Date.UTC(readyAt.getUTCFullYear(), readyAt.getUTCMonth(), readyAt.getUTCDate()));
  while (slots.length < days * WINDOWS.length) {
    if (day.getUTCDay() !== 0) {
      for (const [h1, h2] of WINDOWS) {
        const start = new Date(day.getTime() + h1 * 3_600_000);
        const end = new Date(day.getTime() + h2 * 3_600_000);
        if (start >= readyAt) {
          slots.push({ start, end, label: `${dayFmt.format(start)}, ${h1} h – ${h2} h` });
        }
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return slots.slice(0, days * WINDOWS.length);
}

export function isValidSlot(readyAt: Date, start: Date, end: Date): boolean {
  return generateSlots(readyAt, 14).some((s) => s.start.getTime() === start.getTime() && s.end.getTime() === end.getTime());
}
