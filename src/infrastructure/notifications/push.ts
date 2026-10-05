/**
 * Expédition des notifications push.
 *  - Web Push (navigateurs, site installé) : clés VAPID (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 *  - FCM (application Android, et iOS via Firebase) : compte de service Firebase
 *    (FCM_SERVICE_ACCOUNT, JSON encodé en base64), API HTTP v1.
 * Sans clés, l'envoi est journalisé et considéré comme non effectué : rien n'est perdu
 * (la notification reste visible dans l'application).
 */
import { createSign } from "node:crypto";
import webpush from "web-push";
import { logger } from "../logger";

export interface PushPayload {
  title: string;
  body: string;
  /** Page ouverte au toucher de la notification (chemin du site). */
  url: string;
}

export interface PushTarget {
  kind: "WEB" | "FCM";
  endpoint: string;
  p256dh?: string | null;
  auth?: string | null;
}

/** ok : remis au service push ; gone : abonnement expiré, à supprimer. */
export type PushResult = { ok: boolean; gone?: boolean; error?: string };

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function pushConfigured() {
  return { web: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), fcm: Boolean(process.env.FCM_SERVICE_ACCOUNT) };
}

async function sendWeb(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !target.p256dh || !target.auth) return { ok: false, error: "web push non configuré" };
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        TTL: 24 * 3600,
        urgency: "normal",
        vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:contact@sesam-market.ci", publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
      },
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 404 || status === 410, error: `web push ${status ?? ""} ${(e as Error).message}`.trim() };
  }
}

// ─── FCM (API HTTP v1) ─────────────────────────────────────────

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let fcmToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json) as ServiceAccount;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** Jeton OAuth 2 du compte de service (JWT signé RS256), mis en cache ~55 min. */
async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return fcmToken.value;
}

async function sendFcm(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: "fcm non configuré" };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await fcmAccessToken(sa)}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: target.endpoint,
          notification: { title: payload.title, body: payload.body },
          data: { url: payload.url },
          android: { priority: "high", notification: { icon: "ic_stat_sesam", color: "#535f13", channel_id: "sesam" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    return { ok: false, gone: res.status === 404 || text.includes("UNREGISTERED"), error: `fcm ${res.status}` };
  } catch (e) {
    return { ok: false, error: `fcm ${(e as Error).message}` };
  }
}

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  const res = target.kind === "WEB" ? await sendWeb(target, payload) : await sendFcm(target, payload);
  if (!res.ok && !res.gone) logger.warn("push.failed", { kind: target.kind, error: res.error });
  return res;
}
