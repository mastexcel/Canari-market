/**
 * Commandes du back-office. Chaque action exige une permission précise
 * (RBAC granulaire) et est journalisée par le service appelé.
 */
import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { DomainError } from "@/domain/errors";
import { hasPermission, type AdminPermission } from "@/domain/permissions";
import { groupBuySchema } from "@/application/schemas";
import { closeGroupBuy, createGroupBuy, publishGroupBuy } from "@/application/group-buy.service";
import { awardRfq, createRfqFromGroupBuy } from "@/application/procurement.service";
import { prepareStockItems, receivePurchaseOrder, recordAdjustment, recordFractionation } from "@/application/inventory.service";
import { assignDriver, dispatchToPickupPoints } from "@/application/delivery.service";
import { adminRefund, markSupplierPaid, setAdminPermissions, setSupplierVerification, setUserStatus } from "@/application/admin.service";
import { runScheduledJobs } from "@/application/jobs.service";

const id = z.string().min(1).max(40);
const PERMS = ["SUPER_ADMIN", "USERS_MANAGE", "SUPPLIERS_MANAGE", "CATALOG_MANAGE", "PRICING_MANAGE", "GROUPBUYS_MANAGE", "ORDERS_MANAGE", "PAYMENTS_MANAGE", "REFUNDS_MANAGE", "LOGISTICS_MANAGE", "COMMUNITIES_MANAGE", "PROMOTIONS_MANAGE", "SUPPORT_MANAGE", "ANALYTICS_VIEW", "AUDIT_VIEW"] as const;

const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("groupbuy.create"), data: groupBuySchema }),
  z.object({ type: z.literal("groupbuy.publish"), id, acknowledgeDeficit: z.boolean().default(false), reason: z.string().max(500).optional() }),
  z.object({ type: z.literal("groupbuy.close"), id, force: z.enum(["success", "cancel"]).optional() }),
  z.object({ type: z.literal("groupbuy.rfq"), id, quality: z.string().min(2).max(200), packaging: z.string().min(2).max(200), destination: z.string().min(2).max(200), neededBy: z.coerce.date(), closesAt: z.coerce.date(), notes: z.string().max(500).optional() }),
  z.object({ type: z.literal("rfq.award"), rfqId: id, responseId: id, justification: z.string().max(500).optional() }),
  z.object({ type: z.literal("po.receive"), poId: id, receivedUnits: z.number().int().min(0), damagedBase: z.number().int().min(0), note: z.string().max(300).optional() }),
  z.object({ type: z.literal("po.paid"), poId: id }),
  z.object({ type: z.literal("lot.fractionate"), groupBuyId: id, portionBase: z.number().int().positive(), portionCount: z.number().int().positive(), lossBase: z.number().int().min(0) }),
  z.object({ type: z.literal("lot.adjust"), groupBuyId: id, quantityBase: z.number().int(), note: z.string().min(5).max(300) }),
  z.object({ type: z.literal("order.prepare"), orderId: id }),
  z.object({ type: z.literal("order.refund"), orderId: id, amount: z.number().int().positive(), note: z.string().min(5).max(300) }),
  z.object({ type: z.literal("logistics.dispatchPickup"), orderIds: z.array(id).min(1).max(200) }),
  z.object({ type: z.literal("logistics.assignDriver"), orderId: id, driverId: id }),
  z.object({ type: z.literal("user.status"), userId: id, status: z.enum(["ACTIVE", "SUSPENDED"]) }),
  z.object({ type: z.literal("user.permissions"), userId: id, permissions: z.array(z.enum(PERMS)) }),
  z.object({ type: z.literal("supplier.verify"), supplierId: id, status: z.enum(["VERIFIED", "REJECTED", "IN_REVIEW"]), notes: z.string().max(300).optional() }),
  z.object({ type: z.literal("jobs.run") }),
]);

type Command = z.infer<typeof command>;

