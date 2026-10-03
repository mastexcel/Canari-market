/**
 * Numéros ivoiriens (plan à 10 chiffres depuis 2021).
 * Mobiles : 01 (Moov), 05 (MTN), 07 (Orange). Fixes : 21, 25, 27.
 */
import { DomainError } from "./errors";

const VALID_PREFIXES = ["01", "05", "07", "21", "25", "27"];

/** Normalise en E.164 (+225XXXXXXXXXX) ou lève une erreur de validation. */
export function normalizeIvorianPhone(input: string): string {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("225") && digits.length === 13) digits = digits.slice(3);
  if (!/^\d{10}$/.test(digits) || !VALID_PREFIXES.includes(digits.slice(0, 2))) {
    throw new DomainError("VALIDATION", "Numéro invalide. Exemple : 07 07 12 34 56.");
  }
  return `+225${digits}`;
}

export function isMobile(e164: string): boolean {
  return ["01", "05", "07"].includes(e164.slice(4, 6));
}

/** « +225 07 07 12 34 56 » */
export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+225/, "");
  return `+225 ${d.replace(/(\d{2})(?=\d)/g, "$1 ")}`.trim();
}

/** Opérateur Mobile Money probable selon le préfixe. */
export function guessOperator(e164: string): "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | null {
  const p = e164.slice(4, 6);
  if (p === "07") return "ORANGE_MONEY";
  if (p === "05") return "MTN_MOMO";
  if (p === "01") return "MOOV_MONEY";
  return null;
}
