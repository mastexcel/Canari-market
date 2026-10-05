import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/db";
import { deliverPush, registerPushDevice, unregisterPushDevice } from "@/application/push.service";
import { dispatchQueuedNotifications, notificationUrl, notify } from "@/application/notification.service";
import { makeUser, resetDb } from "./helpers";

const sent: Array<{ endpoint: string; url: string }> = [];
let next: { ok: boolean; gone?: boolean } = { ok: true };
vi.mock("@/infrastructure/notifications/push", () => ({
  pushConfigured: () => ({ web: true, fcm: true }),
  sendPush: vi.fn(async (t: { endpoint: string }, p: { url: string }) => {
    sent.push({ endpoint: t.endpoint, url: p.url });
    return next;
  }),
}));

const web = (n: number) => ({ kind: "WEB" as const, endpoint: `https://push.example.com/sub/${n}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } });

describe("notifications push", () => {
  beforeEach(async () => {
    await resetDb();
    sent.length = 0;
    next = { ok: true };
  });

  it("enregistre un appareil une seule fois et le rattache au dernier compte connecté", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await registerPushDevice(a.id, web(1), "Chrome Android");
    await registerPushDevice(a.id, web(1), "Chrome Android");
    expect(await prisma.pushDevice.count()).toBe(1);
    await registerPushDevice(b.id, web(1), "Chrome Android");
    expect((await prisma.pushDevice.findFirstOrThrow()).userId).toBe(b.id);
    expect(await unregisterPushDevice(a.id, web(1).endpoint)).toBe(false); // pas le sien
    expect(await unregisterPushDevice(b.id, web(1).endpoint)).toBe(true);
  });

  it("n'ajoute le canal push qu'aux utilisateurs qui l'ont activé, puis l'envoie avec la bonne page", async () => {
    const withPush = await makeUser();
    const without = await makeUser();
    await registerPushDevice(withPush.id, web(2), null);
    await registerPushDevice(withPush.id, { kind: "FCM", endpoint: "fcm-token-0123456789abcdef" }, "SesamApp SesamPush");
    await notify(withPush.id, "order_ready_pickup", { number: "SES-1", point: "Point Angré", code: "1234" });
    await notify(without.id, "order_ready_pickup", { number: "SES-2", point: "Point Angré", code: "5678" });
    expect(await prisma.notification.count({ where: { channel: "PUSH" } })).toBe(1);

    expect(await dispatchQueuedNotifications(50, prisma, ["PUSH"])).toBe(1);
    expect(sent.map((s) => s.endpoint).sort()).toEqual(["fcm-token-0123456789abcdef", web(2).endpoint]);
    expect(sent.every((s) => s.url === "/commandes")).toBe(true);
    expect((await prisma.notification.findFirstOrThrow({ where: { channel: "PUSH" } })).status).toBe("SENT");
  });

  it("retire un abonnement expiré et garde l'appareil après un échec passager", async () => {
    const u = await makeUser();
    await registerPushDevice(u.id, web(3), null);
    next = { ok: false };
    expect(await deliverPush(u.id, { title: "t", body: "b", url: "/" })).toBe(0);
    expect((await prisma.pushDevice.findFirstOrThrow()).failures).toBe(1);
    next = { ok: false, gone: true };
    await deliverPush(u.id, { title: "t", body: "b", url: "/" });
    expect(await prisma.pushDevice.count()).toBe(0);
  });

  it("ouvre une page du site adaptée au modèle de notification", () => {
    expect(notificationUrl("group_confirmed")).toBe("/commandes");
    expect(notificationUrl("referral_rewarded")).toBe("/compte/parrainage");
    expect(notificationUrl("mission_assigned")).toBe("/livreur");
    expect(notificationUrl("order_delivered", { url: "/commandes/abc" })).toBe("/commandes/abc");
    expect(notificationUrl("order_delivered", { url: "https://ailleurs.example" })).toBe("/commandes");
  });
});