const REQUIRED: Record<Command["type"], AdminPermission[]> = {
  "groupbuy.create": ["GROUPBUYS_MANAGE", "PRICING_MANAGE"],
  "groupbuy.publish": ["GROUPBUYS_MANAGE", "PRICING_MANAGE"],
  "groupbuy.close": ["GROUPBUYS_MANAGE"],
  "groupbuy.rfq": ["GROUPBUYS_MANAGE", "SUPPLIERS_MANAGE"],
  "rfq.award": ["SUPPLIERS_MANAGE", "PRICING_MANAGE"],
  "po.receive": ["LOGISTICS_MANAGE"],
  "po.paid": ["PAYMENTS_MANAGE"],
  "lot.fractionate": ["LOGISTICS_MANAGE"],
  "lot.adjust": ["LOGISTICS_MANAGE"],
  "order.prepare": ["LOGISTICS_MANAGE"],
  "order.refund": ["REFUNDS_MANAGE"],
  "logistics.dispatchPickup": ["LOGISTICS_MANAGE"],
  "logistics.assignDriver": ["LOGISTICS_MANAGE"],
  "user.status": ["USERS_MANAGE"],
  "user.permissions": ["SUPER_ADMIN"],
  "supplier.verify": ["SUPPLIERS_MANAGE"],
  "jobs.run": ["SUPER_ADMIN"],
};

export const POST = route({ roles: ["ADMIN"], rateLimit: { limit: 120, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const cmd = await parseBody(req, command);
  for (const p of REQUIRED[cmd.type]) {
    if (!hasPermission(user, p)) throw new DomainError("FORBIDDEN", "Permission insuffisante pour cette action.");
  }
  const actor = user!.id;
  switch (cmd.type) {
    case "groupbuy.create":
      return { groupBuy: await createGroupBuy(cmd.data, actor) };
    case "groupbuy.publish":
      return { groupBuy: await publishGroupBuy(cmd.id, actor, { acknowledgeDeficit: cmd.acknowledgeDeficit, reason: cmd.reason }) };
    case "groupbuy.close":
      return { result: await closeGroupBuy(cmd.id, actor, { force: cmd.force }) };
    case "groupbuy.rfq":
      return { rfq: await createRfqFromGroupBuy(cmd.id, cmd, actor) };
    case "rfq.award":
      return { purchaseOrder: await awardRfq(cmd.rfqId, cmd.responseId, cmd.justification ?? null, actor) };
    case "po.receive":
      return { result: await receivePurchaseOrder(cmd.poId, cmd, actor) };
    case "po.paid":
      await markSupplierPaid(cmd.poId, actor);
      return { ok: true };
    case "lot.fractionate":
      return { ledger: await recordFractionation(cmd.groupBuyId, cmd, actor) };
    case "lot.adjust":
      await recordAdjustment(cmd.groupBuyId, cmd.quantityBase, cmd.note, actor);
      return { ok: true };
    case "order.prepare":
      await prepareStockItems(cmd.orderId, actor);
      return { ok: true };
    case "order.refund":
      await adminRefund(cmd.orderId, cmd.amount, cmd.note, actor);
      return { ok: true };
    case "logistics.dispatchPickup":
      return { dispatched: await dispatchToPickupPoints(cmd.orderIds, actor) };
    case "logistics.assignDriver":
      await assignDriver(cmd.orderId, cmd.driverId, actor);
      return { ok: true };
    case "user.status":
      await setUserStatus(cmd.userId, cmd.status, actor);
      return { ok: true };
    case "user.permissions":
      await setAdminPermissions(cmd.userId, cmd.permissions, actor);
      return { ok: true };
    case "supplier.verify":
      await setSupplierVerification(cmd.supplierId, cmd.status, cmd.notes ?? null, actor);
      return { ok: true };
    case "jobs.run":
      return { result: await runScheduledJobs() };
  }
});
