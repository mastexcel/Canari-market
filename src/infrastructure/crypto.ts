import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Code numérique (OTP de retrait/livraison). */
export function numericCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I ambigus

export function humanCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}
