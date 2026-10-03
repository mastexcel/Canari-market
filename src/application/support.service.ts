/** Support client et avis. */
import type { z } from "zod";
import { prisma, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import type { reviewSchema, supportTicketSchema } from "./schemas";

export async function createTicket(userId: string, input: z.infer<typeof supportTicketSchema>, db: Db = prisma) {
  if (input.orderId) {
    const o = await db.order.findFirst({ where: { id: input.orderId, userId } });
    if (!o) throw new DomainError("NOT_FOUND", "Commande introuvable.");
  }
  return db.supportTicket.create({
    data: {
      userId,
      orderId: input.orderId || null,
      category: input.category,
      subject: input.subject,
      messages: { create: { authorId: userId, body: input.message } },
    },
  });
}

export async function listTickets(userId: string, db: Db = prisma) {
  return db.supportTicket.findMany({ where: { userId }, include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } });
}

export async function createReview(userId: string, input: z.infer<typeof reviewSchema>, db: Db = prisma) {
  const order = await db.order.findFirst({ where: { id: input.orderId, userId }, include: { delivery: true, items: true } });
  if (!order) throw new DomainError("NOT_FOUND", "Commande introuvable.");
  if (order.status !== "DELIVERED") throw new DomainError("INVALID_STATE", "Vous pourrez évaluer après la livraison.");
  if (input.target === "PRODUCT" && !order.items.some((i) => i.productId === input.productId)) {
    throw new DomainError("VALIDATION", "Ce produit ne fait pas partie de la commande.");
  }
  const existing = await db.review.findFirst({ where: { userId, orderId: order.id, target: input.target, productId: input.productId ?? null } });
  if (existing) throw new DomainError("CONFLICT", "Vous avez déjà donné cet avis.");
  return db.review.create({
    data: {
      userId,
      orderId: order.id,
      target: input.target,
      productId: input.target === "PRODUCT" ? input.productId : null,
      deliveryId: input.target === "DELIVERY" ? order.delivery?.id ?? null : null,
      rating: input.rating,
      comment: input.comment || null,
    },
  });
}
