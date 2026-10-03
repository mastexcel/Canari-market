/**
 * DeliveryService : expédition vers les points relais, missions livreurs,
 * remise par code OTP/QR, incidents, rémunérations.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { safeEqual } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { assertTransition } from "@/domain/order-status";
import { notify } from "./notification.service";
import { track } from "./analytics.service";
import { audit } from "./audit.service";
import { dispatchOrderStock } from "./inventory.service";
import { evaluateReferralForOrder } from "./referral.service";

async function setOrderStatus(tx: Db, orderId: string, to: "READY" | "OUT_FOR_DELIVERY" | "READY_FOR_PICKUP" | "DELIVERED", note: string, actorId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  assertTransition(order.status, to);
  if (order.status === to) return order;
  const updated = await tx.order.update({ where: { id: orderId }, data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}) } });
  await tx.orderStatusEvent.create({ data: { orderId, status: to, note, actorId } });
  return updated;
}

// ─── Administration logistique ──────────────────────────────

export async function logisticsBoard(db: Db = prisma) {
  const [ready, inProgress, drivers, pickupPoints] = await Promise.all([
    db.order.findMany({
      where: { status: "READY", delivery: { status: { in: ["PENDING"] } } },
      include: { delivery: true, pickupPoint: true, address: true, user: { select: { firstName: true } } },
      orderBy: { slotStart: "asc" },
      take: 100,
    }),
    db.delivery.findMany({
      where: { status: { in: ["ASSIGNED", "ACCEPTED", "PICKED_UP", "AT_PICKUP_POINT"] } },
      include: { order: { select: { number: true, status: true } }, driver: { include: { user: { select: { firstName: true } } } }, pickupPoint: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.driver.findMany({ where: { isActive: true }, include: { user: { select: { firstName: true, lastName: true } } } }),
    db.pickupPoint.findMany({ where: { isActive: true } }),
  ]);
  const toPrepare = await db.order.findMany({
    where: { status: { in: ["RECEIVED_WAREHOUSE", "PACKING"] }, items: { some: { kind: "STOCK", status: { in: ["RECEIVED_WAREHOUSE", "PACKING"] } } } },
    select: { id: true, number: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return { ready, inProgress, drivers, pickupPoints, toPrepare };
}

/** Expédie des commandes prêtes vers leur point relais (en transit). */
export async function dispatchToPickupPoints(orderIds: string[], actorId: string, db: Db = prisma) {
  let count = 0;
  for (const orderId of orderIds) {
    await inTransaction(db, async (tx) => {
      const d = await tx.delivery.findUnique({ where: { orderId }, include: { order: true, pickupPoint: true } });
      if (!d || d.mode !== "PICKUP" || d.status !== "PENDING" || d.order.status !== "READY") return;
      await tx.delivery.update({ where: { id: d.id }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
      if (d.pickupPoint?.managerUserId) await notify(d.pickupPoint.managerUserId, "parcel_incoming", { number: d.order.number }, {}, tx);
      await audit({ actorId, action: "delivery.dispatch_pickup", entityType: "Delivery", entityId: d.id }, tx);
      count++;
    });
  }
  return count;
}

export async function assignDriver(orderId: string, driverId: string, actorId: string, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const d = await tx.delivery.findUnique({ where: { orderId }, include: { order: { include: { address: true } } } });
    if (!d || d.mode !== "HOME_DELIVERY") throw new DomainError("NOT_FOUND", "Livraison à domicile introuvable.");
    if (d.order.status !== "READY" || d.status !== "PENDING") throw new DomainError("INVALID_STATE", "Commande non prête ou déjà attribuée.");
    const driver = await tx.driver.findFirst({ where: { id: driverId, isActive: true } });
    if (!driver) throw new DomainError("NOT_FOUND", "Livreur introuvable.");
    await tx.delivery.update({ where: { id: d.id }, data: { status: "ASSIGNED", driverId, assignedAt: new Date() } });
    await notify(driver.userId, "mission_assigned", { number: d.order.number, commune: d.order.address?.commune ?? "", fee: d.driverFee }, { channels: ["PUSH"] }, tx);
    await audit({ actorId, action: "delivery.assign", entityType: "Delivery", entityId: d.id, after: { driverId } }, tx);
  });
}

// ─── Livreur ─────────────────────────────────────────────────

