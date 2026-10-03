/**
 * Back-office : indicateurs, gestion des utilisateurs, fournisseurs, commandes.
 * Le KPI n°1 affiché est l'économie réelle générée pour les ménages.
 */
import type { AdminPermission, OrderStatus, Prisma, UserRole } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { lineSavings } from "@/domain/savings";
import { audit } from "./audit.service";
import { funnel } from "./analytics.service";

const DAY = 86_400_000;
const EXCLUDED: OrderStatus[] = ["CANCELLED", "REFUNDED", "PENDING_PAYMENT", "DRAFT"];

/** Coût d'achat par unité de base, d'après le dernier bon de commande (ou tarif fournisseur). */
async function costPerBaseMap(db: Db): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const tiers = await db.supplierProduct.findMany({ include: { priceTiers: { orderBy: { minUnits: "asc" }, take: 1 } } });
  for (const sp of tiers) {
    const t = sp.priceTiers[0];
    if (t && !map.has(sp.productId)) map.set(sp.productId, t.unitPrice / sp.supplierUnitQuantityBase);
  }
  const poItems = await db.purchaseOrderItem.findMany({ orderBy: { purchaseOrder: { createdAt: "asc" } } });
  for (const i of poItems) map.set(i.productId, i.unitPrice / i.supplierUnitQuantityBase);
  return map;
}

