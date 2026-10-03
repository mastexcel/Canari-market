/**
 * InventoryService : réception entrepôt, fractionnement, pertes, écarts,
 * remises. Chaque opération écrit un mouvement immuable ; le grand livre de
 * lot est recalculé à partir de ces mouvements.
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError, invariant } from "@/domain/errors";
import { assertCanPrepare, computeLotLedger, type LotMovement } from "@/domain/fractionation";
import { advanceGroupItems, recomputeOrderStatus } from "./order.service";
import { audit } from "./audit.service";

async function lotReservedBase(groupBuyId: string, db: Db) {
  const agg = await db.groupBuyParticipant.aggregate({ where: { groupBuyId, status: "CONFIRMED" }, _sum: { quantityBase: true } });
  return agg._sum.quantityBase ?? 0;
}

export async function lotLedger(groupBuyId: string, db: Db = prisma) {
  const movements = await db.inventoryMovement.findMany({ where: { groupBuyId }, orderBy: { createdAt: "asc" } });
  const reserved = await lotReservedBase(groupBuyId, db);
  return {
    ledger: computeLotLedger(movements.map((m) => ({ type: m.type, quantityBase: m.quantityBase }) as LotMovement), reserved),
    movements,
  };
}

/**
 * Réception d'un bon de commande : quantité conforme + avarie éventuelle.
 * Le stock disponible augmente de la quantité conforme ; la part réservée
 * aux participants est bloquée pour eux.
 */
export async function receivePurchaseOrder(
  poId: string,
  input: { receivedUnits: number; damagedBase: number; note?: string },
  actorId: string,
  db: Db = prisma,
) {
  invariant(Number.isInteger(input.receivedUnits) && input.receivedUnits >= 0, "Quantité reçue invalide.");
  invariant(Number.isInteger(input.damagedBase) && input.damagedBase >= 0, "Avarie invalide.");
  return inTransaction(db, async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: true, supplier: true } });
    if (!["CONFIRMED", "SHIPPED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new DomainError("INVALID_STATE", "Ce bon de commande ne peut pas être réceptionné.");
    }
    const item = po.items[0];
    const receivedBase = input.receivedUnits * item.supplierUnitQuantityBase;
    if (input.damagedBase > receivedBase) throw new DomainError("VALIDATION", "L'avarie dépasse la quantité reçue.");
    const totalReceived = item.receivedUnits + input.receivedUnits;
    const complete = totalReceived >= item.units;

    await tx.purchaseOrderItem.update({
      where: { id: item.id },
      data: { receivedUnits: totalReceived, damagedBase: { increment: input.damagedBase } },
    });
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED", receivedAt: new Date() },
    });

    const good = receivedBase - input.damagedBase;
    const reservedForLot = po.groupBuyId ? await lotReservedBase(po.groupBuyId, tx) : 0;
    const before = po.groupBuyId ? (await lotLedger(po.groupBuyId, tx)).ledger : null;
    const prevGood = before ? before.purchasedBase - before.lossBase + before.adjustmentBase : 0;
    await tx.inventoryMovement.create({
      data: { warehouseId: po.warehouseId, productId: item.productId, groupBuyId: po.groupBuyId, type: "RECEIPT", quantityBase: receivedBase, reference: po.number, note: input.note ?? null, actorId },
    });
    if (input.damagedBase > 0) {
      await tx.inventoryMovement.create({
        data: { warehouseId: po.warehouseId, productId: item.productId, groupBuyId: po.groupBuyId, type: "LOSS", quantityBase: input.damagedBase, reference: po.number, note: "Avarie à la réception", actorId },
      });
    }
    // Part de la réception à réserver aux participants (sans dépasser leur demande).
    const toReserve = Math.max(0, Math.min(good, reservedForLot - Math.min(prevGood, reservedForLot)));
    await tx.inventory.upsert({
      where: { warehouseId_productId: { warehouseId: po.warehouseId, productId: item.productId } },
      create: { warehouseId: po.warehouseId, productId: item.productId, quantityBase: good, reservedBase: toReserve },
      update: { quantityBase: { increment: good }, reservedBase: { increment: toReserve } },
    });

    // Performance fournisseur : ponctualité (moyenne glissante simple)
    const onTime = new Date() <= new Date(po.expectedAt.getTime() + 86_400_000);
    await tx.supplier.update({
      where: { id: po.supplierId },
      data: { onTimeRateBps: Math.round(po.supplier.onTimeRateBps * 0.8 + (onTime ? 10_000 : 0) * 0.2) },
    });

    if (po.groupBuyId && complete) {
      await advanceGroupItems(tx, po.groupBuyId, ["SUPPLIER_CONFIRMED", "SUPPLIER_ORDERED"], "RECEIVED_WAREHOUSE", `Réception ${po.number}`, actorId);
    }
    await audit({ actorId, action: "po.receive", entityType: "PurchaseOrder", entityId: poId, after: input }, tx);
    return { complete, goodBase: good };
  });
}