async function driverDelivery(tx: Db, driverUserId: string, deliveryId: string) {
  const driver = await tx.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new DomainError("FORBIDDEN", "Profil livreur introuvable.");
  const d = await tx.delivery.findFirst({ where: { id: deliveryId, driverId: driver.id }, include: { order: true } });
  if (!d) throw new DomainError("NOT_FOUND", "Mission introuvable.");
  return { driver, d };
}

export async function driverMissions(driverUserId: string, db: Db = prisma) {
  const driver = await db.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new DomainError("FORBIDDEN", "Profil livreur introuvable.");
  const [active, done] = await Promise.all([
    db.delivery.findMany({
      where: { driverId: driver.id, status: { in: ["ASSIGNED", "ACCEPTED", "PICKED_UP"] } },
      include: { order: { include: { address: true, user: { select: { firstName: true, phone: true } }, items: { select: { label: true, quantity: true } } } } },
      orderBy: { scheduledStart: "asc" },
    }),
    db.delivery.findMany({ where: { driverId: driver.id, status: "DELIVERED" }, select: { driverFee: true, deliveredAt: true }, orderBy: { deliveredAt: "desc" }, take: 500 }),
  ]);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  return {
    driver,
    active,
    earnings: {
      total: done.reduce((s, d) => s + d.driverFee, 0),
      thisMonth: done.filter((d) => d.deliveredAt && d.deliveredAt >= monthStart).reduce((s, d) => s + d.driverFee, 0),
      deliveries: done.length,
    },
  };
}

export async function driverRespond(driverUserId: string, deliveryId: string, accept: boolean, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const { d } = await driverDelivery(tx, driverUserId, deliveryId);
    if (d.status !== "ASSIGNED") throw new DomainError("INVALID_STATE", "Mission déjà traitée.");
    await tx.delivery.update({
      where: { id: d.id },
      data: accept ? { status: "ACCEPTED", acceptedAt: new Date() } : { status: "PENDING", driverId: null, assignedAt: null },
    });
    await audit({ actorId: driverUserId, action: accept ? "mission.accept" : "mission.reject", entityType: "Delivery", entityId: d.id }, tx);
  });
}

export async function driverPickup(driverUserId: string, deliveryId: string, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const { d } = await driverDelivery(tx, driverUserId, deliveryId);
    if (d.status !== "ACCEPTED") throw new DomainError("INVALID_STATE", "Acceptez d'abord la mission.");
    await tx.delivery.update({ where: { id: d.id }, data: { status: "PICKED_UP", pickedUpAt: new Date() } });
    await setOrderStatus(tx, d.orderId, "OUT_FOR_DELIVERY", "Colis récupéré par le livreur", driverUserId);
    await notify(d.order.userId, "order_out_for_delivery", { number: d.order.number, code: d.order.pickupCode }, { channels: ["SMS"] }, tx);
  });
}

function assertCode(expected: string, given: string) {
  if (!/^\d{6}$/.test(given) || !safeEqual(expected, given)) throw new DomainError("VALIDATION", "Code incorrect.");
}

