/**
 * Tests API : on appelle les vrais handlers de route avec des NextRequest.
 * Couvre l'authentification, le RBAC granulaire, la protection CSRF,
 * l'idempotence, la validation et les webhooks signés.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/db";
import { createSession } from "@/application/auth.service";
import { getMockProvider } from "@/infrastructure/payments/registry";
import { POST as signupPOST } from "@/app/api/v1/auth/signup/route";
import { POST as loginPOST } from "@/app/api/v1/auth/login/route";
import { GET as meGET } from "@/app/api/v1/auth/me/route";
import { POST as cartItemsPOST } from "@/app/api/v1/cart/items/route";
import { POST as ordersPOST } from "@/app/api/v1/orders/route";
import { POST as paymentsPOST } from "@/app/api/v1/payments/route";
import { POST as webhookPOST } from "@/app/api/v1/webhooks/payments/[provider]/route";
import { POST as adminPOST } from "@/app/api/v1/admin/commands/route";
import { POST as supplierPOST } from "@/app/api/v1/supplier/commands/route";
import { POST as pickupPOST } from "@/app/api/v1/pickup/commands/route";
import { POST as jobsPOST } from "@/app/api/v1/jobs/run/route";
import { GET as exportGET } from "@/app/api/v1/account/export/route";
import { baseFixture, makeUser, resetDb } from "./helpers";

const ORIGIN = "http://localhost:3000";
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

function req(path: string, opts: { method?: string; body?: unknown; token?: string; origin?: string | null; headers?: Record<string, string>; raw?: string } = {}) {
  const headers = new Headers({ host: "localhost:3000", "content-type": "application/json", ...(opts.headers ?? {}) });
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.token) headers.set("cookie", `sesam_session=${opts.token}`);
  return new NextRequest(`${ORIGIN}/api/v1${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.raw ? "POST" : "GET"),
    headers,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
}

async function tokenFor(userId: string) {
  return (await createSession(userId)).token;
}

const signupBody = {
  firstName: "Mariam",
  phone: "05 05 44 33 22",
  password: "secret123",
  commune: "Yopougon",
  quartier: "Niangon",
  acceptTerms: true,
};

describe("API v1", () => {
  beforeEach(resetDb);

  it("inscription, cookie de session httpOnly, connexion et /me", async () => {
    const res = await signupPOST(req("/auth/signup", { body: signupBody }), ctx());
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/sesam_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const token = cookie.match(/sesam_session=([^;]+)/)![1];
    const me = await meGET(req("/auth/me", { token }), ctx());
    expect((await me.json()).user.firstName).toBe("Mariam");
    // Le mot de passe n'est jamais renvoyé
    expect(JSON.stringify(await (await loginPOST(req("/auth/login", { body: { phone: "0505443322", password: "secret123" } }), ctx())).json())).not.toMatch(/passwordHash/);
    // Mot de passe faible refusé avec message précis
    const weak = await signupPOST(req("/auth/signup", { body: { ...signupBody, phone: "0505443323", password: "abc" } }), ctx());
    expect(weak.status).toBe(400);
    expect((await weak.json()).error.code).toBe("VALIDATION");
  });

  it("refuse l'accès non authentifié et l'origine étrangère (CSRF)", async () => {
    expect((await meGET(req("/auth/me"), ctx())).status).toBe(401);
    const user = await makeUser();
    const token = await tokenFor(user.id);
    const csrf = await cartItemsPOST(req("/cart/items", { body: { kind: "STOCK", variantId: "x", quantity: 1 }, token, origin: "https://evil.example" }), ctx());
    expect(csrf.status).toBe(403);
    // Le jeton Bearer (apps mobiles) n'a pas besoin d'en-tête Origin
    const bearer = await meGET(new NextRequest(`${ORIGIN}/api/v1/auth/me`, { headers: { authorization: `Bearer ${token}` } }), ctx());
    expect(bearer.status).toBe(200);
  });

  it("verrouille le compte après 5 échecs de connexion", async () => {
    await signupPOST(req("/auth/signup", { body: signupBody }), ctx());
    for (let i = 0; i < 5; i++) {
      expect((await loginPOST(req("/auth/login", { body: { phone: "0505443322", password: "mauvais99" } }), ctx())).status).toBe(401);
    }
    const locked = await loginPOST(req("/auth/login", { body: { phone: "0505443322", password: "secret123" } }), ctx());
    expect(locked.status).toBe(429);
  });

  it("RBAC : un ménage ne peut pas utiliser les commandes admin ni fournisseur", async () => {
    const f = await baseFixture();
    const household = await makeUser();
    const t = await tokenFor(household.id);
    expect((await adminPOST(req("/admin/commands", { body: { type: "jobs.run" }, token: t }), ctx())).status).toBe(403);
    expect((await supplierPOST(req("/supplier/commands", { body: { type: "po.confirm", poId: "x" }, token: t }), ctx())).status).toBe(403);
    expect((await pickupPOST(req("/pickup/commands", { body: { type: "receive", orderNumber: "SES-000000-XXXXX" }, token: t }), ctx())).status).toBe(403);
    // Un livreur ne peut pas passer commande
    const driver = await makeUser("DRIVER");
    const td = await tokenFor(driver.id);
    expect((await cartItemsPOST(req("/cart/items", { body: { kind: "STOCK", variantId: f.variant.id, quantity: 1 }, token: td }), ctx())).status).toBe(403);
  });

  it("RBAC granulaire : un admin « opérations » ne peut ni rembourser ni changer les permissions", async () => {
    const f = await baseFixture();
    const ops = await prisma.user.update({ where: { id: (await makeUser("ADMIN")).id }, data: { adminPermissions: ["ORDERS_MANAGE", "LOGISTICS_MANAGE"] } });
    const t = await tokenFor(ops.id);
    const refund = await adminPOST(req("/admin/commands", { body: { type: "order.refund", orderId: "x", amount: 100, note: "test refus" }, token: t }), ctx());
    expect(refund.status).toBe(403);
    const perms = await adminPOST(req("/admin/commands", { body: { type: "user.permissions", userId: f.admin.id, permissions: [] }, token: t }), ctx());
    expect(perms.status).toBe(403);
    const publish = await adminPOST(req("/admin/commands", { body: { type: "groupbuy.publish", id: f.groupBuy.id }, token: t }), ctx());
    expect(publish.status).toBe(403);
  });

  it("commande idempotente et paiement via webhook signé", async () => {
    const f = await baseFixture();
    const user = await makeUser();
    const t = await tokenFor(user.id);
    expect((await cartItemsPOST(req("/cart/items", { body: { kind: "GROUP_BUY", portionId: f.portion(10).id, quantity: 1 }, token: t }), ctx())).status).toBe(200);
    const body = { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id };
    const r1 = await ordersPOST(req("/orders", { body, token: t, headers: { "idempotency-key": "k-1" } }), ctx());
    const r2 = await ordersPOST(req("/orders", { body, token: t, headers: { "idempotency-key": "k-1" } }), ctx());
    const o1 = (await r1.json()).order;
    const o2 = (await r2.json()).order;
    expect(o1.id).toBe(o2.id);
    expect(await prisma.order.count()).toBe(1);

    const pay = await paymentsPOST(req("/payments", { body: { orderId: o1.id, method: "MOBILE_MONEY", operator: "MTN_MOMO", payerPhone: "0505000000" }, token: t }), ctx());
    expect(pay.status).toBe(200);
    const { paymentId } = await pay.json();
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(p.payerPhoneMasked).toBe("+225 05 •• •• 00 00");

    const hook = getMockProvider().buildWebhook({ reference: p.providerRef!, status: "PAID", amount: p.amount });
    // Webhook non signé → 401
    const unsigned = await webhookPOST(new NextRequest(`${ORIGIN}/api/v1/webhooks/payments/mock`, { method: "POST", body: hook.body }), ctx({ provider: "mock" }));
    expect(unsigned.status).toBe(401);
    // Webhook signé → appliqué, puis rejeu → dédupliqué
    const ok = await webhookPOST(new NextRequest(`${ORIGIN}/api/v1/webhooks/payments/mock`, { method: "POST", body: hook.body, headers: hook.headers }), ctx({ provider: "mock" }));
    expect((await ok.json()).status).toBe("applied");
    const replay = await webhookPOST(new NextRequest(`${ORIGIN}/api/v1/webhooks/payments/mock`, { method: "POST", body: hook.body, headers: hook.headers }), ctx({ provider: "mock" }));
    expect((await replay.json()).status).toBe("duplicate");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o1.id } })).status).toBe("GROUP_PENDING");
  });

  it("la tâche planifiée exige le secret CRON", async () => {
    expect((await jobsPOST(req("/jobs/run", { body: {}, origin: null }), ctx())).status).toBe(401);
    const ok = await jobsPOST(req("/jobs/run", { body: {}, origin: null, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }), ctx());
    expect(ok.status).toBe(200);
  });

  it("export des données personnelles en JSON", async () => {
    const user = await makeUser();
    const res = await exportGET(req("/account/export", { token: await tokenFor(user.id) }), ctx());
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    const data = await res.json();
    expect(data.data.id).toBe(user.id);
    expect(JSON.stringify(data)).not.toMatch(/passwordHash/);
  });

  it("limite le débit des inscriptions", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      last = (await signupPOST(req("/auth/signup", { body: { ...signupBody, phone: `050544332${i}` }, headers: { "x-forwarded-for": "10.0.0.9" } }), ctx())).status;
    }
    expect(last).toBe(429);
  });
});