export async function dashboardKpis(days = 30, db: Db = prisma, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const paidWhere: Prisma.OrderWhereInput = { paidAt: { gte: since }, status: { notIn: EXCLUDED } };

  const [orders, items, newUsers, activeBuyers, groupBuys, deliveries, poVolume, refunds, communities] = await Promise.all([
    db.order.findMany({ where: paidWhere, select: { id: true, userId: true, total: true, deliveryFee: true, fractionationFees: true, savingsTotal: true } }),
    db.orderItem.findMany({
      where: { order: paidWhere, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: { productId: true, label: true, quantity: true, unitQuantityBase: true, unitPrice: true, finalUnitPrice: true, referenceUnitPrice: true, fractionationFee: true, product: { select: { name: true, emoji: true } } },
    }),
    db.user.count({ where: { createdAt: { gte: since }, role: { in: ["HOUSEHOLD", "MERCHANT"] } } }),
    db.order.findMany({ where: paidWhere, select: { userId: true }, distinct: ["userId"] }),
    db.groupBuy.groupBy({ by: ["status"], _count: { _all: true } }),
    db.delivery.findMany({ where: { updatedAt: { gte: since } }, select: { status: true, attempts: true, driverFee: true, mode: true, pickupPoint: { select: { feePerParcel: true } } } }),
    db.purchaseOrder.aggregate({ where: { createdAt: { gte: since }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
    db.refund.aggregate({ where: { createdAt: { gte: since }, status: { not: "FAILED" } }, _sum: { amount: true } }),
    db.community.aggregate({ _avg: { memberCount: true }, _count: { _all: true } }),
  ]);

  const gmv = orders.reduce((s, o) => s + o.total, 0);
  const refunded = refunds._sum.amount ?? 0;
  const savings = items.reduce((s, i) => s + lineSavings(i), 0);

  // Marge brute : ventes produits (prix final) − coût d'achat estimé
  const cost = await costPerBaseMap(db);
  let productRevenue = 0;
  let cogs = 0;
  let uncosted = 0;
  const byProduct = new Map<string, { name: string; emoji: string; quantity: number; revenue: number }>();
  for (const i of items) {
    const rev = (i.finalUnitPrice ?? i.unitPrice) * i.quantity + i.fractionationFee * i.quantity;
    productRevenue += rev;
    const c = cost.get(i.productId);
    if (c === undefined) uncosted += rev;
    else cogs += Math.round(c * i.unitQuantityBase * i.quantity);
    const p = byProduct.get(i.productId) ?? { name: i.product.name, emoji: i.product.emoji, quantity: 0, revenue: 0 };
    p.quantity += i.quantity;
    p.revenue += rev;
    byProduct.set(i.productId, p);
  }
  const grossMargin = productRevenue - uncosted - cogs;

  const delivered = deliveries.filter((d) => d.status === "DELIVERED");
  const attempts = deliveries.reduce((s, d) => s + d.attempts, 0);
  const logisticsCost = delivered.reduce((s, d) => s + d.driverFee + (d.mode === "PICKUP" ? d.pickupPoint?.feePerParcel ?? 0 : 0), 0);

  const ordersPerUser = new Map<string, number>();
  const allPaid = await db.order.groupBy({ by: ["userId"], where: { paidAt: { not: null }, status: { notIn: EXCLUDED } }, _count: { _all: true } });
  for (const r of allPaid) ordersPerUser.set(r.userId, r._count._all);
  const buyers = [...ordersPerUser.values()];
  const repeatRate = buyers.length ? buyers.filter((n) => n >= 2).length / buyers.length : 0;

  const gbCount = (s: string) => groupBuys.find((g) => g.status === s)?._count._all ?? 0;
  const closedSuccess = gbCount("CLOSED_SUCCESS") + gbCount("COMPLETED");
  const closedTotal = closedSuccess + gbCount("CLOSED_FAILED");
  const consolidated = await db.groupBuy.aggregate({ where: { status: { in: ["OPEN", "CLOSED_SUCCESS", "COMPLETED"] } }, _sum: { committedBase: true } });

  return {
    periodDays: days,
    savings,
    savingsPerHousehold: activeBuyers.length ? Math.round(savings / activeBuyers.length) : 0,
    gmv,
    revenue: gmv - refunded,
    refunded,
    grossMargin,
    grossMarginRate: productRevenue - uncosted > 0 ? grossMargin / (productRevenue - uncosted) : 0,
    uncostedRevenue: uncosted,
    orders: orders.length,
    averageBasket: orders.length ? Math.round(gmv / orders.length) : 0,
    activeUsers: activeBuyers.length,
    newUsers,
    repeatRate,
    logisticsCost,
    logisticsCostPerOrder: delivered.length ? Math.round(logisticsCost / delivered.length) : 0,
    deliverySuccessRate: delivered.length + attempts > 0 ? delivered.length / (delivered.length + attempts) : 0,
    activeGroupBuys: gbCount("OPEN"),
    groupBuySuccessRate: closedTotal ? closedSuccess / closedTotal : null,
    supplierVolume: poVolume._sum.totalAmount ?? 0,
    consolidatedBase: consolidated._sum.committedBase ?? 0,
    householdsPerCommunity: Math.round(communities._avg.memberCount ?? 0),
    communities: communities._count._all,
    topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    funnel: await funnel(since, db),
  };
}

/** Série quotidienne GMV / économies pour les graphiques. */
export async function dailySeries(days = 30, db: Db = prisma, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const orders = await db.order.findMany({ where: { paidAt: { gte: since }, status: { notIn: EXCLUDED } }, select: { paidAt: true, total: true, savingsTotal: true } });
  const buckets = new Map<string, { gmv: number; savings: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) buckets.set(new Date(now.getTime() - i * DAY).toISOString().slice(0, 10), { gmv: 0, savings: 0, orders: 0 });
  for (const o of orders) {
    const b = buckets.get(o.paidAt!.toISOString().slice(0, 10));
    if (b) {
      b.gmv += o.total;
      b.savings += o.savingsTotal;
      b.orders += 1;
    }
  }
  return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
}

// ─── Utilisateurs ────────────────────────────────────────────

export async function listUsers(params: { q?: string; role?: UserRole; take?: number }, db: Db = prisma) {
  const q = params.q?.trim();
  return db.user.findMany({
    where: {
      status: { not: "DELETED" },
      ...(params.role ? { role: params.role } : {}),
      ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\s/g, "") } }] } : {}),
    },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true, commune: true, createdAt: true, adminPermissions: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: params.take ?? 100,
  });
}

export async function setUserStatus(targetId: string, status: "ACTIVE" | "SUSPENDED", actorId: string, db: Db = prisma) {
  if (targetId === actorId) throw new DomainError("FORBIDDEN", "Vous ne pouvez pas modifier votre propre statut.");
  const before = await db.user.findUniqueOrThrow({ where: { id: targetId }, select: { status: true } });
  await db.user.update({ where: { id: targetId }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: targetId } });
  await audit({ actorId, action: "user.status", entityType: "User", entityId: targetId, before, after: { status } }, db);
}

