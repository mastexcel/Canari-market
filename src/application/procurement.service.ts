/**
 * Approvisionnement : RFQ (demande de cotation) → comparaison multicritère →
 * attribution motivée → bon de commande → confirmation/expédition fournisseur.
 * SupplierService côté portail fournisseur est dans supplier.service.ts.
 */
import { z } from "zod";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { humanCode } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { assertAwardDecision, rankOffers } from "@/domain/rfq";
import { formatQuantity } from "@/domain/units";
import { formatDate } from "@/domain/dates";
import { advanceGroupItems } from "./order.service";
import { consolidatedDemand } from "./group-buy.service";
import { defaultWarehouse } from "./order.service";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import type { rfqResponseSchema } from "./schemas";

const DAY = 86_400_000;

async function nextNumber(prefix: string, exists: (n: string) => Promise<boolean>) {
  for (let i = 0; i < 10; i++) {
    const n = `${prefix}-${new Date().getUTCFullYear()}-${humanCode(5)}`;
    if (!(await exists(n))) return n;
  }
  throw new Error("Numéro indisponible.");
}

/** Crée une RFQ à partir de la demande consolidée d'un achat groupé. */
export async function createRfqFromGroupBuy(
  groupBuyId: string,
  input: { quality: string; packaging: string; destination: string; neededBy: Date; closesAt: Date; notes?: string },
  actorId: string,
  db: Db = prisma,
) {
  const { groupBuy: gb, demand } = await consolidatedDemand(groupBuyId, db);
  if (!["CLOSED_SUCCESS", "CLOSED_FAILED"].includes(gb.status)) throw new DomainError("INVALID_STATE", "La demande de cotation s'ouvre après la clôture : les quantités doivent être définitives.");
  if (demand.supplierUnitsToOrder === 0) throw new DomainError("INVALID_STATE", "Aucune demande confirmée à consolider.");
  if (input.closesAt >= input.neededBy) throw new DomainError("VALIDATION", "La clôture des offres doit précéder la date souhaitée.");
  const number = await nextNumber("RFQ", async (n) => !!(await db.rFQ.findUnique({ where: { number: n }, select: { id: true } })));
  const rfq = await db.rFQ.create({
    data: {
      number,
      groupBuyId,
      productId: gb.productId,
      quantityBase: demand.supplierUnitsToOrder * gb.supplierUnitQuantityBase,
      supplierUnitLabel: gb.supplierUnitLabel,
      supplierUnitQuantityBase: gb.supplierUnitQuantityBase,
      quality: input.quality,
      packaging: input.packaging,
      destination: input.destination,
      neededBy: input.neededBy,
      closesAt: input.closesAt,
      notes: input.notes ?? null,
      createdById: actorId,
    },
  });
  // Seuls les fournisseurs vérifiés qui référencent ce produit sont sollicités.
  const suppliers = await db.supplier.findMany({
    where: { verificationStatus: "VERIFIED", products: { some: { productId: gb.productId, isActive: true } } },
    select: { userId: true },
  });
  for (const s of suppliers) {
    await notify(s.userId, "rfq_opened", {
      number,
      quantity: formatQuantity(rfq.quantityBase, gb.product.baseUnit),
      product: gb.product.name,
      date: formatDate(input.closesAt),
    }, { channels: ["EMAIL"] }, db);
  }
  await audit({ actorId, action: "rfq.create", entityType: "RFQ", entityId: rfq.id, after: { number, quantityBase: rfq.quantityBase } }, db);
  return rfq;
}

export async function getRfqWithRanking(rfqId: string, db: Db = prisma, now = new Date()) {
  const rfq = await db.rFQ.findUniqueOrThrow({
    where: { id: rfqId },
    include: { product: true, groupBuy: true, responses: { include: { supplier: true } } },
  });
  const requiredUnits = Math.ceil(rfq.quantityBase / rfq.supplierUnitQuantityBase);
  const neededInDays = Math.max(0, Math.ceil((rfq.neededBy.getTime() - now.getTime()) / DAY));
  const ranked = rankOffers(
    rfq.responses
      .filter((r) => r.status !== "WITHDRAWN")
      .map((r) => ({
        responseId: r.id,
        supplierName: r.supplier.businessName,
        unitPrice: r.unitPrice,
        unitsOffered: r.unitsOffered,
        leadTimeDays: r.leadTimeDays,
        qualityScore: r.supplier.qualityScore,
        reliabilityScore: r.supplier.reliabilityScore,
        onTimeRateBps: r.supplier.onTimeRateBps,
        supplierVerified: r.supplier.verificationStatus === "VERIFIED",
      })),
    requiredUnits,
    neededInDays,
  );
  return { rfq, ranked, requiredUnits };
}

