import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { rfqResponseSchema } from "@/application/schemas";
import { confirmPurchaseOrder, shipPurchaseOrder, submitRfqResponse } from "@/application/procurement.service";
import { updateSupplierProduct } from "@/application/supplier.service";

const id = z.string().min(1).max(40);
const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rfq.respond"), rfqId: id, data: rfqResponseSchema }),
  z.object({ type: z.literal("po.confirm"), poId: id }),
  z.object({ type: z.literal("po.ship"), poId: id }),
  z.object({
    type: z.literal("product.update"),
    supplierProductId: id,
    capacityUnitsPerWeek: z.number().int().min(0).max(1_000_000),
    leadTimeDays: z.number().int().min(0).max(120),
    tiers: z.array(z.object({ minUnits: z.number().int().positive(), unitPrice: z.number().int().positive() })).min(1).max(8),
  }),
]);

export const POST = route({ roles: ["SUPPLIER"], rateLimit: { limit: 60, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const cmd = await parseBody(req, command);
  switch (cmd.type) {
    case "rfq.respond":
      return { response: await submitRfqResponse(user!.id, cmd.rfqId, cmd.data) };
    case "po.confirm":
      await confirmPurchaseOrder(user!.id, cmd.poId);
      return { ok: true };
    case "po.ship":
      await shipPurchaseOrder(user!.id, cmd.poId);
      return { ok: true };
    case "product.update":
      await updateSupplierProduct(user!.id, cmd.supplierProductId, cmd);
      return { ok: true };
  }
});