export async function setAdminPermissions(targetId: string, permissions: AdminPermission[], actorId: string, db: Db = prisma) {
  if (targetId === actorId) throw new DomainError("FORBIDDEN", "Vous ne pouvez pas modifier vos propres permissions.");
  const user = await db.user.findUniqueOrThrow({ where: { id: targetId } });
  if (user.role !== "ADMIN") throw new DomainError("VALIDATION", "Seul un administrateur peut recevoir des permissions.");
  await db.user.update({ where: { id: targetId }, data: { adminPermissions: permissions } });
  await audit({ actorId, action: "user.permissions", entityType: "User", entityId: targetId, before: user.adminPermissions, after: permissions }, db);
}

// ─── Fournisseurs ────────────────────────────────────────────

export async function listSuppliers(db: Db = prisma) {
  return db.supplier.findMany({
    include: { _count: { select: { purchaseOrders: true, products: true } }, verifications: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: [{ verificationStatus: "asc" }, { businessName: "asc" }],
  });
}

export async function setSupplierVerification(supplierId: string, status: "VERIFIED" | "REJECTED" | "IN_REVIEW", notes: string | null, actorId: string, db: Db = prisma) {
  const s = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  await db.supplier.update({ where: { id: supplierId }, data: { verificationStatus: status } });
  await db.supplierVerification.updateMany({
    where: { supplierId, status: { in: ["PENDING", "IN_REVIEW"] } },
    data: { status, reviewedById: actorId, reviewedAt: new Date(), notes },
  });
  await audit({ actorId, action: "supplier.verification", entityType: "Supplier", entityId: supplierId, before: { status: s.verificationStatus }, after: { status, notes } }, db);
}

export async function markSupplierPaid(poId: string, actorId: string, db: Db = prisma) {
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
  if (po.status !== "RECEIVED") throw new DomainError("INVALID_STATE", "Seul un bon de commande réceptionné peut être réglé.");
  if (po.paidToSupplierAt) return;
  await db.purchaseOrder.update({ where: { id: poId }, data: { paidToSupplierAt: new Date() } });
  await audit({ actorId, action: "po.paid", entityType: "PurchaseOrder", entityId: poId, after: { amount: po.totalAmount } }, db);
}

// ─── Commandes ───────────────────────────────────────────────

export async function listOrdersAdmin(params: { status?: OrderStatus; q?: string; take?: number }, db: Db = prisma) {
  const q = params.q?.trim();
  return db.order.findMany({
    where: {
      ...(params.status ? { status: params.status } : { status: { not: "DRAFT" } }),
      ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { user: { firstName: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { user: { select: { firstName: true, lastName: true, commune: true } }, pickupPoint: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: params.take ?? 100,
  });
}

export async function getOrderAdmin(id: string, db: Db = prisma) {
  const o = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, commune: true } },
      items: { include: { groupBuy: { select: { title: true, status: true } } } },
      payments: { include: { transactions: true } },
      refunds: true,
      delivery: { include: { driver: { include: { user: { select: { firstName: true } } } }, pickupPoint: true } },
      events: { orderBy: { createdAt: "asc" } },
      pickupPoint: true,
      address: true,
    },
  });
  if (!o) throw new DomainError("NOT_FOUND", "Commande introuvable.");
  return o;
}

/** Remboursement manuel (réclamation) — permission REFUNDS_MANAGE. */
export async function adminRefund(orderId: string, amount: number, note: string, actorId: string, db: Db = prisma) {
  const { requestRefund, processPendingRefunds } = await import("./payment.service");
  const { inTransaction } = await import("@/infrastructure/db");
  if (!Number.isInteger(amount) || amount <= 0) throw new DomainError("VALIDATION", "Montant invalide.");
  if (note.trim().length < 5) throw new DomainError("VALIDATION", "Motif requis.");
  await inTransaction(db, async (tx) => {
    const r = await requestRefund(tx, { orderId, amount, reason: "CLAIM", note, actorId });
    if (r.uncovered > 0) throw new DomainError("INVALID_STATE", `Montant supérieur au remboursable (${amount - r.uncovered} F max).`);
    await audit({ actorId, action: "refund.manual", entityType: "Order", entityId: orderId, after: { amount, note } }, tx);
  });
  await processPendingRefunds(db);
}