/** Attribution : décision humaine, justifiée si elle s'écarte du classement. */
export async function awardRfq(rfqId: string, responseId: string, justification: string | null, actorId: string, db: Db = prisma) {
  const { rfq, ranked, requiredUnits } = await getRfqWithRanking(rfqId, db);
  if (rfq.status !== "OPEN" && rfq.status !== "CLOSED") throw new DomainError("INVALID_STATE", "Cette RFQ ne peut plus être attribuée.");
  assertAwardDecision(ranked, responseId, justification);
  const response = rfq.responses.find((r) => r.id === responseId)!;
  const units = Math.min(requiredUnits, response.unitsOffered);
  const warehouse = await defaultWarehouse(db);
  const number = await nextNumber("BC", async (n) => !!(await db.purchaseOrder.findUnique({ where: { number: n }, select: { id: true } })));

  const po = await inTransaction(db, async (tx) => {
    await tx.rFQ.update({ where: { id: rfqId }, data: { status: "AWARDED", awardJustification: justification } });
    await tx.rFQResponse.update({ where: { id: responseId }, data: { status: "ACCEPTED" } });
    await tx.rFQResponse.updateMany({ where: { rfqId, id: { not: responseId }, status: "SUBMITTED" }, data: { status: "REJECTED" } });
    const po = await tx.purchaseOrder.create({
      data: {
        number,
        supplierId: response.supplierId,
        groupBuyId: rfq.groupBuyId,
        rfqResponseId: responseId,
        warehouseId: warehouse.id,
        status: "SENT",
        totalAmount: units * response.unitPrice,
        expectedAt: new Date(Date.now() + response.leadTimeDays * DAY),
        createdById: actorId,
        items: {
          create: {
            productId: rfq.productId,
            supplierUnitLabel: rfq.supplierUnitLabel,
            supplierUnitQuantityBase: rfq.supplierUnitQuantityBase,
            units,
            unitPrice: response.unitPrice,
          },
        },
      },
    });
    if (rfq.groupBuyId) {
      await advanceGroupItems(tx, rfq.groupBuyId, ["GROUP_CONFIRMED"], "SUPPLIER_ORDERED", `Bon de commande ${number} envoyé`, actorId);
    }
    await audit(
      {
        actorId,
        action: "rfq.award",
        entityType: "RFQ",
        entityId: rfqId,
        after: { responseId, rank: ranked.find((r) => r.responseId === responseId)?.rank, justification, purchaseOrder: number },
      },
      tx,
    );
    await notify(response.supplier.userId, "po_received", { number, amount: po.totalAmount }, { channels: ["EMAIL", "SMS"] }, tx);
    return po;
  });
  return po;
}

// ─── Côté fournisseur ────────────────────────────────────────

export async function submitRfqResponse(supplierUserId: string, rfqId: string, input: z.infer<typeof rfqResponseSchema>, db: Db = prisma, now = new Date()) {
  const supplier = await db.supplier.findUnique({ where: { userId: supplierUserId } });
  if (!supplier) throw new DomainError("FORBIDDEN", "Profil fournisseur introuvable.");
  if (supplier.verificationStatus !== "VERIFIED") throw new DomainError("FORBIDDEN", "Votre dossier KYB doit être vérifié pour répondre aux RFQ.");
  const rfq = await db.rFQ.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.status !== "OPEN" || rfq.closesAt < now) throw new DomainError("INVALID_STATE", "Cette demande de cotation est close.");
  if (input.validUntil < now) throw new DomainError("VALIDATION", "La validité de l'offre doit être future.");
  const existing = await db.rFQResponse.findUnique({ where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } } });
  if (existing && existing.status !== "SUBMITTED") throw new DomainError("INVALID_STATE", "Votre offre a déjà été traitée.");
  const data = { ...input, conditions: input.conditions ?? null, qualityNote: input.qualityNote ?? null };
  const res = await db.rFQResponse.upsert({
    where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } },
    create: { rfqId, supplierId: supplier.id, ...data },
    update: data,
  });
  await audit({ actorId: supplierUserId, action: "rfq.respond", entityType: "RFQResponse", entityId: res.id, after: data }, db);
  return res;
}

async function supplierPo(supplierUserId: string, poId: string, db: Db) {
  const po = await db.purchaseOrder.findFirst({ where: { id: poId, supplier: { userId: supplierUserId } } });
  if (!po) throw new DomainError("NOT_FOUND", "Bon de commande introuvable.");
  return po;
}

export async function confirmPurchaseOrder(supplierUserId: string, poId: string, db: Db = prisma) {
  const po = await supplierPo(supplierUserId, poId, db);
  if (po.status !== "SENT") throw new DomainError("INVALID_STATE", "Ce bon de commande n'est pas en attente de confirmation.");
  await inTransaction(db, async (tx) => {
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    if (po.groupBuyId) await advanceGroupItems(tx, po.groupBuyId, ["SUPPLIER_ORDERED"], "SUPPLIER_CONFIRMED", `Fournisseur : ${po.number} confirmé`, supplierUserId);
    await audit({ actorId: supplierUserId, action: "po.confirm", entityType: "PurchaseOrder", entityId: poId }, tx);
  });
}

export async function shipPurchaseOrder(supplierUserId: string, poId: string, db: Db = prisma) {
  const po = await supplierPo(supplierUserId, poId, db);
  if (po.status !== "CONFIRMED") throw new DomainError("INVALID_STATE", "Confirmez d'abord le bon de commande.");
  await db.purchaseOrder.update({ where: { id: poId }, data: { status: "SHIPPED", shippedAt: new Date() } });
  await audit({ actorId: supplierUserId, action: "po.ship", entityType: "PurchaseOrder", entityId: poId }, db);
}