/**
 * Enregistre une opération de fractionnement : `portionCount` portions de
 * `portionBase` préparées à partir du vrac du lot, avec la perte constatée.
 * Quand tout le lot réservé est préparé, les lignes passent « Prête ».
 */
export async function recordFractionation(
  groupBuyId: string,
  input: { portionBase: number; portionCount: number; lossBase: number; note?: string },
  actorId: string,
  db: Db = prisma,
) {
  return inTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GroupBuy" WHERE id = ${groupBuyId} FOR UPDATE`;
    const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: groupBuyId } });
    const { ledger } = await lotLedger(groupBuyId, tx);
    assertCanPrepare(ledger, input.portionBase, input.portionCount, input.lossBase);
    const warehouse = await tx.inventoryMovement.findFirstOrThrow({ where: { groupBuyId, type: "RECEIPT" }, select: { warehouseId: true } });

    await tx.inventoryMovement.create({
      data: {
        warehouseId: warehouse.warehouseId,
        productId: gb.productId,
        groupBuyId,
        type: "FRACTIONATION",
        quantityBase: input.portionBase * input.portionCount,
        portionBase: input.portionBase,
        portionCount: input.portionCount,
        note: input.note ?? null,
        actorId,
      },
    });
    if (input.lossBase > 0) {
      await tx.inventoryMovement.create({
        data: { warehouseId: warehouse.warehouseId, productId: gb.productId, groupBuyId, type: "LOSS", quantityBase: input.lossBase, note: "Perte au fractionnement", actorId },
      });
      await tx.inventory.update({
        where: { warehouseId_productId: { warehouseId: warehouse.warehouseId, productId: gb.productId } },
        data: { quantityBase: { decrement: input.lossBase } },
      });
    }
    await advanceGroupItems(tx, groupBuyId, ["RECEIVED_WAREHOUSE"], "PACKING", "Fractionnement en cours", actorId);
    const after = (await lotLedger(groupBuyId, tx)).ledger;
    if (after.toPrepareBase === 0) {
      await advanceGroupItems(tx, groupBuyId, ["PACKING"], "READY", "Portions préparées", actorId);
    }
    await audit({ actorId, action: "lot.fractionation", entityType: "GroupBuy", entityId: groupBuyId, after: input }, tx);
    return after;
  });
}

/** Écart d'inventaire constaté (comptage physique) — signé. */
export async function recordAdjustment(groupBuyId: string, quantityBase: number, note: string, actorId: string, db: Db = prisma) {
  invariant(Number.isInteger(quantityBase) && quantityBase !== 0, "Écart invalide.");
  invariant(note.trim().length >= 5, "Expliquez l'écart.");
  return inTransaction(db, async (tx) => {
    const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: groupBuyId } });
    const w = await tx.inventoryMovement.findFirstOrThrow({ where: { groupBuyId, type: "RECEIPT" }, select: { warehouseId: true } });
    await tx.inventoryMovement.create({ data: { warehouseId: w.warehouseId, productId: gb.productId, groupBuyId, type: "ADJUSTMENT", quantityBase, note, actorId } });
    await tx.inventory.update({
      where: { warehouseId_productId: { warehouseId: w.warehouseId, productId: gb.productId } },
      data: { quantityBase: { increment: quantityBase } },
    });
    await audit({ actorId, action: "lot.adjustment", entityType: "GroupBuy", entityId: groupBuyId, after: { quantityBase, note } }, tx);
  });
}

/** Préparation des lignes de stock d'une commande (déjà en entrepôt). */
export async function prepareStockItems(orderId: string, actorId: string, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const n = await tx.orderItem.updateMany({ where: { orderId, kind: "STOCK", status: { in: ["RECEIVED_WAREHOUSE", "PACKING"] } }, data: { status: "READY" } });
    if (n.count === 0) throw new DomainError("INVALID_STATE", "Aucune ligne de stock à préparer.");
    await recomputeOrderStatus(tx, orderId, "Articles en stock préparés", actorId);
  });
}

/**
 * Sortie de stock à la remise client : décrémente le stock et la réservation,
 * écrit un mouvement DISPATCH par ligne (rattaché au lot pour les achats groupés).
 */
export async function dispatchOrderStock(tx: Db, orderId: string, actorId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const item of order.items) {
    if (["CANCELLED", "REFUNDED"].includes(item.status)) continue;
    const qty = item.unitQuantityBase * item.quantity;
    const inv = await tx.inventory.findFirst({ where: { productId: item.productId }, orderBy: { reservedBase: "desc" } });
    if (!inv) continue;
    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantityBase: { decrement: Math.min(qty, inv.quantityBase) }, reservedBase: { decrement: Math.min(qty, inv.reservedBase) } },
    });
    await tx.inventoryMovement.create({
      data: { warehouseId: inv.warehouseId, productId: item.productId, groupBuyId: item.groupBuyId, type: "DISPATCH", quantityBase: qty, reference: order.number, actorId },
    });
  }
}