export async function driverDeliver(driverUserId: string, deliveryId: string, code: string, db: Db = prisma) {
  const orderId = await inTransaction(db, async (tx) => {
    const { d } = await driverDelivery(tx, driverUserId, deliveryId);
    if (d.status !== "PICKED_UP") throw new DomainError("INVALID_STATE", "Le colis n'est pas en cours de livraison.");
    assertCode(d.order.pickupCode, code);
    await tx.delivery.update({ where: { id: d.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await completeDelivery(tx, d.orderId, driverUserId);
    return d.orderId;
  });
  await evaluateReferralForOrder(orderId, db);
}

export async function reportIncident(actorUserId: string, deliveryId: string, reason: string, db: Db = prisma) {
  if (reason.trim().length < 5) throw new DomainError("VALIDATION", "Décrivez l'incident.");
  await inTransaction(db, async (tx) => {
    const d = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { driver: true, pickupPoint: true } });
    const allowed = d.driver?.userId === actorUserId || d.pickupPoint?.managerUserId === actorUserId;
    if (!allowed) throw new DomainError("FORBIDDEN", "Action non autorisée.");
    if (["DELIVERED", "CANCELLED"].includes(d.status)) throw new DomainError("INVALID_STATE", "Livraison terminée.");
    await tx.delivery.update({
      where: { id: d.id },
      data: { status: "PENDING", driverId: d.mode === "HOME_DELIVERY" ? null : d.driverId, failureReason: reason.slice(0, 300), attempts: { increment: 1 } },
    });
    const order = await tx.order.findUniqueOrThrow({ where: { id: d.orderId } });
    if (order.status === "OUT_FOR_DELIVERY") await setOrderStatus(tx, d.orderId, "READY", `Incident : ${reason.slice(0, 120)}`, actorUserId);
    await audit({ actorId: actorUserId, action: "delivery.incident", entityType: "Delivery", entityId: d.id, after: { reason } }, tx);
  });
}

// ─── Point relais ────────────────────────────────────────────

async function managedPoint(tx: Db, userId: string) {
  const point = await tx.pickupPoint.findUnique({ where: { managerUserId: userId } });
  if (!point) throw new DomainError("FORBIDDEN", "Aucun point relais rattaché à ce compte.");
  return point;
}

async function findPointDelivery(tx: Db, pointId: string, orderNumber: string) {
  const d = await tx.delivery.findFirst({
    where: { pickupPointId: pointId, order: { number: orderNumber.trim().toUpperCase() } },
    include: { order: true },
  });
  if (!d) throw new DomainError("NOT_FOUND", "Aucun colis avec ce numéro pour votre point.");
  return d;
}

export async function pickupDashboard(userId: string, db: Db = prisma) {
  const point = await managedPoint(db, userId);
  const [incoming, waiting, delivered] = await Promise.all([
    db.delivery.findMany({ where: { pickupPointId: point.id, status: "PICKED_UP" }, include: { order: { select: { number: true, user: { select: { firstName: true } } } } } }),
    db.delivery.findMany({
      where: { pickupPointId: point.id, status: "AT_PICKUP_POINT" },
      include: { order: { select: { number: true, user: { select: { firstName: true, lastName: true } }, items: { select: { label: true, quantity: true } } } } },
      orderBy: { arrivedAt: "asc" },
    }),
    db.delivery.findMany({ where: { pickupPointId: point.id, status: "DELIVERED" }, select: { deliveredAt: true }, take: 1000 }),
  ]);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthCount = delivered.filter((d) => d.deliveredAt && d.deliveredAt >= monthStart).length;
  return {
    point,
    incoming,
    waiting,
    earnings: { thisMonth: monthCount * point.feePerParcel, total: delivered.length * point.feePerParcel, parcels: delivered.length, monthParcels: monthCount },
  };
}

export async function pickupReceive(userId: string, orderNumber: string, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const point = await managedPoint(tx, userId);
    const d = await findPointDelivery(tx, point.id, orderNumber);
    if (d.status !== "PICKED_UP") throw new DomainError("INVALID_STATE", "Ce colis n'est pas attendu en réception.");
    await tx.delivery.update({ where: { id: d.id }, data: { status: "AT_PICKUP_POINT", arrivedAt: new Date() } });
    await setOrderStatus(tx, d.orderId, "READY_FOR_PICKUP", `Reçue au point ${point.name}`, userId);
    await notify(d.order.userId, "order_ready_pickup", { number: d.order.number, point: point.name, code: d.order.pickupCode }, { channels: ["SMS", "WHATSAPP"] }, tx);
  });
}

export async function pickupHandover(userId: string, orderNumber: string, code: string, db: Db = prisma) {
  const orderId = await inTransaction(db, async (tx) => {
    const point = await managedPoint(tx, userId);
    const d = await findPointDelivery(tx, point.id, orderNumber);
    if (d.status !== "AT_PICKUP_POINT") throw new DomainError("INVALID_STATE", "Ce colis n'est pas disponible au retrait.");
    assertCode(d.order.pickupCode, code);
    await tx.delivery.update({ where: { id: d.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await completeDelivery(tx, d.orderId, userId);
    return d.orderId;
  });
  await evaluateReferralForOrder(orderId, db);
}

// ─── Clôture de livraison ────────────────────────────────────

async function completeDelivery(tx: Prisma.TransactionClient, orderId: string, actorId: string) {
  await tx.orderItem.updateMany({ where: { orderId, status: "READY" }, data: { status: "DELIVERED" } });
  const order = await setOrderStatus(tx, orderId, "DELIVERED", "Remise confirmée par code", actorId);
  await dispatchOrderStock(tx, orderId, actorId);
  await notify(order.userId, "order_delivered", { savings: order.savingsTotal }, {}, tx);
  await track("order_delivered", order.userId, { orderId, savings: order.savingsTotal }, tx);
}
